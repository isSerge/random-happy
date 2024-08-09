import { PublicClient } from 'viem';

import { config } from '../config';
import { logger } from '../logger';
import { TransactionData } from '../types';
import abi from './sequencerOracleAbi.json';

export async function createSequencerTxData(client: PublicClient, commitment: string): Promise<{ txData: TransactionData, deadline: bigint }> {
  const address = config.SEQUENCER_ORACLE_ADDRESS as `0x${string}`;
  // Fetch the current block timestamp
  const block = await client.getBlock();
  const blockTimestamp = BigInt(block.timestamp);

  // Fetch the timeout value from the contract
  const timeout = await client.readContract({
    address,
    abi,
    functionName: 'getTimeout',
  });

  // Fetch the precommitDelay value from the contract
  const precommitDelay = await client.readContract({
    address,
    abi,
    functionName: 'getPrecommitDelay',
  });

  const timeoutBigInt = BigInt(timeout as string | number);
  const precommitDelayBigInt = BigInt(precommitDelay as string | number);
  // TODO: investigate: currently postCommitment reverts due to Commitment too late, using a buffer to avoid this
  const buffer = BigInt(1000);

  // Calculate the future timestamp
  const futureTimestamp = blockTimestamp + precommitDelayBigInt + buffer;

  logger.info(`Creating sequencer commitment transaction: ${commitment} for future timestamp: ${futureTimestamp}`);

  // Calculate the deadline
  const deadline = futureTimestamp + timeoutBigInt;

  const txData: TransactionData = {
    address,
    abi,
    functionName: 'postCommitment',
    args: [futureTimestamp, commitment],
  };

  return {
    txData,
    deadline,
  };
}
