// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@solidstate/contracts/utils/EnumerableSet.sol";

import "./OrderBook.sol";

library DutchAuctionStorage {
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

    struct Layout {
        mapping(uint64 => Auction) auctions;
        mapping(uint64 => OrderBook.Index) orderbooks;
        mapping(address => EnumerableSet.UintSet) claimsByBuyer;
    }

    bytes32 internal constant STORAGE_SLOT =
        keccak256("knox.contracts.storage.DutchAuction");

    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            l.slot := slot
        }
    }
}
