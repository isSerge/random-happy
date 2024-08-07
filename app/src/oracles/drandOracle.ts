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

  // TODO: include deadline
  return {
    address: config.DRAND_ORACLE_ADDRESS as `0x${string}`,
    abi,
    functionName: 'setValue',
    args: [blockTimestamp, `0x${beacon.randomness}`],
  };
}
