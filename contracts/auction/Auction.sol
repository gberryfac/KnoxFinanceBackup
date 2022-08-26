// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@solidstate/contracts/introspection/ERC165Storage.sol";
import "@solidstate/contracts/utils/ReentrancyGuard.sol";

import "../libraries/Helpers.sol";

import "./AuctionInternal.sol";
import "./IAuction.sol";

contract Auction is AuctionInternal, IAuction, ReentrancyGuard {
    using ABDKMath64x64 for int128;
    using AuctionStorage for AuctionStorage.Layout;
    using ERC165Storage for ERC165Storage.Layout;
    using SafeERC20 for IERC20;

    constructor(
        bool isCall,
        address pool,
        address vault,
        address weth
    ) AuctionInternal(isCall, pool, vault, weth) {}

    /************************************************
     *  ADMIN
     ***********************************************/

    /**
     * @inheritdoc IAuction
     */
    function setExchangeHelper(address newExchangeHelper) external onlyOwner {
        _setExchangeHelper(newExchangeHelper);
    }

    /************************************************
     *  INITIALIZE AUCTION
     ***********************************************/

    /**
     * @inheritdoc IAuction
     */
    function initialize(AuctionStorage.InitAuction memory initAuction)
        external
        onlyVault
    {
        _initialize(initAuction);
    }

    /**
     * @inheritdoc IAuction
     */
    function setAuctionPrices(
        uint64 epoch,
        int128 maxPrice64x64,
        int128 minPrice64x64
    )
        external
        auctionStatus(AuctionStorage.Status.INITIALIZED, epoch)
        onlyVault
    {
        _setAuctionPrices(epoch, maxPrice64x64, minPrice64x64);
    }

    /************************************************
     *  PRICING
     ***********************************************/

    /**
     * @inheritdoc IAuction
     */
    function lastPrice64x64(uint64 epoch) external view returns (int128) {
        return _lastPrice64x64(epoch);
    }

    /**
     * @inheritdoc IAuction
     */
    function priceCurve64x64(uint64 epoch) external view returns (int128) {
        return _priceCurve64x64(epoch);
    }

    /**
     * @inheritdoc IAuction
     */
    function clearingPrice64x64(uint64 epoch) external view returns (int128) {
        return _clearingPrice64x64(epoch);
    }

    /************************************************
     *  PURCHASE
     ***********************************************/

    /**
     * @inheritdoc IAuction
     */
    function addLimitOrder(
        uint64 epoch,
        int128 price64x64,
        uint256 size
    ) external payable limitOrdersAllowed(epoch) nonReentrant {
        AuctionStorage.Layout storage l = AuctionStorage.layout();
        uint256 cost = _validateLimitOrder(l, price64x64, size);
        uint256 credited = _wrapNativeToken(cost);
        // an approve() by the msg.sender is required beforehand
        ERC20.safeTransferFrom(msg.sender, address(this), cost - credited);
        _addOrder(l, epoch, price64x64, size, true);
    }

    /**
     * @inheritdoc IAuction
     */
    function swapAndAddLimitOrder(
        IExchangeHelper.SwapArgs calldata s,
        uint64 epoch,
        int128 price64x64,
        uint256 size
    ) external payable limitOrdersAllowed(epoch) nonReentrant {
        AuctionStorage.Layout storage l = AuctionStorage.layout();
        uint256 cost = _validateLimitOrder(l, price64x64, size);
        uint256 credited = _swapForPoolTokens(l.Exchange, s, address(ERC20));
        _transferAssets(credited, cost, msg.sender);
        _addOrder(l, epoch, price64x64, size, true);
    }

    /**
     * @inheritdoc IAuction
     */
    function cancelLimitOrder(uint64 epoch, uint256 id)
        external
        limitOrdersAllowed(epoch)
        nonReentrant
    {
        _cancelLimitOrder(epoch, id);
    }

    /**
     * @inheritdoc IAuction
     */
    function addMarketOrder(
        uint64 epoch,
        uint256 size,
        uint256 maxCost
    ) external payable marketOrdersAllowed(epoch) nonReentrant {
        AuctionStorage.Layout storage l = AuctionStorage.layout();

        (int128 price64x64, uint256 cost) =
            _validateMarketOrder(l, epoch, size, maxCost);

        uint256 credited = _wrapNativeToken(cost);
        // an approve() by the msg.sender is required beforehand
        ERC20.safeTransferFrom(msg.sender, address(this), cost - credited);
        _addOrder(l, epoch, price64x64, size, false);
    }

    /**
     * @inheritdoc IAuction
     */
    function swapAndAddMarketOrder(
        IExchangeHelper.SwapArgs calldata s,
        uint64 epoch,
        uint256 size,
        uint256 maxCost
    ) external payable marketOrdersAllowed(epoch) nonReentrant {
        AuctionStorage.Layout storage l = AuctionStorage.layout();

        (int128 price64x64, uint256 cost) =
            _validateMarketOrder(l, epoch, size, maxCost);

        uint256 credited = _swapForPoolTokens(l.Exchange, s, address(ERC20));
        _transferAssets(credited, cost, msg.sender);
        _addOrder(l, epoch, price64x64, size, false);
    }

    /************************************************
     *  WITHDRAW
     ***********************************************/

    /**
     * @inheritdoc IAuction
     */
    function withdraw(uint64 epoch)
        external
        auctionStatus(AuctionStorage.Status.PROCESSED, epoch)
        nonReentrant
    {
        _withdraw(epoch);
    }

    /**
     * @inheritdoc IAuction
     */
    function previewWithdraw(uint64 epoch) external returns (uint256, uint256) {
        return _previewWithdraw(epoch, msg.sender);
    }

    /**
     * @inheritdoc IAuction
     */
    function previewWithdraw(uint64 epoch, address buyer)
        external
        returns (uint256, uint256)
    {
        return _previewWithdraw(epoch, buyer);
    }

    /************************************************
     *  FINALIZE AUCTION
     ***********************************************/

    /**
     * @inheritdoc IAuction
     */
    function finalizeAuction(uint64 epoch)
        external
        auctionNotFinalizedOrProcessed(epoch)
        auctionHasStarted(epoch)
    {
        _finalizeAuction(epoch);
    }

    /**
     * @inheritdoc IAuction
     */
    function transferPremium(uint64 epoch)
        external
        auctionStatus(AuctionStorage.Status.FINALIZED, epoch)
        onlyVault
        returns (uint256)
    {
        return _transferPremium(epoch);
    }

    /**
     * @inheritdoc IAuction
     */
    function processAuction(uint64 epoch)
        external
        auctionStatus(AuctionStorage.Status.FINALIZED, epoch)
        onlyVault
    {
        _processAuction(epoch);
    }

    /************************************************
     *  VIEW
     ***********************************************/

    /**
     * @inheritdoc IAuction
     */
    function epochsByBuyer(address buyer)
        external
        view
        returns (uint64[] memory)
    {
        return _epochsByBuyer(buyer);
    }

    /**
     * @inheritdoc IAuction
     */
    function getAuction(uint64 epoch)
        external
        view
        returns (AuctionStorage.Auction memory)
    {
        return AuctionStorage._getAuction(epoch);
    }

    /**
     * @inheritdoc IAuction
     */
    function getMinSize() external view returns (uint256) {
        return AuctionStorage._getMinSize();
    }

    /**
     * @inheritdoc IAuction
     */
    function getOrderById(uint64 epoch, uint256 id)
        external
        view
        returns (OrderBook.Data memory)
    {
        return AuctionStorage._getOrderById(epoch, id);
    }

    /**
     * @inheritdoc IAuction
     */
    function getStatus(uint64 epoch)
        external
        view
        returns (AuctionStorage.Status)
    {
        return AuctionStorage._getStatus(epoch);
    }

    /**
     * @inheritdoc IAuction
     */
    function getTotalContracts(uint64 epoch) external view returns (uint256) {
        return _getTotalContracts(epoch);
    }

    /**
     * @inheritdoc IAuction
     */
    function getTotalContractsSold(uint64 epoch)
        external
        view
        returns (uint256)
    {
        return AuctionStorage._getTotalContractsSold(epoch);
    }

    /**
     * @inheritdoc IAuction
     */
    function isFinalized(uint64 epoch) external view returns (bool) {
        return AuctionStorage._isFinalized(epoch);
    }

    /************************************************
     *  ERC165 SUPPORT
     ***********************************************/

    function supportsInterface(bytes4 interfaceId)
        external
        view
        returns (bool)
    {
        return ERC165Storage.layout().isSupportedInterface(interfaceId);
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
