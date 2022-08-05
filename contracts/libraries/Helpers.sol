// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@solidstate/contracts/token/ERC20/IERC20.sol";
import "@solidstate/contracts/utils/SafeERC20.sol";

import "./ABDKMath64x64Token.sol";

library Helpers {
    using ABDKMath64x64 for int128;
    using ABDKMath64x64Token for int128;
    using ABDKMath64x64Token for uint256;

    /**
     * @notice returns the next Friday 8AM timestamp
     * @param timestamp is the current timestamp
     * Reference: https://codereview.stackexchange.com/a/33532
     * Examples:
     * getFriday(week 1 thursday) -> week 1 friday
     * getFriday(week 1 friday) -> week 2 friday
     * getFriday(week 1 saturday) -> week 2 friday
     */
    function _getFriday(uint256 timestamp) internal pure returns (uint256) {
        // dayOfWeek = 0 (sunday) - 6 (saturday)
        uint256 dayOfWeek = ((timestamp / 1 days) + 4) % 7;
        uint256 nextFriday = timestamp + ((7 + 5 - dayOfWeek) % 7) * 1 days;
        uint256 friday8am = nextFriday - (nextFriday % (24 hours)) + (8 hours);

        // If the passed timestamp is day = Friday hour > 8am,
        // we increment it by a week to next Friday
        if (timestamp >= friday8am) {
            friday8am += 7 days;
        }
        return friday8am;
    }

    /**
     * @notice returns the Friday 8AM timestamp of the following week
     * @param timestamp is the current timestamp
     * Reference: https://codereview.stackexchange.com/a/33532
     * Examples:
     * getNextFriday(week 1 thursday) -> week 2 friday
     * getNextFriday(week 1 friday) -> week 2 friday
     * getNextFriday(week 1 saturday) -> week 2 friday
     */
    function _getNextFriday(uint256 timestamp) internal pure returns (uint256) {
        // dayOfWeek = 0 (sunday) - 6 (saturday)
        uint256 dayOfWeek = ((timestamp / 1 days) + 4) % 7;
        uint256 nextFriday = timestamp + ((7 + 5 - dayOfWeek) % 7) * 1 days;
        uint256 friday8am = nextFriday - (nextFriday % (24 hours)) + (8 hours);

        // If the timestamp is on a Friday or between Monday-Thursday
        // return Friday of the following week
        if (timestamp >= friday8am || friday8am - timestamp < 4 days) {
            friday8am += 7 days;
        }
        return friday8am;
    }

    function _fromContractsToCollateral(
        uint256 contracts,
        bool isCall,
        uint8 underlyingDecimals,
        uint8 baseDecimals,
        int128 strike64x64
    ) internal pure returns (uint256) {
        if (isCall) {
            return contracts;
        }

        return
            ABDKMath64x64Token.toBaseTokenAmount(
                underlyingDecimals,
                baseDecimals,
                strike64x64.mulu(contracts)
            );
    }

    function _fromCollateralToContracts(
        uint256 collateral,
        bool isCall,
        uint8 baseDecimals,
        int128 strike64x64
    ) internal pure returns (uint256) {
        if (isCall) {
            return collateral;
        }

        int128 collateral64x64 = collateral.fromDecimals(baseDecimals);
        return collateral64x64.div(strike64x64).toDecimals(baseDecimals);
    }
}
