import { createTestClient, http, publicActions } from 'viem';
import { foundry } from 'viem/chains';

import { config } from './config';
import { logger } from './logger';
import drandOracleAbi from './oracles/drandOracleAbi.json';

// Setup client to interact with the blockchain
const client = createTestClient({
  chain: foundry,
  mode: 'anvil',
  transport: http(),
}).extend(publicActions);

/**
 * Fetches randomness values from the drand oracle contract for a given block timestamp.
 * @param blockTimestamp
 */
async function getRandomnessValues(blockTimestamp: bigint) {
  const drandOracleAddress = config.DRAND_ORACLE_ADDRESS as `0x${string}`;

  // Currently there seem to be an issue:
  // the exact block timestamp for which the value was set may not match the exact timestamp of the current block when the value is being fetched.
  // In order to mitigate this I process multiple timestamps around the current block's timestamp when fetching randomness values
  const timestampsToCheck = [
    blockTimestamp - 4n,
    blockTimestamp - 2n,
    blockTimestamp,
  ];

  for (const timestamp of timestampsToCheck) {
    try {
      // Fetch drand(T)
      const drandValue = await client.readContract({
        address: drandOracleAddress,
        abi: drandOracleAbi,
        functionName: 'getValue',
        args: [timestamp],
      });

      // TODO: Fetch sequencer(T)
      // TODO: Fetch randomness(T)

      logger.info(`timestamp: ${timestamp}`);
      logger.info(`drand(T): ${drandValue}`);
    } catch (error) {
      logger.error(error, `Error fetching randomness values for block ${blockTimestamp}:`);
    }
  }
}

// Monitor new blocks
async function monitorBlocks() {
  logger.info('Starting to monitor new blocks...');

  await client.watchBlocks({
    pollingInterval: 1_000,
    onBlock: async (block) => {
      const blockTimestamp = BigInt(block.timestamp);

      await getRandomnessValues(blockTimestamp);
    },
    onError: (error) => console.error('Error monitoring blocks:', error),
  });
}

monitorBlocks();
