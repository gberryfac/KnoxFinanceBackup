// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../libraries/OptionMath.sol";

contract TestOptionMath {
    function ceil64x64(int128 x) external pure returns (int128) {
        return OptionMath.ceil64x64(x);
    }

    function floor64x64(int128 x) external pure returns (int128) {
        return OptionMath.floor64x64(x);
    }

    function toBaseTokenAmount(
        uint8 underlyingDecimals,
        uint8 baseDecimals,
        uint256 value
    ) external pure returns (uint256) {
        return
            OptionMath.toBaseTokenAmount(
                underlyingDecimals,
                baseDecimals,
                value
            );
    }
}
