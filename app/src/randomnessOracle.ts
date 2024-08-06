import { getContract, TestClient } from 'viem';

import { config } from './config';

export function createRandomnessOracle(client: TestClient) {
  return getContract({
    address: config.RANDOMNESS_ORACLE_ADDRESS as `0x${string}`,
    client,
    abi: [{ "type": "constructor", "inputs": [{ "name": "_drandOracle", "type": "address", "internalType": "address" }, { "name": "_sequencerOracle", "type": "address", "internalType": "address" }, { "name": "_delay", "type": "uint256", "internalType": "uint256" }], "stateMutability": "nonpayable" }, { "type": "function", "name": "drandOracle", "inputs": [], "outputs": [{ "name": "", "type": "address", "internalType": "contract DrandOracle" }], "stateMutability": "view" }, { "type": "function", "name": "getDelay", "inputs": [], "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }], "stateMutability": "view" }, { "type": "function", "name": "getRandomness", "inputs": [{ "name": "T", "type": "uint256", "internalType": "uint256" }], "outputs": [{ "name": "", "type": "bytes32", "internalType": "bytes32" }], "stateMutability": "view" }, { "type": "function", "name": "sequencerOracle", "inputs": [], "outputs": [{ "name": "", "type": "address", "internalType": "contract SequencerRandomOracle" }], "stateMutability": "view" }, { "type": "function", "name": "unsafeGetRandomness", "inputs": [{ "name": "T", "type": "uint256", "internalType": "uint256" }], "outputs": [{ "name": "", "type": "bytes32", "internalType": "bytes32" }], "stateMutability": "view" }, { "type": "function", "name": "willBeAvailable", "inputs": [{ "name": "T", "type": "uint256", "internalType": "uint256" }], "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }], "stateMutability": "view" }]
  });
}
