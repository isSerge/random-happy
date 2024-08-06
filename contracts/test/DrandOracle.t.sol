// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "forge-std/Test.sol";

import "../src/DrandOracle.sol";

contract DrandOracleTest is Test {
    DrandOracle drandOracle;
    uint256 timeout = 10;
    uint256 initialTimestamp = 100;

    // Helper function to ensure timestamp is consistent across tests
    modifier warpTimestamp() {
        vm.warp(initialTimestamp);
        _;
    }

    function setUp() public {
        drandOracle = new DrandOracle(timeout);
    }

    function testSetAndGetDrandValue() public warpTimestamp {
        // Ensure the timestamp is not in the future
        uint256 T = block.timestamp - 1;
        bytes32 value = keccak256("test");
        drandOracle.setValue(T, value);

        assertEq(drandOracle.getValue(T), value);
    }

    function testWillBeAvailable() public warpTimestamp {
        uint256 T = block.timestamp + 1;
        assertTrue(drandOracle.willBeAvailable(T));
    }

    function testWillNotBeAvailableAfterTimeout() public warpTimestamp {
        // Ensure T is correctly set to a past time beyond the timeout period
        uint256 T = block.timestamp - timeout - 1;
        bool available = drandOracle.willBeAvailable(T);

        assertFalse(available);
    }

    function testGetTimeout() public warpTimestamp {
        assertEq(drandOracle.getTimeout(), timeout);
    }

    function testSetValueInFuture() public warpTimestamp {
        uint256 T = block.timestamp + 100;
        bytes32 value = keccak256("future");
        vm.expectRevert("Timestamp is in the future");
        drandOracle.setValue(T, value);
    }

    function testSetValueAfterTimeout() public warpTimestamp {
        uint256 T = block.timestamp - timeout - 1;
        bytes32 value = keccak256("past");
        vm.expectRevert("Drand value expired");
        drandOracle.setValue(T, value);
    }
}
