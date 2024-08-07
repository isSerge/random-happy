import { getContract, TestClient } from 'viem';

import { config } from '../config';
import abi from './sequencerOracleAbi.json';

export function createSequencerOracle(client: TestClient) {
  return getContract({
    address: config.SEQUENCER_ORACLE_ADDRESS as `0x${string}`,
    client,
    abi,
  });
}
