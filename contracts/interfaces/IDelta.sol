// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IDelta {
    event OptionParametersSet(bool isCall, uint64 expiry, int128 strike64x64);

    event Sold(address account, uint256 amount, uint256 indexed tokenId);

    event Repaid(address indexed account, uint256 amount);

    event SaleWindowSet(
        uint256 blockTimestamp,
        uint256 startTimestamp,
        uint256 endTimestamp
    );

    function purchase(uint256 contractSize, uint256 maxCost) external;
}
