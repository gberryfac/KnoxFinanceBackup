// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "abdk-libraries-solidity/ABDKMath64x64.sol";

import "./BaseInternal.sol";

abstract contract WriteInternal is BaseInternal {
    using ABDKMath64x64 for int128;
    using ABDKMath64x64 for uint256;
    using SafeERC20 for IERC20;
    using Storage for Storage.Layout;

    constructor(bool isCall, address pool) BaseInternal(isCall, pool) {}

    /************************************************
     * PURCHASE
     ***********************************************/

    function _purchase(uint256 contractSize) internal {}
}
