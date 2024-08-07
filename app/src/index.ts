import { createTestClient, http, publicActions } from 'viem';
import { foundry } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

import { config } from './config';
import { logger } from './logger';
import { createDrandOracle, submitRandomnessToOracle } from './oracles/drandOracle';
import { fetchDrandRandomness } from './drand';

const account = privateKeyToAccount(config.PRIVATE_KEY as `0x${string}`);

const client = createTestClient({
  chain: foundry,
  mode: 'anvil',
  transport: http(),
}).extend(publicActions);

export async function main() {
  const drandOracle = createDrandOracle(client);

  // Start fetching randomness from drand
  const abortController = new AbortController();
  const drandIterator = fetchDrandRandomness(abortController);

  // Submit randomness to oracle
  for await (const beacon of drandIterator) {
    await submitRandomnessToOracle(
      client,
      account,
      drandOracle, beacon);
  }
}

main().catch((error) => {
  if (error instanceof Error) {
    logger.error(error.message, 'Error in main function:');
  } else {
    logger.error(String(error), 'Error in main function:');
  }
  process.exit(1);
});
