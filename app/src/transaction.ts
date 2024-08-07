import { PublicClient } from 'viem';
import { logger } from './logger';

// TODO: make sure it's optimal for the use case
export async function waitForTransactionConfirmation(
  client: PublicClient,
  hash: `0x${string}`,
  requiredConfirmations: number = 1,
  timeout: number = 60000,
  interval: number = 1000
) {
  const startTime = Date.now();
  while (true) {
    try {
      const confirmations = await client.getTransactionConfirmations({
        hash,
      });
      if (confirmations >= requiredConfirmations) {
        return confirmations;
      }
    } catch (error) {
      logger.error(`Error fetching transaction confirmations: ${error}`);
    }
    if (Date.now() - startTime > timeout) {
      throw new Error('Transaction confirmation timeout');
    }
    await new Promise((resolve) => setTimeout(resolve, interval)); // Wait for 1 second before checking again
  }
}
