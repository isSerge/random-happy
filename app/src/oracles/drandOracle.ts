import { getContract, PublicClient } from 'viem';
import { RandomnessBeacon } from 'drand-client';

import { config } from '../config';
import { logger } from '../logger';
import { TransactionData } from '../types';

import abi from './drandOracleAbi.json';;

// TODO: remove if not needed
export function createDrandOracle(client: PublicClient) {
  return getContract({
    address: config.DRAND_ORACLE_ADDRESS as `0x${string}`,
    client,
    abi,
  });
}

export async function createDrandTxData(client: PublicClient, beacon: RandomnessBeacon): Promise<TransactionData> {
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

  return {
    address: config.DRAND_ORACLE_ADDRESS as `0x${string}`,
    abi,
    functionName: 'setValue',
    args: [blockTimestamp, `0x${beacon.randomness}`],
    deadline,
  };
}
