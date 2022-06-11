// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../libraries/ABDKMath64x64Token.sol";

contract TestABDKMath64x64Token {
    function ceil64x64(int128 x) external pure returns (int128) {
        return ABDKMath64x64Token.ceil64x64(x);
    }

    function floor64x64(int128 x) external pure returns (int128) {
        return ABDKMath64x64Token.floor64x64(x);
    }

    function roundHalfToEven64x64(int128 x) external pure returns (int128) {
        return ABDKMath64x64Token.roundHalfToEven64x64(x);
    }

    function toDecimals(int128 value64x64, uint8 decimals)
        external
        pure
        returns (uint256 value)
    {
        return ABDKMath64x64Token.toDecimals(value64x64, decimals);
    }

    function fromDecimals(uint256 value, uint8 decimals)
        external
        pure
        returns (int128 value64x64)
    {
        return ABDKMath64x64Token.fromDecimals(value, decimals);
    }

    function toWei(int128 value64x64) external pure returns (uint256 value) {
        return ABDKMath64x64Token.toWei(value64x64);
    }

    function fromWei(uint256 value) external pure returns (int128 value64x64) {
        return ABDKMath64x64Token.fromWei(value);
    }
}
