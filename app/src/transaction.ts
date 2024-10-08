import { PrivateKeyAccount, PublicClient, WalletClient } from 'viem';
import { Mutex } from 'async-mutex';

import { TransactionData, TransactionWithDeadline } from './types';
import { logger } from './logger';

interface TransactionManagerParams {
  account: PrivateKeyAccount;
  client: PublicClient & WalletClient;
  queueInterval?: number;
  maxRetries?: number;
  batchSize?: number;
  monitorPendingTxsInterval?: number;
}

interface QueuedTransaction extends TransactionWithDeadline {
  retries: number;
}

interface TrackedTransaction extends QueuedTransaction {
  txHash: `0x${string}`;
  nonce: bigint;
  gasPrice?: bigint;
  // TODO: include gas limit - currently blocked by timeout error
}

/** 
 * This class manages transactions, including queuing, processing, and tracking transactions.
 * It also includes methods to speed up or drop transactions based on certain conditions.
 * It uses a TinyQueue for the main queue and a separate array for delayed transactions.
 * It also includes a monitorPendingTxs method to check the status of pending transactions.
 * @param account The account to use for signing transactions
 * @param client The client to interact with the chain
 * @param queueInterval The interval to check the queue for transactions
 * @param maxRetries The maximum number of retries for a transaction
 * @param batchSize The number of transactions to process in each batch
 * @param monitorPendingTxsInterval The interval to check the status of pending transactions
 * @returns A new TransactionManager instance
*/
export class TransactionManager {
  private readonly account: PrivateKeyAccount;
  private readonly client: PublicClient & WalletClient;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private queue: any; // should be TinyQueue<QueuedTransaction>, but we're using dynamic import because it's a CommonJS module
  private readonly queueInterval: number;
  private readonly maxRetries: number;
  private readonly queueMutex: Mutex;
  private readonly batchSize: number;
  private readonly trackedTransactions: Map<`0x${string}`, TrackedTransaction>;
  private readonly trackedTransactionsMutex: Mutex;
  private readonly removalSet: Set<`0x${string}`>; // Set of transactions to remove from the queue
  private readonly removalSetMutex: Mutex;
  private readonly monitorPendingTxsInterval: number;
  // TODO: using array for simplicity, probably should use a priority queue (with Mutex?) or better queue for both main and delayed transactions
  private readonly delayedQueue: QueuedTransaction[]; // Queue for transactions that are not ready to be processed yet (i.e. revealValue transactions)

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
    this.delayedQueue = [];
  }

  /**
   * Initializes the TransactionManager by starting the processQueue and monitorPendingTxs methods.
   */
  public async initialize() {
    // Initialize queue: using dynamic import since it's a CommonJS module
    const { default: TinyQueue } = await import('tinyqueue');
    this.queue = new TinyQueue<QueuedTransaction>([], (a, b) => Number(a.deadline - b.deadline));

    logger.info('TransactionManager: initialized');

    this.processQueue();
    this.monitorPendingTxs();
  }

  /**
   * Adds a transaction to the queue with the given deadline.
   * @param transactionWithDeadline Transaction data to add to the queue with the deadline and notBefore values
   * @returns A promise that resolves when the transaction is added to the queue
   */
  public async addTransaction({ txData, deadline, notBefore }: TransactionWithDeadline) {
    await this.queueMutex.runExclusive(() => {
      this.queue.push({ txData, deadline, retries: 0, notBefore });
      logger.info(`TransactionManager.addTransaction: Transaction added to queue: ${txData.functionName}, deadline: ${deadline} `);
      logger.info(`TransactionManager.addTransaction: Queue length: ${this.queue.length}`);
    });
  }

  /**
   * Gets the current block timestamp.
   * @returns The current block timestamp as a bigint
   */
  private async getCurrentBlockTimestamp(): Promise<bigint> {
    const block = await this.client.getBlock();
    return BigInt(block.timestamp);
  }

  /**
   * Processes the queue by checking for transactions to process, requeueing delayed transactions, and removing expired transactions.
   * @returns A promise that resolves when the queue is processed
   */
  private async processQueue() {
    while (true) {
      if (this.queue.length === 0 && this.delayedQueue.length === 0) {
        logger.info('TransactionManager.processQueue: Both main and delayed queues are empty, waiting for transactions to be added');
        await new Promise((resolve) => setTimeout(resolve, this.queueInterval));
        continue;
      }

      const currentBlockTimestamp = await this.getCurrentBlockTimestamp();

      await this.requeueDelayedTransactions(this.delayedQueue, currentBlockTimestamp);

      await this.queueMutex.runExclusive(() => {
        this.removeExpiredTransactions(currentBlockTimestamp);
      });

      if (this.queue.length === 0) {
        await new Promise((resolve) => setTimeout(resolve, this.queueInterval));
        continue;
      }

      const transactionsToProcess: QueuedTransaction[] = await this.getTransactionsToProcess(currentBlockTimestamp);

      await this.processTransactions(transactionsToProcess);

      await new Promise((resolve) => setTimeout(resolve, this.queueInterval));
    }
  }

  /**
   * Requeues delayed transactions that are ready to be processed.
   * @param delayedQueue The queue of delayed transactions
   * @param currentBlockTimestamp The current block timestamp
   * @returns A promise that resolves when the delayed transactions are requeued
   */
  private async requeueDelayedTransactions(delayedQueue: QueuedTransaction[], currentBlockTimestamp: bigint) {
    for (let i = 0; i < delayedQueue.length; i++) {
      const delayedTx = delayedQueue[i];
      if (delayedTx.notBefore && currentBlockTimestamp >= delayedTx.notBefore) {
        this.queue.push(delayedTx);
        delayedQueue.splice(i, 1);
        i--;
        logger.info(`TransactionManager.requeueDelayedTransactions: Moved delayed transaction ${delayedTx.txData.functionName} back to main queue`);
      }
    }
  }

  /**
   * Removes expired transactions from the queue.
   * @param currentBlockTimestamp The current block timestamp
   */
  private removeExpiredTransactions(currentBlockTimestamp: bigint) {
    while (this.queue.length > 0 && this.queue.peek().deadline <= currentBlockTimestamp) {
      const { txData } = this.queue.pop();
      logger.warn(`TransactionManager.removeExpiredTransactions: Discarding transaction ${txData.functionName} - deadline passed: ${txData.deadline}`);
    }
  }

  /**
   * Gets the transactions to process from the queue.
   * @param currentBlockTimestamp The current block timestamp
   * @returns An array of transactions to process
   */
  private async getTransactionsToProcess(currentBlockTimestamp: bigint): Promise<QueuedTransaction[]> {
    const transactionsToProcess: QueuedTransaction[] = [];
    await this.queueMutex.runExclusive(() => {
      while (this.queue.length > 0 && transactionsToProcess.length < this.batchSize) {
        const nextTx: QueuedTransaction = this.queue.pop();
        if (nextTx.notBefore && currentBlockTimestamp < nextTx.notBefore) {
          this.delayedQueue.push(nextTx);
          logger.info(`TransactionManager.getTransactionsToProcess: Skipping ${nextTx.txData.functionName} - too early to submit. Added to delayed queue.`);
        } else {
          transactionsToProcess.push(nextTx);
        }

        // TODO: implement logic to remove transactions if they are in the removalSet
        // if (!this.removalSet.has(nextTx.txData.hash)) {
        //   transactionsToProcess.push(nextTx);
        // } else {
        //   this.removalSet.delete(nextTx.txData.hash);
        //   logger.info(`TransactionManager.processQueue: Skipping removed transaction: ${nextTx.txData.hash}`);
        // }
      }
    });

    return transactionsToProcess;
  }

  /**
   * Processes the transactions in the queue by submitting them to the chain.
   * @param transactionsToProcess The transactions to process
   * @returns A promise that resolves when the transactions are processed
   */
  private async processTransactions(transactionsToProcess: QueuedTransaction[]) {
    await Promise.allSettled(
      transactionsToProcess.map(async ({ txData, deadline, retries }) => {
        try {
          const { receipt, trackedTxData } = await this.submitTransaction(txData);

          await this.trackedTransactionsMutex.runExclusive(() => {
            this.trackedTransactions.set(trackedTxData.txHash, { ...trackedTxData, deadline, retries });
          });

          if (receipt.status === 'reverted') {
            await this.handleTxRevert(receipt.transactionHash);
          } else {
            logger.info(`TransactionManager.processTransactions: Transaction ${txData.functionName} with ${deadline} deadline succeeded`);
            await this.trackedTransactionsMutex.runExclusive(() => {
              this.trackedTransactions.delete(receipt.transactionHash);
            });
          }
        } catch (error) {
          await this.handleTxError(error);
          if (retries < this.maxRetries) {
            logger.info(`TransactionManager.processTransactions: Retrying ${txData.functionName} transaction with deadline: ${deadline}`);
            await this.queueMutex.runExclusive(() => {
              this.queue.push({ txData, deadline, retries: retries + 1 });
            });
          } else {
            logger.warn(`TransactionManager.processTransactions: Discarding ${txData.functionName} transaction with ${deadline} deadline - max retries reached: ${this.maxRetries}`);
          }
        }
      })
    );
  }


  /**
   * Handles transaction errors by logging the error message.
   * @param error 
  */
  // TODO: handle specific transaction errors
  private async handleTxError(error: unknown) {
    if (error instanceof Error) {
      logger.error(`TransactionManager.handleTxError: Failed to process transaction: ${error.message}`);
    } else {
      logger.error(`TransactionManager.handleTxError: Failed to process transaction: ${String(error)}`);
    }
  }

  /**
   * Handles transaction reverts.
   * @param txHash The hash of the reverted transaction
   */
  // TODO: handle specific revert reasons
  private async handleTxRevert(txHash: `0x${string}`) {
    logger.error(`TransactionManager.handleTxRevert: Transaction ${txHash} reverted`);
  }

  /**
   * Estimates gas for a transaction.
   * @param tx The transaction data
   * @returns The estimated gas limit
   */
  // TODO: investigate why this is failing with timeout error
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async estimateGasWithFallback(__tx: TransactionData) {
    const defaultGasLimit = BigInt(1000000);

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

  /**
   * Submits a transaction to the chain.
   * @param txData The transaction data
   * @returns A promise that resolves when the transaction is submitted
   */
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

  /**
   * Speeds up a transaction by increasing the gas price.
   * @param txHash The hash of the transaction to speed up
   */
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

  /**
   * Drops a transaction from the queue.
   * @param txHash The hash of the transaction to drop
   * @returns A promise that resolves when the transaction is dropped
   */
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

  /**
   * Monitors pending transactions to check their status and take action if necessary.
   * This method is run in a loop with a delay between each iteration.
   */
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
