import { getContract, TestClient } from 'viem';

import { config } from './config';

export function createDrandOracle(client: TestClient) {
  return getContract({
    address: config.DRAND_ORACLE_ADDRESS as `0x${string}`,
    client,
    abi: [{ "type": "constructor", "inputs": [{ "name": "_timeout", "type": "uint256", "internalType": "uint256" }], "stateMutability": "nonpayable" }, { "type": "function", "name": "getTimeout", "inputs": [], "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }], "stateMutability": "view" }, { "type": "function", "name": "getValue", "inputs": [{ "name": "T", "type": "uint256", "internalType": "uint256" }], "outputs": [{ "name": "", "type": "bytes32", "internalType": "bytes32" }], "stateMutability": "view" }, { "type": "function", "name": "setValue", "inputs": [{ "name": "T", "type": "uint256", "internalType": "uint256" }, { "name": "value", "type": "bytes32", "internalType": "bytes32" }], "outputs": [], "stateMutability": "nonpayable" }, { "type": "function", "name": "unsafeGetValue", "inputs": [{ "name": "T", "type": "uint256", "internalType": "uint256" }], "outputs": [{ "name": "", "type": "bytes32", "internalType": "bytes32" }], "stateMutability": "view" }, { "type": "function", "name": "values", "inputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }], "outputs": [{ "name": "", "type": "bytes32", "internalType": "bytes32" }], "stateMutability": "view" }, { "type": "function", "name": "willBeAvailable", "inputs": [{ "name": "T", "type": "uint256", "internalType": "uint256" }], "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }], "stateMutability": "view" }]
  });
}
