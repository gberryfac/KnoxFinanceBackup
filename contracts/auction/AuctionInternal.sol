// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@solidstate/contracts/token/ERC1155/IERC1155.sol";
import "@solidstate/contracts/token/ERC20/IERC20.sol";
import "@solidstate/contracts/token/ERC20/metadata/IERC20Metadata.sol";
import "@solidstate/contracts/utils/SafeERC20.sol";

import "../interfaces/IPremiaPool.sol";

import "../libraries/ABDKMath64x64Token.sol";
import "../libraries/Helpers.sol";

import "../vault/IVault.sol";

import "./AuctionStorage.sol";
import "./IAuctionEvents.sol";

import "hardhat/console.sol";

contract AuctionInternal is IAuctionEvents {
    using ABDKMath64x64 for int128;
    using ABDKMath64x64 for uint256;
    using ABDKMath64x64Token for int128;
    using ABDKMath64x64Token for uint256;
    using AuctionStorage for AuctionStorage.Layout;
    using EnumerableSet for EnumerableSet.UintSet;
    using Helpers for uint256;
    using OrderBook for OrderBook.Index;
    using SafeERC20 for IERC20;

    bool internal immutable isCall;
    uint8 internal immutable baseDecimals;
    uint8 internal immutable underlyingDecimals;

    IERC20 public immutable ERC20;
    IPremiaPool public immutable Pool;
    IVault public immutable Vault;

    constructor(
        bool _isCall,
        address pool,
        address vault
    ) {
        isCall = _isCall;

        Pool = IPremiaPool(pool);
        IPremiaPool.PoolSettings memory settings = Pool.getPoolSettings();
        address asset = isCall ? settings.underlying : settings.base;

        baseDecimals = IERC20Metadata(settings.base).decimals();
        underlyingDecimals = IERC20Metadata(settings.underlying).decimals();

        ERC20 = IERC20(asset);
        Vault = IVault(vault);
    }

    /************************************************
     *  ACCESS CONTROL
     ***********************************************/

    /**
     * @dev Throws if called by any account other than the vault.
     */
    modifier onlyVault() {
        AuctionStorage.Layout storage l = AuctionStorage.layout();
        require(msg.sender == l.vault, "!vault");
        _;
    }

    /**
     * @dev Throws if auction has not started.
     */
    modifier auctionHasStarted(uint64 epoch) {
        AuctionStorage.Layout storage l = AuctionStorage.layout();
        AuctionStorage.Auction storage auction = l.auctions[epoch];
        require(auction.startTime > 0, "start time is not set");
        require(block.timestamp >= auction.startTime, "auction not started");
        _;
    }

    /**
     * @dev Throws if auction has ended
     */
    modifier auctionHasNotEnded(uint64 epoch) {
        AuctionStorage.Layout storage l = AuctionStorage.layout();
        AuctionStorage.Auction storage auction = l.auctions[epoch];
        require(auction.endTime > 0, "end time is not set");
        require(block.timestamp <= auction.endTime, "auction has ended");
        _;
    }

    /**
     * @dev Throws if auction status is not "INITIALIZED"
     */
    modifier auctionInitialized(uint64 epoch) {
        AuctionStorage.Layout storage l = AuctionStorage.layout();
        AuctionStorage.Auction storage auction = l.auctions[epoch];
        require(
            AuctionStorage.Status.INITIALIZED == auction.status,
            "auction !initialized"
        );
        _;
    }

    /**
     * @dev Throws if auction status is not "FINALIZED"
     */
    modifier auctionFinalized(uint64 epoch) {
        AuctionStorage.Layout storage l = AuctionStorage.layout();
        AuctionStorage.Auction storage auction = l.auctions[epoch];
        require(
            AuctionStorage.Status.FINALIZED == auction.status,
            "auction !finalized"
        );
        _;
    }

    /**
     * @dev Throws if auction status is not "PROCESSED"
     */
    modifier auctionProcessed(uint64 epoch) {
        AuctionStorage.Layout storage l = AuctionStorage.layout();
        AuctionStorage.Auction storage auction = l.auctions[epoch];
        require(
            AuctionStorage.Status.PROCESSED == auction.status,
            "auction !processed"
        );
        _;
    }

    /**
     * @dev Throws if auction status is either "FINALIZED" or "PROCESSED"
     */
    modifier auctionNotFinalizedOrProcessed(uint64 epoch) {
        AuctionStorage.Layout storage l = AuctionStorage.layout();
        AuctionStorage.Auction storage auction = l.auctions[epoch];

        require(
            AuctionStorage.Status.FINALIZED != auction.status,
            "auction finalized"
        );

        require(
            AuctionStorage.Status.PROCESSED != auction.status,
            "auction processed"
        );
        _;
    }

    /************************************************
     *  INITIALIZATION
     ***********************************************/

    function _initialize(AuctionStorage.InitAuction memory initAuction)
        internal
    {
        AuctionStorage.Layout storage l = AuctionStorage.layout();

        require(
            initAuction.endTime > initAuction.startTime,
            "endTime <= startTime"
        );

        require(
            initAuction.startTime >= block.timestamp,
            "start time too early"
        );

        require(initAuction.strike64x64 > 0, "strike price == 0");
        require(initAuction.longTokenId > 0, "token id == 0");

        AuctionStorage.Auction storage auction = l.auctions[initAuction.epoch];

        require(
            auction.status == AuctionStorage.Status.UNINITIALIZED,
            "auction !uninitialized"
        );

        auction.status = AuctionStorage.Status.INITIALIZED;
        auction.strike64x64 = initAuction.strike64x64;
        auction.startTime = initAuction.startTime;
        auction.endTime = initAuction.endTime;
        auction.totalTime = initAuction.endTime - initAuction.startTime;
        auction.longTokenId = initAuction.longTokenId;

        emit AuctionStatus(initAuction.epoch, auction.status);
    }

    function _setAuctionPrices(
        uint64 epoch,
        int128 maxPrice64x64,
        int128 minPrice64x64
    ) internal {
        AuctionStorage.Layout storage l = AuctionStorage.layout();
        AuctionStorage.Auction storage auction = l.auctions[epoch];

        auction.maxPrice64x64 = maxPrice64x64;
        auction.minPrice64x64 = minPrice64x64;

        if (
            auction.maxPrice64x64 <= 0 ||
            auction.minPrice64x64 <= 0 ||
            auction.maxPrice64x64 <= auction.minPrice64x64
        ) {
            // cancel the auction if prices are invalid
            _finalizeAuction(epoch);
        }
    }

    /************************************************
     *  PRICING
     ***********************************************/

    // @notice
    function _lastPrice64x64(uint64 epoch) internal view returns (int128) {
        AuctionStorage.Layout storage l = AuctionStorage.layout();
        return l.auctions[epoch].lastPrice64x64;
    }

    // @notice Returns price during the auction
    function _priceCurve64x64(uint64 epoch) internal view returns (int128) {
        AuctionStorage.Layout storage l = AuctionStorage.layout();
        AuctionStorage.Auction storage auction = l.auctions[epoch];

        uint256 startTime = auction.startTime;
        uint256 totalTime = auction.totalTime;

        int128 maxPrice64x64 = auction.maxPrice64x64;
        int128 minPrice64x64 = auction.minPrice64x64;

        if (block.timestamp <= startTime) return maxPrice64x64;

        uint256 elapsed = block.timestamp - startTime;
        int128 timeRemaining64x64 = elapsed.divu(totalTime);

        int128 x = maxPrice64x64.sub(minPrice64x64);
        int128 y = timeRemaining64x64.mul(x);
        return maxPrice64x64.sub(y);
    }

    // @notice The current clearing price of the Dutch auction
    function _clearingPrice64x64(uint64 epoch) internal view returns (int128) {
        AuctionStorage.Layout storage l = AuctionStorage.layout();
        AuctionStorage.Auction storage auction = l.auctions[epoch];

        if (
            auction.status == AuctionStorage.Status.FINALIZED ||
            auction.status == AuctionStorage.Status.PROCESSED
        ) {
            return _lastPrice64x64(epoch);
        }
        return _priceCurve64x64(epoch);
    }

    /************************************************
     *  PURCHASE
     ***********************************************/

    function _addLimitOrder(
        uint64 epoch,
        int128 price64x64,
        uint256 size
    ) internal {
        AuctionStorage.Layout storage l = AuctionStorage.layout();
        AuctionStorage.Auction storage auction = l.auctions[epoch];

        require(price64x64 > 0, "price <= 0");
        require(size > l.minSize, "size < minimum");

        uint256 cost = price64x64.mulu(size);
        ERC20.safeTransferFrom(msg.sender, address(this), cost);
        l.epochsByBuyer[msg.sender].add(epoch);

        uint256 id = l.orderbooks[epoch]._insert(price64x64, size, msg.sender);

        if (block.timestamp >= auction.startTime) {
            _finalizeAuction(epoch);
        }

        emit OrderAdded(epoch, id, msg.sender, price64x64, size, true);
    }

    function _cancelLimitOrder(uint64 epoch, uint256 id) internal {
        AuctionStorage.Layout storage l = AuctionStorage.layout();
        AuctionStorage.Auction storage auction = l.auctions[epoch];

        require(id > 0, "invalid order id");

        OrderBook.Index storage orderbook = l.orderbooks[epoch];
        OrderBook.Data memory data = orderbook._getOrderById(id);

        require(data.buyer != address(0), "order does not exist");
        require(data.buyer == msg.sender, "buyer != msg.sender");

        orderbook._remove(id);
        l.epochsByBuyer[data.buyer].remove(epoch);

        if (block.timestamp >= auction.startTime) {
            _finalizeAuction(epoch);
        }

        uint256 cost = data.price64x64.mulu(data.size);
        ERC20.safeTransfer(msg.sender, cost);

        // emit LimitOrderCanceled(msg.sender, id, price64x64, size);
    }

    function _addMarketOrder(uint64 epoch, uint256 size) internal {
        AuctionStorage.Layout storage l = AuctionStorage.layout();
        AuctionStorage.Auction storage auction = l.auctions[epoch];

        require(size >= l.minSize, "size < minimum");

        int128 price64x64 = _priceCurve64x64(epoch);
        uint256 cost = price64x64.mulu(size);
        ERC20.safeTransferFrom(msg.sender, address(this), cost);

        auction.lastPrice64x64 = price64x64;
        l.epochsByBuyer[msg.sender].add(epoch);

        uint256 id = l.orderbooks[epoch]._insert(price64x64, size, msg.sender);

        _finalizeAuction(epoch);

        emit OrderAdded(epoch, id, msg.sender, price64x64, size, false);
    }

    /************************************************
     *  WITHDRAW
     ***********************************************/

    function _withdraw(uint64 epoch) internal {
        AuctionStorage.Layout storage l = AuctionStorage.layout();

        (uint256 refund, uint256 fill) =
            _previewWithdraw(l, false, epoch, msg.sender);

        l.epochsByBuyer[msg.sender].remove(epoch);

        (bool expired, uint256 exercisedAmount) =
            Vault.getExerciseAmount(epoch, fill);

        if (expired) {
            // If expired ITM, adjust refund
            if (exercisedAmount > 0) refund += exercisedAmount;
            fill = 0;
        }

        if (fill > 0) {
            Pool.safeTransferFrom(
                address(this),
                msg.sender,
                l.auctions[epoch].longTokenId,
                fill,
                ""
            );
        }

        if (refund > 0) {
            ERC20.safeTransfer(msg.sender, refund);
        }

        // emit Withdrawn()
    }

    function _previewWithdraw(uint64 epoch, address buyer)
        internal
        returns (uint256, uint256)
    {
        AuctionStorage.Layout storage l = AuctionStorage.layout();
        return _previewWithdraw(l, true, epoch, buyer);
    }

    function _previewWithdraw(
        AuctionStorage.Layout storage l,
        bool isPreview,
        uint64 epoch,
        address buyer
    ) private returns (uint256, uint256) {
        OrderBook.Index storage orderbook = l.orderbooks[epoch];
        AuctionStorage.Auction memory auction = l.auctions[epoch];

        uint256 refund;
        uint256 fill;

        int128 lastPrice64x64 = _clearingPrice64x64(epoch);

        uint256 totalContractsSold;
        uint256 next = orderbook._head();
        uint256 length = orderbook._length();

        for (uint256 i = 1; i <= length; i++) {
            OrderBook.Data memory data = orderbook._getOrderById(next);

            if (data.buyer == buyer) {
                // if lastPrice64x64 > type(int128).max, auction is cancelled, only send refund
                if (
                    lastPrice64x64 < type(int128).max &&
                    data.price64x64 >= lastPrice64x64
                ) {
                    uint256 paid = data.price64x64.mulu(data.size);
                    uint256 cost = lastPrice64x64.mulu(data.size);

                    if (
                        totalContractsSold + data.size >= auction.totalContracts
                    ) {
                        uint256 remainder =
                            auction.totalContracts - totalContractsSold;

                        cost = lastPrice64x64.mulu(remainder);
                        fill += remainder;
                    } else {
                        fill += data.size;
                    }

                    refund += paid - cost;
                } else {
                    refund += data.price64x64.mulu(data.size);
                }

                if (!isPreview) orderbook._remove(data.id);
            }

            totalContractsSold += data.size;
            next = orderbook._getNextOrder(next);
        }

        return (refund, fill);
    }

    /************************************************
     *  MAINTENANCE
     ***********************************************/

    // @notice traverses orderbook to check if the utilization is 100%
    function _processOrders(uint64 epoch) internal returns (bool) {
        AuctionStorage.Layout storage l = AuctionStorage.layout();
        OrderBook.Index storage orderbook = l.orderbooks[epoch];
        AuctionStorage.Auction storage auction = l.auctions[epoch];

        uint256 next = orderbook._head();
        uint256 length = orderbook._length();

        uint256 totalContracts = _getTotalContracts(epoch);

        if (auction.totalContracts <= 0) {
            // Sets totalContracts if this is the first bid.
            auction.totalContracts = totalContracts;
        }

        uint256 totalContractsSold;
        int128 lastPrice64x64;

        for (uint256 i = 1; i <= length; i++) {
            OrderBook.Data memory data = orderbook._getOrderById(next);

            // Check if the last "active" order has been reached
            if (data.price64x64 < _clearingPrice64x64(epoch)) break;

            // Checks if utilization >= 100%
            if (totalContractsSold + data.size >= totalContracts) {
                auction.lastPrice64x64 = data.price64x64;
                auction.totalContractsSold = totalContracts;
                return true;
            }

            totalContractsSold += data.size;
            next = orderbook._getNextOrder(next);
            lastPrice64x64 = data.price64x64;
        }

        auction.lastPrice64x64 = lastPrice64x64;
        auction.totalContractsSold = totalContractsSold;
        return false;
    }

    function _finalizeAuction(uint64 epoch) internal {
        AuctionStorage.Layout storage l = AuctionStorage.layout();
        AuctionStorage.Auction storage auction = l.auctions[epoch];

        if (
            auction.maxPrice64x64 <= 0 ||
            auction.minPrice64x64 <= 0 ||
            auction.maxPrice64x64 <= auction.minPrice64x64
        ) {
            l.auctions[epoch].lastPrice64x64 = type(int128).max;
            auction.status = AuctionStorage.Status.FINALIZED;
            emit AuctionStatus(epoch, auction.status);
        } else if (_processOrders(epoch) || block.timestamp > auction.endTime) {
            auction.status = AuctionStorage.Status.FINALIZED;
            emit AuctionStatus(epoch, auction.status);
        }
    }

    function _transferPremium(uint64 epoch) internal returns (uint256) {
        AuctionStorage.Layout storage l = AuctionStorage.layout();
        AuctionStorage.Auction storage auction = l.auctions[epoch];

        require(auction.totalPremiums <= 0, "premiums transferred");

        uint256 totalPremiums =
            _lastPrice64x64(epoch).mulu(auction.totalContractsSold);

        auction.totalPremiums = totalPremiums;
        ERC20.safeTransfer(address(Vault), totalPremiums);

        // emit PremiumTransferred()

        return auction.totalPremiums;
    }

    function _processAuction(uint64 epoch) internal {
        AuctionStorage.Layout storage l = AuctionStorage.layout();
        AuctionStorage.Auction storage auction = l.auctions[epoch];

        uint256 totalContractsSold = auction.totalContractsSold;

        if (totalContractsSold > 0) {
            uint256 longTokenId = auction.longTokenId;

            uint256 longTokenBalance =
                Pool.balanceOf(address(this), longTokenId);

            require(auction.totalPremiums > 0, "premiums not transferred");

            require(
                longTokenBalance >= totalContractsSold,
                "long tokens not transferred"
            );
        }

        auction.status = AuctionStorage.Status.PROCESSED;
        emit AuctionStatus(epoch, auction.status);
    }

    /************************************************
     *  VIEW
     ***********************************************/

    function _epochsByBuyer(address buyer)
        internal
        view
        returns (uint64[] memory)
    {
        AuctionStorage.Layout storage l = AuctionStorage.layout();
        EnumerableSet.UintSet storage epochs = l.epochsByBuyer[buyer];

        uint64[] memory epochsByBuyer = new uint64[](epochs.length());

        unchecked {
            for (uint256 i; i < epochs.length(); i++) {
                epochsByBuyer[i] = uint64(epochs.at(i));
            }
        }

        return epochsByBuyer;
    }

    function _getTotalContracts(uint64 epoch) internal view returns (uint256) {
        AuctionStorage.Layout storage l = AuctionStorage.layout();
        AuctionStorage.Auction storage auction = l.auctions[epoch];

        if (auction.totalContracts <= 0) {
            uint256 totalCollateral = Vault.totalCollateral();
            int128 strike64x64 = auction.strike64x64;

            return
                totalCollateral._fromCollateralToContracts(
                    isCall,
                    baseDecimals,
                    strike64x64
                );
        }

        return auction.totalContracts;
    }

    function _getTotalContractsSold(uint64 epoch)
        internal
        view
        returns (uint256)
    {
        AuctionStorage.Layout storage l = AuctionStorage.layout();
        return l.auctions[epoch].totalContractsSold;
    }
}
