// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

struct InitAuction {
    uint64 epoch;
    uint256 totalCollateral;
    uint256 startTime;
    uint256 endTime;
    uint256 maxPrice;
    uint256 minPrice;
    uint256 minSize;
}

struct Auction {
    bool initialized;
    bool finalized;
    bool processed;
    uint256 startTime;
    uint256 endTime;
    uint256 maxPrice;
    uint256 minPrice;
    uint256 minSize;
    uint256 totalCollateral;
    uint256 totalCollateralUsed;
    uint256 totalPremiums;
    uint256 totalTime;
    uint256 lastPrice;
    uint256 longTokenId;
}

interface IDutchAuction {
    event OrderAdded(
        address indexed buyer,
        uint256 price,
        uint256 size,
        bool isLimitOrder
    );
}
