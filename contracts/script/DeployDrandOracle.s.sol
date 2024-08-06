// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "forge-std/Script.sol";
import "../src/DrandOracle.sol";

contract DeployDrandOracle is Script {
    uint256 timeout = 10;

    function run() external returns (DrandOracle) {
        vm.startBroadcast();

        DrandOracle drandOracle = new DrandOracle(timeout);

        console.log("DrandOracle deployed at:", address(drandOracle));

        vm.stopBroadcast();

        return drandOracle;
    }
}
