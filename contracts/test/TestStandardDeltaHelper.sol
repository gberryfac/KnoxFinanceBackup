// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./../libraries/Common.sol";

contract TestCommon {
    function getNextFriday(uint256 currentExpiry)
        external
        pure
        returns (uint256 nextFriday)
    {
        return Common.getNextFriday(currentExpiry);
    }
}
