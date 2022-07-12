// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../access/Access.sol";

import "./AuctionInternal.sol";
import "./IAuction.sol";

// TODO: Switch to stage modifiers
contract Auction is Access, AuctionInternal, IAuction {
    constructor(
        bool isCall,
        address pool,
        address vault
    ) AuctionInternal(isCall, pool, vault) {}

    function initialize(AuctionStorage.InitAuction memory initAuction)
        external
        onlyVault
    {
        _initialize(initAuction);
    }

    function setAuctionPrices(
        uint64 epoch,
        int128 maxPrice64x64,
        int128 minPrice64x64
    ) external onlyVault {
        _setAuctionPrices(epoch, maxPrice64x64, minPrice64x64);
    }

    /************************************************
     *  PRICING
     ***********************************************/

    // @notice
    function lastPrice64x64(uint64 epoch) external view returns (int128) {
        return _lastPrice64x64(epoch);
    }

    // @notice
    function priceCurve64x64(uint64 epoch) external view returns (int128) {
        return _priceCurve64x64(epoch);
    }

    // @notice
    function clearingPrice64x64(uint64 epoch) external view returns (int128) {
        return _clearingPrice64x64(epoch);
    }

    /************************************************
     *  AUCTION ORDER
     ***********************************************/

    // @notice
    function addLimitOrder(
        uint64 epoch,
        int128 price64x64,
        uint256 size
    ) external nonReentrant {
        return _addLimitOrder(epoch, price64x64, size);
    }

    // @notice
    function cancelLimitOrder(uint64 epoch, uint256 id) external nonReentrant {
        _cancelLimitOrder(epoch, id);
    }

    // @notice
    // @dev must approve contract prior to committing tokens to auction
    function addMarketOrder(uint64 epoch, uint256 size) external nonReentrant {
        return _addMarketOrder(epoch, size);
    }

    /************************************************
     *  MAINTENANCE
     ***********************************************/

    function processOrders(uint64 epoch) external returns (bool) {
        return _processOrders(epoch);
    }

    function finalizeAuction(uint64 epoch) external returns (bool) {
        return _finalizeAuction(epoch);
    }

    function transferPremium(uint64 epoch) external {
        _transferPremium(epoch);
    }

    function processAuction(uint64 epoch) external {
        _processAuction(epoch);
    }

    /************************************************
     *  WITHDRAW
     ***********************************************/

    function withdraw(uint64 epoch) external {
        _withdraw(epoch);
    }

    function previewWithdraw(uint64 epoch) external returns (uint256, uint256) {
        return _previewWithdraw(epoch);
    }

    /************************************************
     *  VIEW
     ***********************************************/

    function isFinalized(uint64 epoch) external view returns (bool) {
        return _isFinalized(epoch);
    }

    function status(uint64 epoch)
        external
        view
        returns (AuctionStorage.Status)
    {
        return _status(epoch);
    }

    function totalContracts(uint64 epoch) external view returns (uint256) {
        return _totalContracts(epoch);
    }

    function totalContractsSold(uint64 epoch) external view returns (uint256) {
        return _totalContractsSold(epoch);
    }

    function claimsByBuyer(address buyer)
        external
        view
        returns (uint64[] memory)
    {
        return _claimsByBuyer(buyer);
    }

    function getAuction(uint64 epoch)
        external
        view
        returns (AuctionStorage.Auction memory)
    {
        return _getAuction(epoch);
    }

    function getOrderById(uint64 epoch, uint256 id)
        external
        view
        returns (OrderBook.Data memory)
    {
        return _getOrderById(epoch, id);
    }

    /************************************************
     *  ERC1155 SUPPORT
     ***********************************************/

    function onERC1155Received(
        address,
        address,
        uint256,
        uint256,
        bytes memory
    ) external pure returns (bytes4) {
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address,
        address,
        uint256[] memory,
        uint256[] memory,
        bytes memory
    ) external pure returns (bytes4) {
        return this.onERC1155BatchReceived.selector;
    }
}
