// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "./DrandOracle.sol";
import "./SequencerRandomOracle.sol";

contract RandomnessOracle {
    DrandOracle public drandOracle;
    SequencerRandomOracle public sequencerOracle;
    uint256 private delay;

    constructor(address _drandOracle, address _sequencerOracle, uint256 _delay) {
        drandOracle = DrandOracle(_drandOracle);
        sequencerOracle = SequencerRandomOracle(_sequencerOracle);
        delay = _delay;
    }

    // Getter function for delay
    function getDelay() public view returns (uint256) {
        return delay;
    }

    // Function to get the combined randomness value for a specific timestamp T
    function getRandomness(uint256 T) public view returns (bytes32) {
        bytes32 drandValue = drandOracle.getValue(T - delay);
        bytes32 sequencerValue = sequencerOracle.getValue(T);
        return keccak256(abi.encode(drandValue, sequencerValue));
    }

    // Unsafe function to get the combined randomness value (returns 0 if not available)
    function unsafeGetRandomness(uint256 T) public view returns (bytes32) {
        bytes32 drandValue = drandOracle.unsafeGetValue(T - delay);
        bytes32 sequencerValue = sequencerOracle.unsafeGetValue(T);
        return keccak256(abi.encode(drandValue, sequencerValue));
    }

    // Function to check if the combined randomness value will be available
    function willBeAvailable(uint256 T) public view returns (bool) {
        return drandOracle.willBeAvailable(T - delay) && sequencerOracle.willBeAvailable(T);
    }
}
