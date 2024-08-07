import { getContract, PublicClient, encodeFunctionData } from 'viem';
import { RandomnessBeacon } from 'drand-client';

import { config } from '../config';
import { logger } from '../logger';
import { Transaction } from '../types';

import abi from './drandOracleAbi.json';;

// TODO: remove if not needed
export function createDrandOracle(client: PublicClient) {
  return getContract({
    address: config.DRAND_ORACLE_ADDRESS as `0x${string}`,
    client,
    abi,
  });
}

export function createDrandSubmissionTx(beacon: RandomnessBeacon): Transaction {
  const currentTimestamp = BigInt(Math.floor(Date.now() / 1000));
  const randomness = `0x${beacon.randomness}`;

  logger.info(`Creating drand randomness transaction: ${randomness} at timestamp: ${currentTimestamp}`);

  const txData = encodeFunctionData({
    abi,
    functionName: 'setValue',
    args: [currentTimestamp, randomness],
  });

  // TODO: include deadline
  return {
    to: config.DRAND_ORACLE_ADDRESS as `0x${string}`,
    data: txData,
  };
}
