import { PrivateKeyAccount, PublicClient, WalletClient } from 'viem';
import { Mutex } from 'async-mutex';

import { TransactionData } from './types';
import { logger } from './logger';

interface TransactionManagerParams {
  account: PrivateKeyAccount;
  client: PublicClient & WalletClient;
  queueInterval?: number;
  maxRetries?: number;
  batchSize?: number;
  monitorPendingTxsInterval?: number;
}

interface QueuedTransaction {
  txData: TransactionData;
  deadline: bigint;
  retries: number;
}

interface TrackedTransaction extends QueuedTransaction {
  txHash: `0x${string}`;
  nonce: bigint;
  gasPrice?: bigint;
  // TODO: include gas limit - currently blocked by timeout error
}

export class TransactionManager {
  private account: PrivateKeyAccount;
  private client: PublicClient & WalletClient;
  private queue: any; // should be TinyQueue<QueuedTransaction>, but we're using dynamic import because it's a CommonJS module
  private queueInterval: number;
  private maxRetries: number;
  private queueMutex: Mutex;
  private batchSize: number;
  private trackedTransactions: Map<`0x${string}`, TrackedTransaction>;
  private trackedTransactionsMutex: Mutex;
  private removalSet: Set<`0x${string}`>; // Set of transactions to remove from the queue
  private removalSetMutex: Mutex;
  private monitorPendingTxsInterval: number;

  constructor(params: TransactionManagerParams) {
    this.account = params.account;
    this.client = params.client;
    this.queueInterval = params.queueInterval || 1000;
    this.maxRetries = params.maxRetries || 3;
    // Using Mutex to avoid race conditions and incostistent order of transactions
    this.queueMutex = new Mutex();
    // TODO: adjust batch size to rate limit
    this.batchSize = params.batchSize || 5;
    this.trackedTransactions = new Map<`0x${string}`, TrackedTransaction>();
    this.trackedTransactionsMutex = new Mutex();
    this.removalSet = new Set<`0x${string}`>();
    this.removalSetMutex = new Mutex();
    this.monitorPendingTxsInterval = params.monitorPendingTxsInterval || 1000;
  }

  public async initialize() {
    // Initialize queue: using dynamic import since it's a CommonJS module
    const { default: TinyQueue } = await import('tinyqueue');
    this.queue = new TinyQueue<QueuedTransaction>([], (a, b) => Number(a.deadline - b.deadline));

    logger.info('TransactionManager: initialized');

    this.processQueue();
    this.monitorPendingTxs();
  }

  public async addTransaction({ txData, deadline }: { txData: TransactionData; deadline: bigint }) {
    await this.queueMutex.runExclusive(() => {
      this.queue.push({ txData, deadline, retries: 0 });
      logger.info(`TransactionManager.addTransaction: Transaction added to queue: ${txData.functionName}, deadline: ${deadline} `);
      logger.info(`TransactionManager.addTransaction: Queue length: ${this.queue.length}`);
    });
  }

  private async getCurrentBlockTimestamp(): Promise<bigint> {
    const block = await this.client.getBlock();
    return BigInt(block.timestamp);
  }

  private async processQueue() {
    while (true) {
      if (this.queue.length === 0) {
        logger.info('TransactionManager.processQueue: Queue is empty, waiting for transactions to be added');
        await new Promise((resolve) => setTimeout(resolve, this.queueInterval)); // Wait before checking the queue again
        continue;
      }

      logger.info(`TransactionManager.processQueue: Processing queue with ${this.queue.length} transactions`);

      const currentBlockTimestamp = await this.getCurrentBlockTimestamp();

      // Remove expired transactions
      await this.queueMutex.runExclusive(() => {
        while (this.queue.length > 0 && this.queue.peek().deadline <= currentBlockTimestamp) {
          const { txData } = this.queue.pop();
          logger.warn(`TransactionManager.processQueue: Discarding transaction ${txData.functionName} - deadline passed: ${txData.deadline}`);
        }
      });

      // Concurrent transaction processing:
      // 1. Create a batch of transactions to process
      const transactionsToProcess: QueuedTransaction[] = [];

      // 2. Pop transactions from the queue until the batch size is reached
      await this.queueMutex.runExclusive(() => {
        while (this.queue.length > 0 && transactionsToProcess.length < this.batchSize) {
          const nextTx = this.queue.pop();

          if (!this.removalSet.has(nextTx.txData.hash)) {
            transactionsToProcess.push(nextTx);
          } else {
            this.removalSet.delete(nextTx.txData.hash);
            logger.info(`TransactionManager.processQueue: Skipping removed transaction: ${nextTx.txData.hash}`);
          }
        }
      });

      // 3. Iterate over the batch and process each transaction
      await Promise.allSettled(
        transactionsToProcess.map(async ({ txData, deadline, retries }) => {
          try {
            const { receipt, trackedTxData } = await this.submitTransaction(txData);

            // Add transaction to tracked transactions
            await this.trackedTransactionsMutex.runExclusive(() => {
              this.trackedTransactions.set(trackedTxData.txHash, { ...trackedTxData, deadline, retries });
            });

            if (receipt.status === 'reverted') {
              await this.handleTxRevert(receipt.transactionHash);
            } else {
              logger.info(`TransactionManager.processQueue: Transaction ${txData.functionName} with ${deadline} deadline succeeded`);
              // Remove transaction from tracked transactions
              await this.trackedTransactionsMutex.runExclusive(() => {
                this.trackedTransactions.delete(receipt.transactionHash);
              });
            }
          } catch (error) {
            await this.handleTxError(error);

            // Retry logic
            if (retries < this.maxRetries) {
              logger.info(`TransactionManager.processQueue: Retrying ${txData.functionName} transaction with deadline: ${deadline}`);
              await this.queueMutex.runExclusive(() => {
                this.queue.push({ txData, deadline, retries: retries + 1 });
              });
            } else {
              logger.warn(`TransactionManager.processQueue: Discarding ${txData.functionName} transaction with ${deadline} deadline - max retries reached: ${this.maxRetries}`);
            }
          }
        })
      );

      await new Promise((resolve) => setTimeout(resolve, this.queueInterval));
    }
  }

  // TODO: handle specific transaction errors
  private async handleTxError(error: unknown) {
    if (error instanceof Error) {
      logger.error(`TransactionManager.handleTxError: Failed to process transaction: ${error.message}`);
    } else {
      logger.error(`TransactionManager.handleTxError: Failed to process transaction: ${String(error)}`);
    }
  }

  // TODO: handle specific revert reasons
  private async handleTxRevert(txHash: `0x${string}`) {
    logger.error(`TransactionManager.handleTxRevert: Transaction ${txHash} reverted`);
  }

  private async estimateGasWithFallback(__tx: TransactionData) {
    const defaultGasLimit = BigInt(1000000);

    // TODO: investigate why this is failing with timeout error
    // try {
    //   // Estimate gas
    //   const gasEstimate = await this.client.estimateGas({
    //     ...tx,
    //     account: this.account,
    //   });

    //   // Add a buffer to the gas estimate
    //   const gasLimit = gasEstimate + BigInt(Math.floor(Number(gasEstimate) * 0.1));

    //   logger.info(`Estimated gas: ${ gasEstimate }, Gas limit with buffer: ${ gasLimit }, Default gas limit: ${ defaultGasLimit } `);

    //   return gasLimit;
    // } catch (error) {
    //   if (error instanceof Error) {
    //     logger.error(`Failed to estimate gas: ${ error.message } `);
    //   } else {
    //     logger.error(`Failed to estimate gas: ${ String(error) } `);
    //   }
    //   return defaultGasLimit;
    // }

    return defaultGasLimit;
  }

  private async submitTransaction(txData: TransactionData) {
    logger.info(`TransactionManager.submitTransaction: Submitting transaction: ${txData.functionName} on contract: ${txData.address} `);

    const gasLimit = await this.estimateGasWithFallback(txData);

    // Get current gas price
    const currentGasPrice = await this.client.getGasPrice();

    // Add a buffer to the gas price
    const gasPrice = currentGasPrice + BigInt(Math.floor(Number(currentGasPrice) * 0.1)); // 10% buffer

    logger.info(`TransactionManager.submitTransaction: Current gas price: ${currentGasPrice}, Gas price with buffer: ${gasPrice} `);

    // TODO: consider adding condition to check if simulation is enabled or necessary
    // Simulate transaction
    const { request } = await this.client.simulateContract({
      ...txData,
      account: this.account,
      chain: this.client.chain,
      gas: gasLimit,
      gasPrice,
    });

    // TODO: should use Mutex for nonce tracking, because there is a chance nonce will be consumed by another transaction
    // Get current nonce for transaction tracking
    const nonce = await this.account.nonceManager?.get({
      address: this.account.address,
      chainId: this.client.chain!.id,
      client: this.client
    });

    // Submit transaction
    const txHash = await this.client.writeContract(request);

    logger.info(`TransactionManager.submitTransaction: Transaction sent: ${txHash} `);

    const receipt = await this.client.waitForTransactionReceipt({
      hash: txHash,
    });

    // Transaction details that will be included in the tracked transactions map
    const trackedTxData = {
      txHash,
      txData,
      nonce: BigInt(nonce || 0),
      gasPrice,
    }

    return {
      trackedTxData,
      receipt,
    };
  }

  private async speedUpTransaction(txHash: `0x${string}`) {
    await this.trackedTransactionsMutex.runExclusive(async () => {
      const trackedTx = this.trackedTransactions.get(txHash);
      if (!trackedTx) {
        logger.warn(`TransactionManager.speedUpTransaction: Transaction with hash ${txHash} not found`);
        return;
      }

      logger.info(`TransactionManager.speedUpTransaction: Speeding up transaction with hash: ${txHash} by increasing gas price`);

      const originalGasPrice = trackedTx.gasPrice ? trackedTx.gasPrice : await this.client.getGasPrice();
      const newGasPrice = originalGasPrice + BigInt(Math.floor(Number(originalGasPrice) * 0.1));

      await this.queueMutex.runExclusive(() => {
        this.queue.push({
          txData: trackedTx.txData,
          deadline: trackedTx.deadline,
          retries: trackedTx.retries + 1,
          gasPrice: newGasPrice,
        });
      });
    });
  }

  // TODO: should replace the transaction with a new one with higher gas price
  private async dropTransaction(txHash: `0x${string}`) {
    await this.trackedTransactionsMutex.runExclusive(() => {
      this.trackedTransactions.delete(txHash); // Delete the transaction from trackedTransactions
    });

    await this.removalSetMutex.runExclusive(() => {
      this.removalSet.add(txHash); // Add the transaction hash to the removalSet
    });

    logger.info(`TransactionManager.dropTransaction: Transaction with hash ${txHash} marked for removal`);
  }

  // TODO: implement logic to check if transaction should be sped up or dropped
  // TODO: do more testing, currently pendingTxHashes is always empty - probably need more transactions in the queue
  private async monitorPendingTxs() {
    while (true) {
      await this.trackedTransactionsMutex.runExclusive(async () => {
        const pendingTxHashes = Array.from(this.trackedTransactions.keys());

        logger.info(`TransactionManager.monitorPendingTxs: Pending transactions: ${pendingTxHashes.length ? pendingTxHashes.join(', ') : 'none'}`);

        for (const txHash of pendingTxHashes) {
          try {
            const receipt = await this.client.getTransactionReceipt({ hash: txHash });

            if (!receipt) {
              const trackedTx = this.trackedTransactions.get(txHash);

              if (trackedTx) {
                // TODO: implement logic to check if transaction should be sped up or dropped
                const shouldSpeedUp = false;
                const shouldDrop = false;

                if (shouldSpeedUp) {
                  await this.speedUpTransaction(txHash);
                } else if (shouldDrop) {
                  await this.dropTransaction(txHash);
                }
              }
            } else {
              this.trackedTransactions.delete(receipt.transactionHash);

              logger.info(`TransactionManager.monitorMempool: Transaction confirmed with hash: ${txHash}`);
            }
          } catch (error) {
            logger.error(error, `TransactionManager.monitorMempool: Error checking transaction status for hash: ${txHash}`);
          }
        }
      });
      await new Promise((resolve) => setTimeout(resolve, this.monitorPendingTxsInterval));
    }
  }
}
