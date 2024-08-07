import { PrivateKeyAccount, PublicClient, WalletClient } from 'viem';
import { TransactionData } from './types';
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
  // private txTimeout: number;
  // private txInterval: number;
  // private txRequiredConfirmations: number;

  constructor(params: TransactionManagerParams) {
    this.account = params.account;
    this.client = params.client;
    // this.txInterval = params.txInterval || 1000;
    // this.txTimeout = params.txTimeout || 60000;
    // this.txRequiredConfirmations = params.txRequiredConfirmations || 1;
    // this.queue = [];
  }

  // TODO: add gas estimation
  public async processTransaction(tx: TransactionData) {
    logger.info(`Processing transaction: ${tx.functionName} on contract: ${tx.address}`);

    // TODO: this causes nonce or timeout issues
    // // Estimate gas
    // const gasEstimate = await this.client.estimateGas({
    //   ...tx,
    //   account: this.account,
    // });

    // // Add a buffer to the gas estimate
    // const gas = gasEstimate + BigInt(Math.floor(Number(gasEstimate) * 0.1)); // 10% buffer

    // logger.info(`Estimated gas: ${gasEstimate}, Gas limit with buffer: ${gas}`);

    // // Get current gas price
    // const currentGasPrice = await this.client.getGasPrice();

    // // Add a buffer to the gas price
    // const gasPrice = currentGasPrice + BigInt(Math.floor(Number(currentGasPrice) * 0.1)); // 10% buffer

    // logger.info(`Current gas price: ${currentGasPrice}, Gas price with buffer: ${gasPrice}`);

    // TODO: handle simulation errors
    // simulate transaction
    const { request } = await this.client.simulateContract({
      ...tx,
      account: this.account,
      chain: this.client.chain
    });

    // submit transaction
    const txHash = await this.client.writeContract(request);

    logger.info(`Transaction sent: ${txHash}`);

    const receipt = await this.client.waitForTransactionReceipt({
      hash: txHash,
      onReplaced: () => {
        logger.error(`Transaction replaced: ${txHash}`);
      },
    });

    logger.info(`Transaction status: ${receipt.status}`);

    return receipt;
  }
}
