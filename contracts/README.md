# Randomness Oracle Contracts

This repository contains smart contracts for a randomness oracle system,
including `DrandOracle`, `SequencerRandomOracle`, and `RandomnessOracle`. The
contracts are developed and tested using Foundry.

## Contracts Overview

- **DrandOracle**: Fetches and stores randomness values from the Drand network.
- **SequencerRandomOracle**: Manages commitments and reveals to produce
  randomness.
- **RandomnessOracle**: Combines randomness from `DrandOracle` and
  `SequencerRandomOracle` to provide a final randomness value.

## Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation.html)
  installed
- A running Ethereum node (e.g., [Anvil](https://book.getfoundry.sh/anvil/))

## Setup

### Install Dependencies

```shell
forge install
```

### Build Contracts

```shell
forge build
```

### Test Contracts

```shell
forge test
```

## Deployment

### Environment Variables

Create a `.env` file in the root directory and add the following environment
variables:

```
RPC_URL=<your_rpc_url>
PRIVATE_KEY=<your_private_key>
```

## Deploying Contracts

Make sure you have Anvil started with 2 seconds block time (in separate terminal
tab):

```shell
anvil --block-time 2
```

In order to deploy all three contracts together run:

```shell
make deploy-all
```

Also, `DrandOracle` and `SequencerRandomOracle` contracts each can be deployed
separately:

```shell
make deploy-drand
make deploy-sequencer
```
