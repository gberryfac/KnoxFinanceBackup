// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@solidstate/contracts/utils/EnumerableSet.sol";

import "./OrderBook.sol";

library AuctionStorage {
    struct InitAuction {
        uint64 epoch;
        uint256 startTime;
        uint256 endTime;
    }

    enum Status {INITIALIZED, FINALIZED, PROCESSED, CANCELLED}

    struct Auction {
        Status status;
        int128 maxPrice64x64;
        int128 minPrice64x64;
        int128 lastPrice64x64;
        uint256 startTime;
        uint256 endTime;
        uint256 totalCollateral;
        uint256 totalCollateralUsed;
        uint256 totalPremiums;
        uint256 totalTime;
        uint256 longTokenId;
    }

    struct Layout {
        uint256 minSize;
        mapping(uint64 => Auction) auctions;
        mapping(uint64 => OrderBook.Index) orderbooks;
        mapping(address => EnumerableSet.UintSet) claimsByBuyer;
    }

    bytes32 internal constant STORAGE_SLOT =
        keccak256("knox.contracts.storage.Auction");

    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            l.slot := slot
        }
    }

    // TODO:
    function setMinSize() internal {}

    // TODO:
    function getMinSize() internal {}

    function _getAuction(Layout storage l, uint64 epoch)
        internal
        view
        returns (Auction memory)
    {
        return l.auctions[epoch];
    }
}
