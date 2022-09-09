// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@solidstate/contracts/utils/EnumerableSet.sol";

import "../exchange/IExchangeHelper.sol";

import "./OrderBook.sol";

library AuctionStorage {
    using OrderBook for OrderBook.Index;

    struct InitAuction {
        uint64 epoch;
        uint64 expiry;
        int128 strike64x64;
        uint256 longTokenId;
        uint256 startTime;
        uint256 endTime;
    }

    enum Status {UNINITIALIZED, INITIALIZED, FINALIZED, PROCESSED}

    struct Auction {
        Status status;
        uint64 expiry;
        int128 strike64x64;
        int128 maxPrice64x64;
        int128 minPrice64x64;
        int128 lastPrice64x64;
        uint256 startTime;
        uint256 endTime;
        uint256 processedTime;
        uint256 totalContracts;
        uint256 totalContractsSold;
        uint256 totalPremiums;
        uint256 totalTime;
        uint256 longTokenId;
    }

    struct Layout {
        IExchangeHelper Exchange;
        uint256 minSize;
        mapping(uint64 => Auction) auctions;
        mapping(uint64 => OrderBook.Index) orderbooks;
        mapping(address => EnumerableSet.UintSet) epochsByBuyer;
    }

    bytes32 internal constant STORAGE_SLOT =
        keccak256("knox.contracts.storage.Auction");

    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            l.slot := slot
        }
    }

    /************************************************
     *  VIEW
     ***********************************************/

    function _getAuction(uint64 epoch) internal view returns (Auction memory) {
        return layout().auctions[epoch];
    }

    function _getMinSize() internal view returns (uint256) {
        return layout().minSize;
    }

    function _getOrderById(uint64 epoch, uint256 id)
        internal
        view
        returns (OrderBook.Data memory)
    {
        OrderBook.Index storage orderbook = layout().orderbooks[epoch];
        return orderbook._getOrderById(id);
    }

    function _getStatus(uint64 epoch)
        internal
        view
        returns (AuctionStorage.Status)
    {
        return layout().auctions[epoch].status;
    }

    function _getTotalContractsSold(uint64 epoch)
        internal
        view
        returns (uint256)
    {
        return layout().auctions[epoch].totalContractsSold;
    }

    function _isFinalized(uint64 epoch) internal view returns (bool) {
        return layout().auctions[epoch].status == Status.FINALIZED;
    }
}
