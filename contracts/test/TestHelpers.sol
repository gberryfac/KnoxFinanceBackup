// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../libraries/Helpers.sol";

contract TestHelpers {
    function getFriday(uint256 timestamp) external pure returns (uint256) {
        return Helpers._getFriday(timestamp);
    }

    function getNextFriday(uint256 timestamp) external pure returns (uint256) {
        return Helpers._getNextFriday(timestamp);
    }
}
