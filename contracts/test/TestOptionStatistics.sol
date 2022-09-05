// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "abdk-libraries-solidity/ABDKMath64x64.sol";
import "../pricer/OptionStatistics.sol";

contract TestOptionStatistics {
    using ABDKMath64x64 for int128;
    using ABDKMath64x64 for uint256;
    using OptionStatistics for int128;
    using OptionStatistics for uint256;

    uint256 public constant PRECISION = 1e18;

    constructor() {}

    function toSigned(uint256 x, bool isNegative)
        internal
        pure
        returns (int128 z)
    {
        if (isNegative) {
            z = -x.divu(PRECISION);
        } else {
            z = x.divu(PRECISION);
        }
    }

    function invCDF64x64(uint256 x, bool isNegative)
        external
        pure
        returns (int128 y)
    {
        int128 p = toSigned(x, isNegative);
        y = p.invCDF64x64();
    }
}
