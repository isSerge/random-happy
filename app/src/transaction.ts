import { PrivateKeyAccount, PublicClient, WalletClient } from 'viem';
import { Transaction } from './types';
import { logger } from './logger';

interface TransactionManagerParams {
  account: PrivateKeyAccount;
  client: PublicClient & WalletClient;
  txTimeout?: number;
  txInterval?: number;
  txRequiredConfirmations?: number;
}

export class TransactionManager {
  private account: PrivateKeyAccount;
  private client: PublicClient & WalletClient;
  // TODO: add queue
  // private queue: any[];
  private txTimeout: number;
  private txInterval: number;
  private txRequiredConfirmations: number;

  constructor(params: TransactionManagerParams) {
    this.account = params.account;
    this.client = params.client;
    this.txInterval = params.txInterval || 1000;
    this.txTimeout = params.txTimeout || 60000;
    this.txRequiredConfirmations = params.txRequiredConfirmations || 1;
    // this.queue = [];
  }

  private async waitForTransactionConfirmation(hash: `0x${string}`) {
    const startTime = Date.now();
    while (true) {
      try {
        const confirmations = await this.client.getTransactionConfirmations({
          hash,
        });
        if (confirmations >= this.txRequiredConfirmations) {
          return confirmations;
        }
      } catch (error) {
        logger.error(`Error fetching transaction confirmations: ${error}`);
      }
      if (Date.now() - startTime > this.txTimeout) {
        throw new Error('Transaction confirmation timeout');
      }
      await new Promise((resolve) => setTimeout(resolve, this.txInterval)); // Wait for 1 second before checking again
    }
  }

  public async processTransaction(tx: Transaction) {
    logger.info(`Processing transaction: ${JSON.stringify(tx)}`);

    const txHash = await this.client.sendTransaction({
      ...tx,
      account: this.account,
      chain: this.client.chain,
    });

    logger.info(`Transaction sent: ${txHash}`);

    const confirmations = await this.waitForTransactionConfirmation(txHash);

    logger.info(`Transaction confirmed: ${confirmations}`);

    const receipt = await this.client.getTransactionReceipt({
      hash: txHash,
    });

    return receipt;
  }

}
