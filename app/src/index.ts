import { createTestClient, http, publicActions, walletActions } from 'viem';
import { foundry } from 'viem/chains';
import { privateKeyToAccount, nonceManager } from 'viem/accounts';
import { createHash } from 'crypto';

import { config } from './config';
import { logger } from './logger';
import { createDrandTxData } from './oracles/drandOracle';
import { createSequencerTxData } from './oracles/sequencerOracle';
import { fetchDrandRandomness } from './drand';
import { TransactionManager } from './transaction';

const SEQUENCER_COMMITMENT_INTERVAL = 2000; // in milliseconds

function generateRandomValue(): bigint {
  return BigInt('0x' + createHash('sha256').update(Math.random().toString()).digest('hex'));
}

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

  // Function to handle drand randomness
  const handleDrandRandomness = async () => {
    // Start fetching randomness from drand
    const abortController = new AbortController();
    const drandIterator = fetchDrandRandomness(abortController);

    for await (const beacon of drandIterator) {
      const drandTxData = await createDrandTxData(client, beacon);
      await txManager.addTransaction(drandTxData);
    }
  };

  // Function to handle sequencer commitments
  const handleSequencerCommitments = async () => {
    while (true) {
      const randomValue = generateRandomValue();

      const [postTxData, revealTxData] = await createSequencerTxData(client, randomValue);

      await txManager.addTransaction(postTxData);
      await txManager.addTransaction(revealTxData);

      // Wait for 2 seconds before generating the next commitment
      await new Promise((resolve) => setTimeout(resolve, SEQUENCER_COMMITMENT_INTERVAL));
    }
  };

  // Start handling drand randomness and sequencer commitments concurrently
  await Promise.all([
    handleDrandRandomness(),
    handleSequencerCommitments(),
  ]);
}

main().catch((error) => {
  if (error instanceof Error) {
    logger.error(error.message, 'Error in main function:');
  } else {
    logger.error(String(error), 'Error in main function:');
  }
  process.exit(1);
});
