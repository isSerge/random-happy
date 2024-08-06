// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "forge-std/Script.sol";
import "../src/SequencerRandomOracle.sol";

contract DeploySequencerRandomOracle is Script {
    uint256 timeout = 10;
    uint256 precommitDelay = 10;

    function run() external {
        vm.startBroadcast();

        SequencerRandomOracle sequencerOracle = new SequencerRandomOracle(timeout, precommitDelay);

        console.log("SequencerRandomOracle deployed at:", address(sequencerOracle));

        vm.stopBroadcast();
    }
}
