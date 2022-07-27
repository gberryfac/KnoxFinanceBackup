// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@solidstate/contracts/utils/EnumerableSet.sol";

import "./OrderBook.sol";

library AuctionStorage {
    using OrderBook for OrderBook.Index;

    struct InitAuction {
        uint64 epoch;
        int128 strike64x64;
        uint256 longTokenId;
        uint256 startTime;
        uint256 endTime;
    }

    enum Status {INITIALIZED, FINALIZED, PROCESSED}

    struct Auction {
        Status status;
        int128 strike64x64;
        int128 maxPrice64x64;
        int128 minPrice64x64;
        int128 lastPrice64x64;
        uint256 startTime;
        uint256 endTime;
        uint256 totalContracts;
        uint256 totalContractsSold;
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

    function _getAuction(Layout storage l, uint64 epoch)
        internal
        view
        returns (Auction memory)
    {
        return l.auctions[epoch];
    }

    function _getMinSize(Layout storage l) internal view returns (uint256) {
        return l.minSize;
    }

    function _getOrderById(
        Layout storage l,
        uint64 epoch,
        uint256 id
    ) internal view returns (OrderBook.Data memory) {
        OrderBook.Index storage orderbook = l.orderbooks[epoch];
        return orderbook._getOrderById(id);
    }

    function _getStatus(Layout storage l, uint64 epoch)
        internal
        view
        returns (AuctionStorage.Status)
    {
        return l.auctions[epoch].status;
    }

    function _getTotalContractsSold(Layout storage l, uint64 epoch)
        internal
        view
        returns (uint256)
    {
        return l.auctions[epoch].totalContractsSold;
    }

    function _isFinalized(Layout storage l, uint64 epoch)
        internal
        view
        returns (bool)
    {
        return l.auctions[epoch].status == Status.FINALIZED;
    }
}
