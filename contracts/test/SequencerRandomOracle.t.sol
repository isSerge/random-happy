// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import "../src/SequencerRandomOracle.sol";

contract SequencerRandomOracleTest is Test {
    SequencerRandomOracle sequencerOracle;
    uint256 timeout = 10;
    uint256 precommitDelay = 10;
    uint256 initialTimestamp = 100;

    modifier warpTimestamp() {
        vm.warp(initialTimestamp);
        _;
    }

    function setUp() public {
        sequencerOracle = new SequencerRandomOracle(timeout, precommitDelay);
    }

    function testPostAndRevealCommitment() public warpTimestamp {
        uint256 T = block.timestamp + 20; // Ensure T is greater than precommitDelay
        bytes32 randomValue = keccak256("test");
        bytes32 commitment = keccak256(abi.encode(randomValue));

        sequencerOracle.postCommitment(T, commitment);

        // Advance the timestamp to allow revealing
        vm.warp(T + 1);

        sequencerOracle.revealValue(T, randomValue);

        assertEq(sequencerOracle.getValue(T), randomValue);
    }

    function testWillBeAvailable() public warpTimestamp {
        uint256 T = block.timestamp + 1;
        assertTrue(sequencerOracle.willBeAvailable(T));
    }

    function testWillNotBeAvailableAfterTimeout() public warpTimestamp {
        uint256 T = block.timestamp - timeout - 1;
        bool available = sequencerOracle.willBeAvailable(T);

        // Debug information
        console.log("T:", T);
        console.log("block.timestamp:", block.timestamp);
        console.log("available:", available);

        assertFalse(available);
    }

    function testPostCommitmentTooLate() public warpTimestamp {
        uint256 T = block.timestamp;
        bytes32 commitment = keccak256("late");

        vm.expectRevert("Commitment too late");
        sequencerOracle.postCommitment(T, commitment);
    }

    function testRevealInvalidCommitment() public warpTimestamp {
        uint256 T = block.timestamp + 20; // Ensure T is greater than precommitDelay
        bytes32 randomValue = keccak256("test");
        bytes32 commitment = keccak256(abi.encode(randomValue));
        sequencerOracle.postCommitment(T, commitment);

        // Advance the timestamp to allow revealing
        vm.warp(T + 1);

        bytes32 invalidRandomValue = keccak256("invalid");

        vm.expectRevert("Invalid reveal");
        sequencerOracle.revealValue(T, invalidRandomValue);
    }

    function testRevealTooEarly() public warpTimestamp {
        uint256 T = block.timestamp + 20; // Ensure T is greater than precommitDelay
        bytes32 randomValue = keccak256("test");
        bytes32 commitment = keccak256(abi.encode(randomValue));
        sequencerOracle.postCommitment(T, commitment);

        vm.expectRevert("Too early to reveal");
        sequencerOracle.revealValue(T - 1, randomValue);
    }

    function testRevealTooLate() public warpTimestamp {
        uint256 T = block.timestamp + 20; // Ensure T is greater than precommitDelay
        bytes32 randomValue = keccak256("test");
        bytes32 commitment = keccak256(abi.encode(randomValue));
        sequencerOracle.postCommitment(T, commitment);

        // Advance the timestamp to ensure it is too late for revealing
        vm.warp(T + timeout + 1);

        vm.expectRevert("Reveal too late");
        sequencerOracle.revealValue(T, randomValue);
    }

    function testGetTimeout() public warpTimestamp {
        assertEq(sequencerOracle.getTimeout(), timeout);
    }

    function testGetPrecommitDelay() public warpTimestamp {
        assertEq(sequencerOracle.getPrecommitDelay(), precommitDelay);
    }
}
