// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

contract SequencerRandomOracle {
    uint256 private timeout;
    uint256 private precommitDelay;

    // Mapping from timestamp T to commitments and revealed values
    mapping(uint256 => bytes32) public commitments;
    mapping(uint256 => bytes32) public revealedValues;
    uint256 public lastRevealedTimestamp;

    event CommitmentSubmitted(uint256 indexed timestamp, bytes32 indexed commitment);
    event ValueRevealed(uint256 indexed timestamp, bytes32 indexed value);

    // Constructor to set the timeout and precommitDelay values
    constructor(uint256 _timeout, uint256 _precommitDelay) {
        timeout = _timeout;
        precommitDelay = _precommitDelay;
    }

    // Getter function for timeout
    function getTimeout() public view returns (uint256) {
        return timeout;
    }

    // Getter function for precommitDelay
    function getPrecommitDelay() public view returns (uint256) {
        return precommitDelay;
    }

    // Function to post a commitment for a specific timestamp T
    function postCommitment(uint256 T, bytes32 commitment) external {
        require(block.timestamp <= T - precommitDelay, "Commitment too late");
        commitments[T] = commitment;

        emit CommitmentSubmitted(T, commitment);
    }

    // Function to reveal the committed value for a specific timestamp T
    function revealValue(uint256 T, bytes32 value) external {
        require(T > lastRevealedTimestamp, "Reveal out of order");
        require(block.timestamp >= T, "Too early to reveal");
        require(block.timestamp <= T + timeout, "Reveal too late");
        require(commitments[T] == keccak256(abi.encode(value)), "Invalid reveal");
        revealedValues[T] = value;
        lastRevealedTimestamp = T;

        emit ValueRevealed(T, value);
    }

    // Function to get the revealed value for a specific timestamp T
    function getValue(uint256 T) public view returns (bytes32) {
        return revealedValues[T];
    }

    // Unsafe function to get the revealed value (returns 0 if not available)
    function unsafeGetValue(uint256 T) public view returns (bytes32) {
        return revealedValues[T] == bytes32(0) ? bytes32(0) : revealedValues[T];
    }

    // Function to check if a sequencer value will be available (within timeout)
    function willBeAvailable(uint256 T) public view returns (bool) {
        return block.timestamp <= T + timeout;
    }
}
