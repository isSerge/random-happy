import { PrivateKeyAccount, PublicClient, WalletClient } from 'viem';
import { Mutex } from 'async-mutex';

import { TransactionData } from './types';
import { logger } from './logger';

interface TransactionManagerParams {
  account: PrivateKeyAccount;
  client: PublicClient & WalletClient;
  queueInterval?: number;
  maxRetries?: number;
}

interface QueuedTransaction {
  tx: TransactionData;
  deadline: bigint;
  retries: number;
}

export class TransactionManager {
  private account: PrivateKeyAccount;
  private client: PublicClient & WalletClient;
  // TODO: should be TinyQueue<QueuedTransaction>, but we're using dynamic import
  private queue: any;
  private queueInterval: number;
  private maxRetries: number;
  private queueMutex: Mutex;

  constructor(params: TransactionManagerParams) {
    this.account = params.account;
    this.client = params.client;
    this.queueInterval = params.queueInterval || 1000;
    this.maxRetries = params.maxRetries || 3;
    // Using Mutex to avoid race conditions and incostistent order of transactions
    this.queueMutex = new Mutex();
  }

  public async initialize() {
    // Initialize queue: using dynamic import since it's a CommonJS module
    const { default: TinyQueue } = await import('tinyqueue');
    this.queue = new TinyQueue<QueuedTransaction>([], (a, b) => Number(a.deadline - b.deadline));

    logger.info('Transaction manager initialized');

    this.processQueue();
  }

  private async getCurrentBlockTimestamp(): Promise<bigint> {
    const block = await this.client.getBlock();
    return BigInt(block.timestamp);
  }

  private async processQueue() {
    while (true) {
      await this.queueMutex.runExclusive(async () => {
        if (this.queue.length === 0) {
          logger.info('Queue is empty, waiting for transactions to be added');
          return;
        }

        logger.info(`Processing queue with ${this.queue.length} transactions`);

        const currentBlockTimestamp = await this.getCurrentBlockTimestamp();

        while (this.queue.length > 0 && this.queue.peek().deadline <= currentBlockTimestamp) {
          const { tx } = this.queue.pop();
          logger.warn(`Discarding transaction ${tx.functionName} - deadline passed: ${tx.deadline}`);
        }

        if (this.queue.length > 0) {
          const { tx, deadline, retries } = this.queue.pop();

          try {
            const receipt = await this.processTransaction(tx);

            if (receipt.status === 'reverted') {
              logger.error(`Transaction ${tx.functionName} with ${deadline} deadline reverted`);
            } else {
              logger.info(`Transaction ${tx.functionName} with ${deadline} deadline succeeded`);
            }
          } catch (error) {
            if (error instanceof Error) {
              logger.error(`Failed to process transaction: ${error.message}`);
            } else {
              logger.error(`Failed to process transaction: ${String(error)}`);
            }

            // Retry logic
            if (retries < this.maxRetries) {
              logger.info(`Retrying ${tx.functionName} transaction with deadline: ${deadline}`);
              this.queue.push({ tx, deadline, retries: retries + 1 });
            } else {
              logger.warn(`Discarding ${tx.functionName} transaction with ${deadline} deadline - max retries reached: ${this.maxRetries}`);
            }
          }
        }
      });

      await new Promise((resolve) => setTimeout(resolve, this.queueInterval));
    }
  }

  private async estimateGasWithFallback(__tx: TransactionData) {
    const defaultGasLimit = BigInt(1000000);

    // TODO: this breaks, investigate why
    // try {
    //   // Estimate gas
    //   const gasEstimate = await this.client.estimateGas({
    //     ...tx,
    //     account: this.account,
    //   });

    //   // Add a buffer to the gas estimate
    //   const gasLimit = gasEstimate + BigInt(Math.floor(Number(gasEstimate) * 0.1)); // 10% buffer

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

  private async processTransaction(tx: TransactionData) {
    logger.info(`Processing transaction: ${tx.functionName} on contract: ${tx.address} `);

    const gasLimit = await this.estimateGasWithFallback(tx);

    // Get current gas price
    const currentGasPrice = await this.client.getGasPrice();

    // Add a buffer to the gas price
    const gasPrice = currentGasPrice + BigInt(Math.floor(Number(currentGasPrice) * 0.1)); // 10% buffer

    logger.info(`Current gas price: ${currentGasPrice}, Gas price with buffer: ${gasPrice} `);

    // Simulate transaction
    const { request } = await this.client.simulateContract({
      ...tx,
      account: this.account,
      chain: this.client.chain,
      gas: gasLimit,
      gasPrice,
    });

    // Submit transaction
    const txHash = await this.client.writeContract(request);

    logger.info(`Transaction sent: ${txHash} `);

    const receipt = await this.client.waitForTransactionReceipt({
      hash: txHash,
    });

    logger.info(`Transaction ${txHash} included in block: ${receipt.blockNumber} `);

    return receipt;
  }

  public async addTransaction(tx: TransactionData) {
    await this.queueMutex.runExclusive(() => {
      this.queue.push({ tx, deadline: tx.deadline, retries: 0 });
      logger.info(`Transaction added to queue: ${tx.functionName}, deadline: ${tx.deadline}`);
      logger.info(`Queue length: ${this.queue.length}`);
    });
  }
}
