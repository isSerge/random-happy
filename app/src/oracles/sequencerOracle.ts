import { PublicClient, keccak256 } from 'viem';
import { toHex } from 'viem/utils';

import { config } from '../config';
import { logger } from '../logger';
import { TransactionData, TransactionWithDeadline } from '../types';
import abi from './sequencerOracleAbi.json';

export async function createSequencerTxData(client: PublicClient, randomData: bigint): Promise<[TransactionWithDeadline, TransactionWithDeadline]> {
  const address = config.SEQUENCER_ORACLE_ADDRESS as `0x${string}`;

  // Fetch the current block timestamp
  const block = await client.getBlock();
  const blockTimestamp = BigInt(block.timestamp);

  const commitment = keccak256(toHex(randomData));

  // Fetch the timeout and precommitDelay values from the contract
  const timeout = await client.readContract({
    address,
    abi,
    functionName: 'getTimeout',
  });
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

  // Calculate the deadline for the postCommitment transaction (right at futureTimestamp)
  const postDeadline = futureTimestamp;

  // Calculate the deadline for the revealValue transaction
  const revealDeadline = futureTimestamp + timeoutBigInt;

  logger.info(`Creating sequencer commitment transaction: ${commitment} for future timestamp: ${futureTimestamp}`);

  const postTxData: TransactionData = {
    address,
    abi,
    functionName: 'postCommitment',
    args: [futureTimestamp, commitment],
  };

  const revealTxData: TransactionData = {
    address,
    abi,
    functionName: 'revealValue',
    args: [futureTimestamp, toHex(randomData)],
  };

  return [
    {
      txData: postTxData,
      deadline: postDeadline, // Set deadline to futureTimestamp
    },
    {
      txData: revealTxData,
      deadline: revealDeadline, // Set deadline to futureTimestamp + timeout
      notBefore: futureTimestamp, // Ensure this is only processed after futureTimestamp
    },
  ];
}
