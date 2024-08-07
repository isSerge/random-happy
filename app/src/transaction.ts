import { PrivateKeyAccount, PublicClient, WalletClient } from 'viem';
import { TransactionData } from './types';
import { logger } from './logger';

interface TransactionManagerParams {
  account: PrivateKeyAccount;
  client: PublicClient & WalletClient;
  maxRetries?: number;
  retryDelay?: number;
}

export class TransactionManager {
  private account: PrivateKeyAccount;
  private client: PublicClient & WalletClient;
  private maxRetries: number;
  private retryDelay: number;

  constructor(params: TransactionManagerParams) {
    this.account = params.account;
    this.client = params.client;
    this.maxRetries = params.maxRetries || 3;
    this.retryDelay = params.retryDelay || 2000; // Default to 2 seconds
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

    //   logger.info(`Estimated gas: ${gasEstimate}, Gas limit with buffer: ${gasLimit}, Default gas limit: ${defaultGasLimit}`);

    //   return gasLimit;
    // } catch (error) {
    //   if (error instanceof Error) {
    //     logger.error(`Failed to estimate gas: ${error.message}`);
    //   } else {
    //     logger.error(`Failed to estimate gas: ${String(error)}`);
    //   }
    //   return defaultGasLimit;
    // }

    return defaultGasLimit;
  }

  // TODO: implement a backoff strategy
  private async sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public async processTransaction(tx: TransactionData) {
    let attempts = 0;

    while (attempts < this.maxRetries) {
      try {
        logger.info(`Processing transaction: ${tx.functionName} on contract: ${tx.address}, Attempt: ${attempts + 1}`);

        const gasLimit = await this.estimateGasWithFallback(tx);

        // Get current gas price
        const currentGasPrice = await this.client.getGasPrice();

        // Add a buffer to the gas price
        const gasPrice = currentGasPrice + BigInt(Math.floor(Number(currentGasPrice) * 0.1)); // 10% buffer

        logger.info(`Current gas price: ${currentGasPrice}, Gas price with buffer: ${gasPrice}`);

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

        logger.info(`Transaction sent: ${txHash}`);

        const receipt = await this.client.waitForTransactionReceipt({
          hash: txHash,
        });

        logger.info(`Transaction status: ${receipt.status}`);
        return receipt;
      } catch (error) {
        attempts += 1;
        if (attempts >= this.maxRetries) {
          logger.error(`Failed to process transaction after ${this.maxRetries} attempts: ${error instanceof Error ? error.message : String(error)}`);
          throw error;
        }
        logger.warn(`Attempt ${attempts} failed: ${error instanceof Error ? error.message : String(error)}. Retrying in ${this.retryDelay}ms...`);
        await this.sleep(this.retryDelay);
      }
    }

    // If the loop completes without returning, throw an error to ensure a return value.
    throw new Error('Unexpected error: Transaction processing loop exited without returning a value.');
  }
}
