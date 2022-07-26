// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./AuctionStorage.sol";

interface IAuctionEvents {
    event AuctionStatus(AuctionStorage.Status status);

    event OrderAdded(
        uint256 id,
        address indexed buyer,
        int128 price64x64,
        uint256 size,
        bool isLimitOrder
    );
}
