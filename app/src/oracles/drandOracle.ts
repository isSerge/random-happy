import { getContract, PrivateKeyAccount, PublicClient } from 'viem';
import { RandomnessBeacon } from 'drand-client';

import { config } from '../config';
import { logger } from '../logger';
import { waitForTransactionConfirmation } from '../transaction';

import abi from './drandOracleAbi.json';;

export function createDrandOracle(client: PublicClient) {
  return getContract({
    address: config.DRAND_ORACLE_ADDRESS as `0x${string}`,
    client,
    abi,
  });
}

// TODO: refactor
export async function submitRandomnessToOracle(
  client: PublicClient,
  account: PrivateKeyAccount,
  drandOracle: any, beacon: RandomnessBeacon) {
  const currentTimestamp = BigInt(Math.floor(Date.now() / 1000)); // Current timestamp as integer
  const randomness = `0x${beacon.randomness}`;

  logger.info(`Submitting randomness: ${randomness} at timestamp: ${currentTimestamp}`);
  try {
    const preValue = await drandOracle.read.getValue([currentTimestamp], {
      chain: client.chain,
    });
    logger.info(`Value before submission: ${preValue}`);

    const txHash = await drandOracle.write.setValue([currentTimestamp, randomness], {
      account,
      chain: client.chain,
    });

    logger.info(`Transaction submitted with hash: ${txHash}`);

    // Wait for the transaction to be confirmed
    await waitForTransactionConfirmation(client, txHash);
    logger.info(`Transaction confirmed: ${txHash}`);
    logger.info(`Submitted randomness: ${randomness} at timestamp: ${currentTimestamp}`);

    const storedValue = await drandOracle.read.getValue([currentTimestamp], {
      chain: client.chain,
    });

    logger.info(`Retrieved randomness: ${storedValue}`);
    if (randomness !== storedValue) {
      logger.warn('Mismatch in stored and retrieved randomness.');
    } else {
      logger.info('Randomness successfully retrieved matches the submitted value.');
    }
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`Failed to submit randomness: ${error.message}`);
    } else {
      logger.error(`Failed to submit randomness: ${String(error)}`);
    }
  }
}
