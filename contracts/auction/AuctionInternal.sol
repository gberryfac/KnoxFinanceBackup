// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@solidstate/contracts/access/ownable/OwnableInternal.sol";
import "@solidstate/contracts/token/ERC1155/IERC1155.sol";
import "@solidstate/contracts/token/ERC20/IERC20.sol";
import "@solidstate/contracts/token/ERC20/metadata/IERC20Metadata.sol";
import "@solidstate/contracts/utils/IWETH.sol";
import "@solidstate/contracts/utils/SafeERC20.sol";

import "../interfaces/IPremiaPool.sol";

import "../libraries/ABDKMath64x64Token.sol";
import "../libraries/Helpers.sol";

import "../vault/IVault.sol";

import "./AuctionStorage.sol";
import "./IAuctionEvents.sol";

import "hardhat/console.sol";

contract AuctionInternal is IAuctionEvents, OwnableInternal {
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
    IWETH public immutable WETH;

    constructor(
        bool _isCall,
        address pool,
        address vault,
        address weth
    ) {
        isCall = _isCall;

        Pool = IPremiaPool(pool);
        IPremiaPool.PoolSettings memory settings = Pool.getPoolSettings();
        address asset = isCall ? settings.underlying : settings.base;

        baseDecimals = IERC20Metadata(settings.base).decimals();
        underlyingDecimals = IERC20Metadata(settings.underlying).decimals();

        ERC20 = IERC20(asset);
        Vault = IVault(vault);
        WETH = IWETH(weth);
    }

    /************************************************
     *  ACCESS CONTROL
     ***********************************************/

    /**
     * @dev Throws if called by any account other than the vault.
     */
    modifier onlyVault() {
        AuctionStorage.Layout storage l = AuctionStorage.layout();
        require(msg.sender == address(Vault), "!vault");
        _;
    }

    /**
     * @dev Throws if auction finalization is not allowed
     */
    function _finalizeAuctionAllowed(AuctionStorage.Auction storage auction)
        internal
        view
    {
        _auctionNotFinalizedOrProcessed(auction.status);
        _auctionHasStarted(auction);
    }

    /**
     * @dev Throws if limit orders are not allowed
     */
    function _limitOrdersAllowed(AuctionStorage.Auction storage auction)
        internal
        view
    {
        _auctionNotFinalizedOrProcessed(auction.status);
        _auctionHasNotEnded(auction);
    }

    /**
     * @dev Throws if market orders are not allowed
     */
    function _marketOrdersAllowed(AuctionStorage.Auction storage auction)
        internal
        view
    {
        _auctionNotFinalizedOrProcessed(auction.status);
        _auctionHasStarted(auction);
        _auctionHasNotEnded(auction);
    }

    /**
     * @dev Throws if auction has not started.
     */
    function _auctionHasStarted(AuctionStorage.Auction storage auction)
        private
        view
    {
        require(auction.startTime > 0, "start time is not set");
        require(block.timestamp >= auction.startTime, "auction not started");
    }

    /**
     * @dev Throws if auction has ended.
     */
    function _auctionHasNotEnded(AuctionStorage.Auction storage auction)
        private
        view
    {
        require(auction.endTime > 0, "end time is not set");
        require(block.timestamp <= auction.endTime, "auction has ended");
    }

    /**
     * @dev Throws if auction has been finalized or processed.
     */
    function _auctionNotFinalizedOrProcessed(AuctionStorage.Status status)
        private
        pure
    {
        require(
            AuctionStorage.Status.FINALIZED != status,
            "status == finalized"
        );
        require(
            AuctionStorage.Status.PROCESSED != status,
            "status == processed"
        );
    }

    /************************************************
     *  PRICING
     ***********************************************/

    function _lastPrice64x64(AuctionStorage.Auction storage auction)
        internal
        view
        returns (int128)
    {
        return auction.lastPrice64x64;
    }

    function _priceCurve64x64(AuctionStorage.Auction storage auction)
        internal
        view
        returns (int128)
    {
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

    function _clearingPrice64x64(AuctionStorage.Auction storage auction)
        internal
        view
        returns (int128)
    {
        if (
            auction.status == AuctionStorage.Status.FINALIZED ||
            auction.status == AuctionStorage.Status.PROCESSED
        ) {
            return _lastPrice64x64(auction);
        }
        return _priceCurve64x64(auction);
    }

    /************************************************
     *  WITHDRAW
     ***********************************************/

    function _withdraw(AuctionStorage.Layout storage l, uint64 epoch) internal {
        (uint256 refund, uint256 fill) = _previewWithdraw(
            l,
            false,
            epoch,
            msg.sender
        );

        l.epochsByBuyer[msg.sender].remove(epoch);

        (bool expired, uint256 exercisedAmount) = _getExerciseAmount(
            l,
            epoch,
            fill
        );

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

        emit OrderWithdrawn(epoch, msg.sender, refund, fill);
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
        AuctionStorage.Auction storage auction = l.auctions[epoch];
        OrderBook.Index storage orderbook = l.orderbooks[epoch];

        uint256 refund;
        uint256 fill;

        int128 lastPrice64x64 = _clearingPrice64x64(auction);

        uint256 totalContractsSold;
        uint256 next = orderbook._head();
        uint256 length = orderbook._length();

        for (uint256 i = 1; i <= length; i++) {
            OrderBook.Data memory data = orderbook._getOrderById(next);
            next = orderbook._getNextOrder(next);

            if (data.buyer == buyer) {
                // if lastPrice64x64 == type(int128).max, auction is cancelled, only send refund
                if (
                    lastPrice64x64 < type(int128).max &&
                    data.price64x64 >= lastPrice64x64
                ) {
                    uint256 paid = data.price64x64.mulu(data.size);
                    uint256 cost = lastPrice64x64.mulu(data.size);

                    if (
                        totalContractsSold + data.size >= auction.totalContracts
                    ) {
                        uint256 remainder = auction.totalContracts -
                            totalContractsSold;

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
        }

        return (refund, fill);
    }

    /************************************************
     *  FINALIZE AUCTION
     ***********************************************/

    function _processOrders(AuctionStorage.Layout storage l, uint64 epoch)
        private
        returns (bool)
    {
        OrderBook.Index storage orderbook = l.orderbooks[epoch];
        AuctionStorage.Auction storage auction = l.auctions[epoch];

        uint256 next = orderbook._head();
        uint256 length = orderbook._length();

        uint256 totalContracts = _getTotalContracts(auction);

        if (auction.totalContracts <= 0) {
            // sets totalContracts if this is the first bid.
            auction.totalContracts = totalContracts;
        }

        uint256 totalContractsSold;
        int128 lastPrice64x64;

        for (uint256 i = 1; i <= length; i++) {
            OrderBook.Data memory data = orderbook._getOrderById(next);

            // check if the last "active" order has been reached
            if (data.price64x64 < _clearingPrice64x64(auction)) break;

            // checks if utilization >= 100%
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

    function _finalizeAuction(
        AuctionStorage.Layout storage l,
        AuctionStorage.Auction storage auction,
        uint64 epoch
    ) internal {
        if (
            auction.maxPrice64x64 <= 0 ||
            auction.minPrice64x64 <= 0 ||
            auction.maxPrice64x64 <= auction.minPrice64x64
        ) {
            l.auctions[epoch].lastPrice64x64 = type(int128).max;
            auction.status = AuctionStorage.Status.FINALIZED;
            emit AuctionStatusSet(epoch, auction.status);
        } else if (
            _processOrders(l, epoch) || block.timestamp > auction.endTime
        ) {
            auction.status = AuctionStorage.Status.FINALIZED;
            emit AuctionStatusSet(epoch, auction.status);
        }
    }

    /************************************************
     *  VIEW
     ***********************************************/

    function _getTotalContracts(AuctionStorage.Auction storage auction)
        internal
        view
        returns (uint256)
    {
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

    /************************************************
     *  PURCHASE HELPERS
     ***********************************************/

    function _validateLimitOrder(
        AuctionStorage.Layout storage l,
        int128 price64x64,
        uint256 size
    ) internal view returns (uint256) {
        require(price64x64 > 0, "price <= 0");
        require(size >= l.minSize, "size < minimum");

        uint256 cost = price64x64.mulu(size);
        return cost;
    }

    function _validateMarketOrder(
        AuctionStorage.Layout storage l,
        AuctionStorage.Auction storage auction,
        uint256 size,
        uint256 maxCost
    ) internal view returns (int128, uint256) {
        require(size >= l.minSize, "size < minimum");

        int128 price64x64 = _priceCurve64x64(auction);
        uint256 cost = price64x64.mulu(size);

        require(maxCost >= cost, "cost > maxCost");
        return (price64x64, cost);
    }

    function _transferAssets(
        uint256 credited,
        uint256 cost,
        address receiver
    ) internal {
        if (credited > cost) {
            // refund buyer1 the amount overpaid
            ERC20.safeTransfer(receiver, credited - cost);
        } else if (cost > credited) {
            // an approve() by the msg.sender is required beforehand
            ERC20.safeTransferFrom(receiver, address(this), cost - credited);
        }
    }

    function _addOrder(
        AuctionStorage.Layout storage l,
        AuctionStorage.Auction storage auction,
        uint64 epoch,
        int128 price64x64,
        uint256 size,
        bool isLimitOrder
    ) internal {
        l.epochsByBuyer[msg.sender].add(epoch);

        uint256 id = l.orderbooks[epoch]._insert(price64x64, size, msg.sender);

        if (block.timestamp >= auction.startTime) {
            _finalizeAuction(l, auction, epoch);
        }

        emit OrderAdded(epoch, id, msg.sender, price64x64, size, isLimitOrder);
    }

    function _wrapNativeToken(uint256 amount) internal returns (uint256) {
        uint256 credit;

        if (msg.value > 0) {
            require(
                address(ERC20) == address(WETH),
                "collateral token != wETH"
            );

            if (msg.value > amount) {
                unchecked {
                    (bool success, ) = payable(msg.sender).call{
                        value: msg.value - amount
                    }("");

                    require(success, "ETH refund failed");

                    credit = amount;
                }
            } else {
                credit = msg.value;
            }

            WETH.deposit{value: credit}();
        }

        return credit;
    }

    function _swapForPoolTokens(
        IExchangeHelper Exchange,
        IExchangeHelper.SwapArgs calldata s,
        address tokenOut
    ) internal returns (uint256) {
        if (msg.value > 0) {
            require(s.tokenIn == address(WETH), "tokenIn != wETH");
            WETH.deposit{value: msg.value}();
            WETH.transfer(address(Exchange), msg.value);
        }

        if (s.amountInMax > 0) {
            IERC20(s.tokenIn).safeTransferFrom(
                msg.sender,
                address(Exchange),
                s.amountInMax
            );
        }

        uint256 amountCredited = Exchange.swapWithToken(
            s.tokenIn,
            tokenOut,
            s.amountInMax + msg.value,
            s.callee,
            s.allowanceTarget,
            s.data,
            s.refundAddress
        );

        require(
            amountCredited >= s.amountOutMin,
            "not enough output from trade"
        );

        return amountCredited;
    }

    /************************************************
     * HELPERS
     ***********************************************/

    /**
     * @notice calculates the expected proceeds of the option if it has expired
     * @param epoch epoch id
     * @param size amount of contracts
     * @return true if the option has expired, the exercise amount.
     */
    function _getExerciseAmount(
        AuctionStorage.Layout storage l,
        uint64 epoch,
        uint256 size
    ) private view returns (bool, uint256) {
        AuctionStorage.Auction storage auction = l.auctions[epoch];

        uint64 expiry = auction.expiry;
        int128 strike64x64 = auction.strike64x64;

        if (block.timestamp < expiry) return (false, 0);

        int128 spot64x64 = Pool.getPriceAfter64x64(expiry);
        uint256 amount;

        if (isCall && spot64x64 > strike64x64) {
            amount = spot64x64.sub(strike64x64).div(spot64x64).mulu(size);
        } else if (!isCall && strike64x64 > spot64x64) {
            uint256 value = strike64x64.sub(spot64x64).mulu(size);
            amount = ABDKMath64x64Token.toBaseTokenAmount(
                underlyingDecimals,
                baseDecimals,
                value
            );
        }

        return (true, amount);
    }
}
