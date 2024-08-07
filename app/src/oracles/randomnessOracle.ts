import { getContract, TestClient } from 'viem';

import { config } from '../config';
import abi from './randomnessOracleAbi.json';

export function createRandomnessOracle(client: TestClient) {
  return getContract({
    address: config.RANDOMNESS_ORACLE_ADDRESS as `0x${string}`,
    client,
    abi,
  });
}
