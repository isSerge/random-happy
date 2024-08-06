// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import "../src/RandomnessOracle.sol";
import "../src/DrandOracle.sol";
import "../src/SequencerRandomOracle.sol";

contract RandomnessOracleTest is Test {
    DrandOracle drandOracle;
    SequencerRandomOracle sequencerOracle;
    RandomnessOracle randomnessOracle;
    uint256 timeout = 10;
    uint256 precommitDelay = 10;
    uint256 delay = 9;
    uint256 initialTimestamp = 100;

    modifier warpTimestamp() {
        vm.warp(initialTimestamp);
        _;
    }

    function setUp() public {
        drandOracle = new DrandOracle(timeout);
        sequencerOracle = new SequencerRandomOracle(timeout, precommitDelay);
        randomnessOracle = new RandomnessOracle(address(drandOracle), address(sequencerOracle), delay);
    }

    function testGetRandomness() public warpTimestamp {
        uint256 T = block.timestamp + 20; // Ensure T is greater than delay and precommit delay
        bytes32 drandValue = keccak256("drand");
        bytes32 sequencerValue = keccak256("sequencer");

        // Set the Drand value to be in the past relative to T
        uint256 drandTimestamp = T - delay;
        vm.warp(drandTimestamp);
        drandOracle.setValue(drandTimestamp, drandValue); // T - delay

        // Return to the original timestamp to post commitment
        vm.warp(T - precommitDelay - 1);
        bytes32 commitment = keccak256(abi.encode(sequencerValue));
        sequencerOracle.postCommitment(T, commitment);

        // Advance the timestamp to allow revealing
        vm.warp(T + 1);

        sequencerOracle.revealValue(T, sequencerValue);

        bytes32 combinedRandomness = keccak256(abi.encode(drandValue, sequencerValue));
        assertEq(randomnessOracle.getRandomness(T), combinedRandomness);
    }

    function testWillBeAvailable() public warpTimestamp {
        uint256 T = block.timestamp + 1;
        assertTrue(randomnessOracle.willBeAvailable(T));
    }

    function testWillNotBeAvailableAfterTimeout() public warpTimestamp {
        uint256 T = block.timestamp - timeout - 1;
        bool available = randomnessOracle.willBeAvailable(T);

        assertFalse(available);
    }
}
