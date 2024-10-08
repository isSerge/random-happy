## Prerequisites

Before you begin, ensure you have the following tools installed:

- **Node.js**: Install the latest version of Node.js from
  [nodejs.org](https://nodejs.org/).
- **Foundry**: A toolchain for Ethereum application development. Follow the
  instructions at
  [foundry.sh](https://book.getfoundry.sh/getting-started/installation.html) to
  install Foundry.
- **Anvil**: A local Ethereum development chain, installed as part of Foundry.

## Structure

- `contracts/`: Contains Solidity smart contracts and their deployment scripts.
- `app/`: Contains the backend Node.js application that interacts with the smart
  contracts.
- `Makefile`: Contains commands to manage the development workflow, including
  starting Anvil, deploying contracts, and running the backend.

## Usage

This project is managed using a Makefile that simplifies the process of starting
the local blockchain, deploying contracts, and running the backend application.

1. Start the Anvil Blockchain

Run the following command to start the Anvil blockchain with a 2-second block
time:

```bash
make start-anvil
```

2. Deploy the Smart Contracts

Once the Anvil blockchain is running, deploy the necessary contracts (in
separate terminal):

```bash
make deploy-contracts
```

This will deploy all required contracts and save their addresses in a JSON file
(deployed_addresses.json) for later use by the backend application.

3. Start the Backend Application

In order to start Node.js app, make sure you include `.env` file in the `app/`
directory that may look like:

```
PRIVATE_KEY=<your-private-key>
DRAND_HTTP_URL=https://api.drand.sh/52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971
```

Note: you may use private keys from Anvil (check output after running
`make start-anvil`).

Start the backend application:

```bash
make start-app
```

This will install NPM packages and run the Node.js application, which will
interact with the deployed smart contracts.

4. Start demo script (Monitor oracles)

Once app is submitting randomness to oracles, we can start a script to monitor
oracles (in separate terminal):

```bash
make monitor-oracles
```

This should output randomness values for each block:

```
[2024-08-09 06:28:22] INFO: timestamp: 1723184897
[2024-08-09 06:28:22] INFO: drand(T): 0x6f1ded684beb1c7a4541e456d4c94d262aec4020503cbcea191b221b3e4f0b2a
```

## Current issues and potential improvements:

### Smart contracts:

1. Contracts should use `onlyOwner` modifier for methods that change state (i.e.
   `setValue`, `postCommitment`)
2. Implement integration tests (currently only unit tests implemented)
3. `RandomnessOracle` should emit events

### Node.js app:

1. Currently no unit and integration tests implemented
2. Implement robust gas management: blocked by an issue related to gas limit
   estimate
3. Better transaction status monitoring including transaction speed up and
   transaction drop (methods are added, but lack implementation)
4. Handle transaction errors (currently only does logging)
5. Handle specific reverts (currently only does logging)
6. Optimal strategy for transaction simulation (currently simulates all
   transaction before being submitted)
7. Better nonce management: currently uses `nonceManager` from `viem`
8. Integrate `RandomnessOracle`
9. Handle case when Drand randomness is not available (i.e. Drand is not
   responsing)
10. Demo script (Monitoring oracles): currently only includes Drand oracle and
    there is an issue when randomness value is not available, which requires
    more in-depth investigation
11. Consider using better queue or use own implementation: Currently using
    `TinyQueue`, which is a CommonJS module
