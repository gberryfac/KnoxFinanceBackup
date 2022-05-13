// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library Constants {
    uint256 internal constant UNDERLYING_RESERVED_LIQ_TOKEN_ID =
        0x0200000000000000000000000000000000000000000000000000000000000000;

    uint256 internal constant BASE_RESERVED_LIQ_TOKEN_ID =
        0x0300000000000000000000000000000000000000000000000000000000000000;

    // @notice Fees are 6-decimal places. For example: 20 * 10**6 = 20%
    uint256 internal constant FEE_MULTIPLIER = 10**6;

    // @notice Placeholder uint value to prevent cold writes
    uint256 internal constant PLACEHOLDER_UINT = 1;

    // @notice Number of weeks per year = 52.142857 weeks * FEE_MULTIPLIER = 52142857.
    // Dividing by weeks per year requires doing num.mul(FEE_MULTIPLIER).div(WEEKS_PER_YEAR)
    uint256 internal constant WEEKS_PER_YEAR = 52142857;
}
