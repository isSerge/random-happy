// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import "../src/SequencerRandomOracle.sol";

contract SequencerRandomOracleTest is Test {
    SequencerRandomOracle sequencerOracle;
    uint256 timeout = 10;
    uint256 precommitDelay = 10;
    uint256 initialTimestamp = 100;

    event CommitmentSubmitted(uint256 indexed timestamp, bytes32 indexed commitment);
    event ValueRevealed(uint256 indexed timestamp, bytes32 indexed value);

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

        vm.expectEmit(true, true, false, true);
        emit CommitmentSubmitted(T, commitment);
        sequencerOracle.postCommitment(T, commitment);

        // Advance the timestamp to allow revealing
        vm.warp(T + 1);

        vm.expectEmit(true, true, false, true);
        emit ValueRevealed(T, randomValue);
        sequencerOracle.revealValue(T, randomValue);

        assertEq(sequencerOracle.getValue(T), randomValue);
    }

    function testRevealOutOfOrder() public warpTimestamp {
        uint256 T1 = block.timestamp + 20;
        uint256 T2 = block.timestamp + 30;
        bytes32 randomValue1 = keccak256("test1");
        bytes32 randomValue2 = keccak256("test2");

        bytes32 commitment1 = keccak256(abi.encode(randomValue1));
        bytes32 commitment2 = keccak256(abi.encode(randomValue2));

        sequencerOracle.postCommitment(T1, commitment1);
        sequencerOracle.postCommitment(T2, commitment2);

        // Advance the timestamp to allow revealing
        vm.warp(T1);

        // Reveal the first value
        sequencerOracle.revealValue(T1, randomValue1);

        // Try to reveal the second value with a lower or same timestamp as the last revealed timestamp
        vm.expectRevert("Reveal out of order");
        sequencerOracle.revealValue(T1, randomValue1); // Revealing again with T1 should fail

        // Now reveal the second value with the correct timestamp
        vm.warp(T2);
        sequencerOracle.revealValue(T2, randomValue2);

        assertEq(sequencerOracle.getValue(T2), randomValue2);
    }

    function testWillBeAvailable() public warpTimestamp {
        uint256 T = block.timestamp + 1;
        assertTrue(sequencerOracle.willBeAvailable(T));
    }

    function testWillNotBeAvailableAfterTimeout() public warpTimestamp {
        uint256 T = block.timestamp - timeout - 1;
        bool available = sequencerOracle.willBeAvailable(T);

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
