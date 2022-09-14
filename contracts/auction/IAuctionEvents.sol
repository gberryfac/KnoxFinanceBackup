// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./AuctionStorage.sol";

/**
 * @title Knox Auction Events Interface
 */

interface IAuctionEvents {
    event AuctionStatusSet(uint64 indexed epoch, AuctionStorage.Status status);

    event ExchangeHelperSet(
        address oldExchangeHelper,
        address newExchangeHelper,
        address caller
    );

    event OrderAdded(
        uint64 indexed epoch,
        uint256 id,
        address buyer,
        int128 price64x64,
        uint256 size,
        bool isLimitOrder
    );

    event OrderCanceled(uint64 indexed epoch, uint256 id, address buyer);

    event OrderWithdrawn(
        uint64 indexed epoch,
        address buyer,
        uint256 refund,
        uint256 fill
    );
}
