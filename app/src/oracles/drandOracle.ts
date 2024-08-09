import { PublicClient } from 'viem';
import { RandomnessBeacon } from 'drand-client';

import { config } from '../config';
import { logger } from '../logger';
import { TransactionData, TransactionWithDeadline } from '../types';

import abi from './drandOracleAbi.json';

/** 
 * Creates transaction object for the drand oracle contract with the given randomness beacon.
 * @param client The client to interact with the chain
 * @param beacon The randomness beacon object
 * @returns The transaction data and deadline
*/
export async function createDrandTxData(client: PublicClient, beacon: RandomnessBeacon): Promise<TransactionWithDeadline> {
  const block = await client.getBlock();
  const blockTimestamp = BigInt(block.timestamp);
  const randomness = `0x${beacon.randomness}`;

  logger.info(`Creating drand randomness transaction: 0x${randomness} at timestamp: ${blockTimestamp}`);

  // Fetch the timeout value from the contract
  const timeout = await client.readContract({
    address: config.DRAND_ORACLE_ADDRESS as `0x${string}`,
    abi,
    functionName: 'getTimeout',
  });

  const timeoutBigInt = BigInt(timeout as string | number);

  // Calculate the deadline
  const deadline = blockTimestamp + timeoutBigInt;

  const txData: TransactionData = {
    address: config.DRAND_ORACLE_ADDRESS as `0x${string}`,
    abi,
    functionName: 'setValue',
    args: [blockTimestamp, `0x${beacon.randomness}`],
  };

  return {
    txData,
    deadline,
  };
}
