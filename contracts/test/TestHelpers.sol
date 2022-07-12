// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../libraries/Helpers.sol";

contract TestHelpers {
    function getNextFriday(uint256 currentExpiry)
        external
        pure
        returns (uint256 nextFriday)
    {
        return Helpers.getNextFriday(currentExpiry);
    }
}
