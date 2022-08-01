// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../libraries/Helpers.sol";

contract TestHelpers {
    function getFriday(uint256 timestamp) external pure returns (uint256) {
        return Helpers._getFriday(timestamp);
    }

    function getNextFriday(uint256 timestamp) external pure returns (uint256) {
        return Helpers._getNextFriday(timestamp);
    }

    function fromContractsToCollateral(
        uint256 contracts,
        bool isCall,
        uint8 underlyingDecimals,
        uint8 baseDecimals,
        int128 strike64x64
    ) external pure returns (uint256) {
        return
            Helpers._fromContractsToCollateral(
                contracts,
                isCall,
                underlyingDecimals,
                baseDecimals,
                strike64x64
            );
    }

    function fromCollateralToContracts(
        uint256 collateral,
        bool isCall,
        uint8 baseDecimals,
        int128 strike64x64
    ) external pure returns (uint256) {
        return
            Helpers._fromCollateralToContracts(
                collateral,
                isCall,
                baseDecimals,
                strike64x64
            );
    }
}
