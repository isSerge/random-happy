# Node.js app to interact with oracle contracts

## Features:

- **Drand Randomness Integration**: Fetches randomness from the Drand network and submits it to the `DrandOracle` contract.
- **Sequencer Randomness Oracle**: Generates random values, commits them, and reveals them according to a specified schedule.
- **Transaction Management**: Handles the submission and retry logic of transactions, ensuring they are processed in the correct order and timing.

## Available scripts

- `start` - start application
- `dev` - start dev server
- `build` - transpile TypeScript to ES6
- `lint` - check codebase using ESLint
