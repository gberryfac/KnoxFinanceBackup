// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "abdk-libraries-solidity/ABDKMath64x64.sol";

import "@solidstate/contracts/token/ERC1155/IERC1155.sol";
import "@solidstate/contracts/token/ERC20/IERC20.sol";
import "@solidstate/contracts/utils/SafeERC20.sol";

import "../interfaces/IPremiaPool.sol";

import "../vault/IVault.sol";

import "./AuctionStorage.sol";

// TODO: Switch to stage modifiers
contract AuctionInternal {
    using ABDKMath64x64 for int128;
    using ABDKMath64x64 for uint256;
    using EnumerableSet for EnumerableSet.UintSet;
    using OrderBook for OrderBook.Index;
    using SafeERC20 for IERC20;
    using AuctionStorage for AuctionStorage.Layout;

    IERC20 public immutable ERC20;
    IPremiaPool public immutable Pool;
    IVault public immutable Vault;

    constructor(
        bool isCall,
        address pool,
        address vault
    ) {
        Pool = IPremiaPool(pool);
        IPremiaPool.PoolSettings memory settings = Pool.getPoolSettings();
        address asset = isCall ? settings.underlying : settings.base;

        ERC20 = IERC20(asset);
        Vault = IVault(vault);
    }

    function _initialize(AuctionStorage.InitAuction memory initAuction)
        internal
    {
        // TODO: Input validation
        AuctionStorage.Layout storage l = AuctionStorage.layout();

        require(
            !l.auctions[initAuction.epoch].initialized,
            "auction already initialized"
        );

        require(initAuction.minPrice > 0, "minPrice <= 0");

        require(
            initAuction.endTime > initAuction.startTime,
            "endTime < startTime"
        );

        require(
            block.timestamp > initAuction.startTime,
            "start time too early"
        );

        l.auctions[initAuction.epoch] = AuctionStorage.Auction(
            true,
            false,
            false,
            initAuction.startTime,
            initAuction.endTime,
            initAuction.maxPrice,
            initAuction.minPrice,
            initAuction.minSize,
            0,
            0,
            0,
            initAuction.endTime - initAuction.startTime,
            0,
            0
        );

        // emit AuctionInitialized();
    }

    /************************************************
     *  PRICING
     ***********************************************/

    // @notice
    function _lastPrice(uint64 epoch) internal view returns (uint256) {
        AuctionStorage.Layout storage l = AuctionStorage.layout();
        return l.auctions[epoch].lastPrice;
    }

    // @notice Returns price during the auction
    function _priceCurve(uint64 epoch) internal view returns (uint256) {
        AuctionStorage.Layout storage l = AuctionStorage.layout();
        uint256 startTime = l.auctions[epoch].startTime;
        uint256 totalTime = l.auctions[epoch].totalTime;

        uint256 maxPrice = l.auctions[epoch].maxPrice;
        uint256 minPrice = l.auctions[epoch].minPrice;

        uint256 elapsed = block.timestamp - startTime;
        int128 timeRemaining = elapsed.divu(totalTime);

        return maxPrice - timeRemaining.mulu(maxPrice - minPrice);
    }

    // @notice The current clearing price of the Dutch auction
    function _clearingPrice(uint64 epoch) internal view returns (uint256) {
        AuctionStorage.Layout storage l = AuctionStorage.layout();
        return
            l.auctions[epoch].finalized
                ? _lastPrice(epoch)
                : _priceCurve(epoch);
    }

    /************************************************
     *  AUCTION ORDER
     ***********************************************/

    event OrderAdded(
        address indexed buyer,
        uint256 price,
        uint256 size,
        bool isLimitOrder
    );

    // TODO: add _addLimitOrderFor()
    // TODO: add _cancelLimitOrderFor()
    // TODO: add _addOrderFor()
    // TODO: add _withdrawOrderFor()

    function _addLimitOrder(
        uint64 epoch,
        uint256 price,
        uint256 size
    ) internal returns (uint256) {
        // modifier: reject if auction not initialized
        // modifier: reject if auction is finalized
        AuctionStorage.Layout storage l = AuctionStorage.layout();
        require(size > l.auctions[epoch].minSize, "size < minimum");

        if (block.timestamp >= l.auctions[epoch].startTime) {
            if (_finalizeAuction(epoch)) return 0;
        }

        uint256 cost = price * size;
        ERC20.safeTransferFrom(msg.sender, address(this), cost);
        l.claimsByBuyer[msg.sender].add(epoch);

        emit OrderAdded(msg.sender, price, size, true);
        return l.orderbooks[epoch]._insert(price, size, msg.sender);
    }

    function _cancelLimitOrder(uint64 epoch, uint256 id)
        internal
        returns (bool)
    {
        // modifier: reject if auction not initialized
        // modifier: reject if auction is finalized
        AuctionStorage.Layout storage l = AuctionStorage.layout();
        if (block.timestamp >= l.auctions[epoch].startTime) {
            if (_finalizeAuction(epoch)) return false;
        }

        OrderBook.Index storage orderbook = l.orderbooks[epoch];
        (, uint256 price, uint256 size, address buyer) =
            orderbook._getOrder(id);

        if (buyer != msg.sender) return false;

        uint256 cost = price * size;
        ERC20.safeTransfer(msg.sender, cost);
        l.claimsByBuyer[buyer].remove(epoch);

        // emit LimitOrderCanceled(msg.sender, id, price, size);
        return orderbook._remove(id);
    }

    function _addOrder(uint64 epoch, uint256 size) internal returns (uint256) {
        // modifier: reject if auction not initialized
        // modifier: reject if auction is finalized
        AuctionStorage.Layout storage l = AuctionStorage.layout();

        require(size >= l.auctions[epoch].minSize, "size < minimum");
        if (_finalizeAuction(epoch)) return 0;

        uint256 totalCollateral = l.auctions[epoch].totalCollateral;
        if (totalCollateral <= 0) {
            // Initializes totalCollateral if this is the first bid.
            l.auctions[epoch].totalCollateral = Vault.totalCollateral();
        }

        uint256 price = _priceCurve(epoch);
        uint256 cost = price * size;
        ERC20.safeTransferFrom(msg.sender, address(this), cost);
        l.auctions[epoch].lastPrice = price;

        l.claimsByBuyer[msg.sender].add(epoch);

        emit OrderAdded(msg.sender, price, size, false);
        return l.orderbooks[epoch]._insert(price, size, msg.sender);
    }

    /************************************************
     *  MAINTENANCE
     ***********************************************/

    // @notice traverses orderbook to check if the utilization is 100%
    function _processOrders(uint64 epoch) internal returns (bool) {
        // modifier: reject if auction not initialized
        // modifier: reject if auction has not started
        // modifier: reject if auction is finalized
        AuctionStorage.Layout storage l = AuctionStorage.layout();
        OrderBook.Index storage orderbook = l.orderbooks[epoch];

        uint256 next = orderbook._head();
        uint256 length = orderbook._length();

        uint256 totalCollateralUsed;
        uint256 totalCollateral = l.auctions[epoch].totalCollateral;

        uint256 price;
        uint256 size;

        for (uint256 i = 1; i <= length; i++) {
            (, price, size, ) = orderbook._getOrder(next);

            // Reached the last "active" order
            if (price < _clearingPrice(epoch)) break;

            if (totalCollateralUsed + size >= totalCollateral) {
                l.auctions[epoch].lastPrice = price;
                l.auctions[epoch].totalCollateralUsed = totalCollateral;
                return true;
            }

            totalCollateralUsed += size;
            next = orderbook._getNextOrder(next);
        }

        l.auctions[epoch].lastPrice = price;
        l.auctions[epoch].totalCollateralUsed = totalCollateralUsed;
        return false;
    }

    function _finalizeAuction(uint64 epoch) internal returns (bool) {
        // modifier: reject if auction not initialized
        // modifier: reject if auction has not started
        // modifier: reject if auction is finalized
        AuctionStorage.Layout storage l = AuctionStorage.layout();

        if (
            _processOrders(epoch) || block.timestamp > l.auctions[epoch].endTime
        ) {
            l.auctions[epoch].finalized = true;
            return true;
        }
        return false;
    }

    function _transferPremium(uint64 epoch) internal {
        // modifier: reject if auction is not finalized
        // modifier: reject if auction is processed
        AuctionStorage.Layout storage l = AuctionStorage.layout();

        uint256 lastPrice = _lastPrice(epoch);
        uint256 totalCollateralUsed = l.auctions[epoch].totalCollateralUsed;

        require(l.auctions[epoch].totalPremiums <= 0, "premiums transferred");

        uint256 totalPremiums = lastPrice * totalCollateralUsed;
        l.auctions[epoch].totalPremiums = totalPremiums;

        ERC20.safeTransfer(address(Vault), totalPremiums);
    }

    function _setLongTokenId(uint64 epoch, uint256 longTokenId) internal {
        // modifier: reject if auction is not finalized
        // modifier: reject if auction is processed
        AuctionStorage.Layout storage l = AuctionStorage.layout();
        require(l.auctions[epoch].longTokenId != 0);
        l.auctions[epoch].longTokenId = longTokenId;
    }

    function _processAuction(uint64 epoch) internal {
        // modifier: reject if auction is not finalized
        // modifier: reject if auction is processed
        AuctionStorage.Layout storage l = AuctionStorage.layout();

        uint256 totalCollateralUsed = l.auctions[epoch].totalCollateralUsed;

        if (totalCollateralUsed > 0) {
            uint256 longTokenId = l.auctions[epoch].longTokenId;
            uint256 longTokenBalance =
                Pool.balanceOf(address(this), longTokenId);

            require(
                l.auctions[epoch].totalPremiums > 0,
                "premiums not transferred"
            );

            require(l.auctions[epoch].longTokenId > 0, "long token id not set");

            require(
                longTokenBalance >= totalCollateralUsed,
                "long tokens not transferred"
            );
        }

        l.auctions[epoch].processed = true;
    }

    /************************************************
     *  WITHDRAW
     ***********************************************/

    function _withdraw(uint64 epoch) internal {
        // modifier: reject if auction is not processed
        AuctionStorage.Layout storage l = AuctionStorage.layout();

        (uint256 refund, uint256 fill) = _getWithdrawAmounts(epoch);

        l.claimsByBuyer[msg.sender].remove(epoch);

        (bool expired, uint256 intrinsicValue) =
            Vault.getIntrinsicValue(epoch, fill);

        if (expired) {
            // If expired ITM, adjust refund
            if (intrinsicValue > 0) refund += intrinsicValue;
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

    function _getWithdrawAmounts(uint64 epoch)
        private
        returns (uint256, uint256)
    {
        AuctionStorage.Layout storage l = AuctionStorage.layout();
        OrderBook.Index storage orderbook = l.orderbooks[epoch];

        uint256 refund;
        uint256 fill;

        uint256 next = orderbook._head();
        uint256 lastPrice = _lastPrice(epoch);

        uint256 totalCollateralUsed;
        uint256 totalCollateral = l.auctions[epoch].totalCollateral;

        uint256 id;
        uint256 price;
        uint256 size;
        address buyer;

        for (uint256 i = 1; i <= orderbook._length(); i++) {
            (id, price, size, buyer) = orderbook._getOrder(next);

            if (buyer == msg.sender) {
                if (price >= lastPrice) {
                    if (totalCollateralUsed + size >= totalCollateral) {
                        uint256 remainder =
                            totalCollateral - totalCollateralUsed;

                        fill += remainder;
                        uint256 paid = price * size;
                        uint256 cost = lastPrice * remainder;
                        refund += paid - cost;
                    } else fill += size;
                } else refund += price * size;
            }

            totalCollateralUsed += size;

            next = orderbook._getNextOrder(next);
            orderbook._remove(id);
        }

        return (refund, fill);
    }

    /************************************************
     *  VIEW
     ***********************************************/

    function _isFinalized(uint64 epoch) internal view returns (bool) {
        AuctionStorage.Layout storage l = AuctionStorage.layout();
        return l.auctions[epoch].finalized;
    }

    function _totalCollateralUsed(uint64 epoch)
        internal
        view
        returns (uint256)
    {
        AuctionStorage.Layout storage l = AuctionStorage.layout();
        return l.auctions[epoch].totalCollateralUsed;
    }

    function _claimsByBuyer(address buyer)
        internal
        view
        returns (uint64[] memory)
    {
        AuctionStorage.Layout storage l = AuctionStorage.layout();
        EnumerableSet.UintSet storage epochs = l.claimsByBuyer[buyer];

        uint64[] memory claims = new uint64[](epochs.length());

        unchecked {
            for (uint256 i; i < epochs.length(); i++) {
                claims[i] = uint64(epochs.at(i));
            }
        }

        return claims;
    }
}
