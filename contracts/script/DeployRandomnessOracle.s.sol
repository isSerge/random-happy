// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "forge-std/Script.sol";
import "../src/DrandOracle.sol";
import "../src/SequencerRandomOracle.sol";
import "../src/RandomnessOracle.sol";

contract DeployRandomnessOracle is Script {
    uint256 drandTimeout = 10;
    uint256 sequencerTimeout = 10;
    uint256 precommitDelay = 10;
    uint256 delay = 9;

    function run() external returns (DrandOracle, SequencerRandomOracle, RandomnessOracle) {
        // Start broadcasting transactions
        vm.startBroadcast();

        // Deploy DrandOracle
        DrandOracle drandOracle = new DrandOracle(drandTimeout);
        console.log("DrandOracle deployed at:", address(drandOracle));

        // Deploy SequencerRandomOracle
        SequencerRandomOracle sequencerOracle = new SequencerRandomOracle(sequencerTimeout, precommitDelay);
        console.log("SequencerRandomOracle deployed at:", address(sequencerOracle));

        // Deploy RandomnessOracle
        RandomnessOracle randomnessOracle = new RandomnessOracle(address(drandOracle), address(sequencerOracle), delay);
        console.log("RandomnessOracle deployed at:", address(randomnessOracle));

        // Stop broadcasting transactions
        vm.stopBroadcast();

        return (drandOracle, sequencerOracle, randomnessOracle);
    }
}
