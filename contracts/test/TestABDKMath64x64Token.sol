// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../libraries/ABDKMath64x64Token.sol";

contract TestABDKMath64x64Token {
    function ceil(int128 x) external pure returns (int128) {
        return ABDKMath64x64Token.ceil(x);
    }

    function roundHalfToEven64x64(int128 x) external pure returns (int128) {
        return ABDKMath64x64Token.roundHalfToEven64x64(x);
    }
}
