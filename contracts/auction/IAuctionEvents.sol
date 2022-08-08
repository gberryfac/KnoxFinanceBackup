// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./AuctionStorage.sol";

interface IAuctionEvents {
    event AuctionStatus(uint64 indexed epoch, AuctionStorage.Status status);

    event OrderAdded(
        uint64 indexed epoch,
        uint256 id,
        address buyer,
        int128 price64x64,
        uint256 size,
        bool isLimitOrder
    );
}
