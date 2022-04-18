// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library Constants {
    // @notice Fees are 6-decimal places. For example: 20 * 10**6 = 20%
    uint256 public constant FEE_MULTIPLIER = 10**6;

    // @notice Placeholder uint value to prevent cold writes
    uint256 public constant PLACEHOLDER_UINT = 1;

    // Number of weeks per year = 52.142857 weeks * FEE_MULTIPLIER = 52142857
    // Dividing by weeks per year requires doing num.mul(FEE_MULTIPLIER).div(WEEKS_PER_YEAR)
    uint256 public constant WEEKS_PER_YEAR = 52142857;
}
