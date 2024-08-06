// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

contract DrandOracle {
    uint256 private timeout;

    // Mapping from timestamp T to Drand value
    mapping(uint256 => bytes32) public values;

    // Constructor to set the timeout value
    constructor(uint256 _timeout) {
        timeout = _timeout;
    }

    // Getter function for timeout
    function getTimeout() public view returns (uint256) {
        return timeout;
    }

    // Function to set the Drand value for a specific timestamp T
    function setValue(uint256 T, bytes32 value) external {
        require(T <= block.timestamp, "Timestamp is in the future");
        require(block.timestamp <= T + timeout, "Drand value expired");
        values[T] = value;
    }

    // Function to get the Drand value for a specific timestamp T
    function getValue(uint256 T) public view returns (bytes32) {
        return values[T];
    }

    // Unsafe function to get the Drand value (returns 0 if not available)
    function unsafeGetValue(uint256 T) public view returns (bytes32) {
        return values[T] == bytes32(0) ? bytes32(0) : values[T];
    }

    // Function to check if a Drand value will be available (within timeout)
    function willBeAvailable(uint256 T) public view returns (bool) {
        return block.timestamp <= T + timeout;
    }
}
