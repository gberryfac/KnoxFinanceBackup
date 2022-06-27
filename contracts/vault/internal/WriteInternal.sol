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
     *  INPUT/OUTPUT
     ***********************************************/

    function _purchase(uint256 contractSize) internal {}

    /************************************************
     * HELPERS
     ***********************************************/

    // // /**
    // //  * @notice adjusts precision of value to base decimals
    // //  * @param value is the amount denominated in the underlying asset decimals
    // //  * @param assetProperties is a struct containing the underlying and asset decimals
    // //  */
    // function _fromUnderlyingtoBaseDecimals(uint256 value)
    //     internal
    //     view
    //     returns (uint256)
    // {
    //     Storage.Layout storage l = Storage.layout();
    //     int128 value64x64 = value.divu(10**l.underlyingDecimals);
    //     return value64x64.mulu(10**l.baseDecimals);
    // }
}
