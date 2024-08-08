import { createTestClient, http, publicActions, walletActions } from 'viem';
import { foundry } from 'viem/chains';
import { privateKeyToAccount, nonceManager } from 'viem/accounts'

import { config } from './config';
import { logger } from './logger';
import { createDrandTxData } from './oracles/drandOracle';
import { fetchDrandRandomness } from './drand';
import { TransactionManager } from './transaction';

export async function main() {
  // Create account with nonce manager to automatically handle nonces for transactions
  const account = privateKeyToAccount(config.PRIVATE_KEY as `0x${string}`, { nonceManager });

  // Create client to interact with Anvil chain
  const client = createTestClient({
    chain: foundry,
    mode: 'anvil',
    transport: http(),
  })
    .extend(publicActions)
    .extend(walletActions);

  const txManager = new TransactionManager({
    account,
    client,
  });

  // Initialize the transaction manager, which will start processing the queue
  await txManager.initialize();

  // Start fetching randomness from drand
  const abortController = new AbortController();
  const drandIterator = fetchDrandRandomness(abortController);

  // Process each beacon:
  // 1. Create transaction to submit the beacon to the drand oracle
  // 2. Process transaction with the transaction manager
  for await (const beacon of drandIterator) {
    const drandSubmissionTx = await createDrandTxData(client, beacon);

    await txManager.addTransaction(drandSubmissionTx);
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
