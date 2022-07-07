// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "abdk-libraries-solidity/ABDKMath64x64.sol";

import "@solidstate/contracts/token/ERC1155/IERC1155.sol";
import "@solidstate/contracts/token/ERC20/IERC20.sol";
import "@solidstate/contracts/utils/SafeERC20.sol";

import "../interfaces/IPremiaPool.sol";

import "../vault/IVault.sol";

import "./AuctionStorage.sol";

import "hardhat/console.sol";

// TODO: Switch to stage modifiers
contract AuctionInternal {
    using ABDKMath64x64 for int128;
    using ABDKMath64x64 for uint256;
    using AuctionStorage for AuctionStorage.Layout;
    using EnumerableSet for EnumerableSet.UintSet;
    using OrderBook for OrderBook.Index;
    using SafeERC20 for IERC20;

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

        require(initAuction.minPrice64x64 > 0, "minPrice64x64 <= 0");

        require(
            initAuction.endTime > initAuction.startTime,
            "endTime < startTime"
        );

        require(
            initAuction.startTime >= block.timestamp,
            "start time too early"
        );

        l.auctions[initAuction.epoch] = AuctionStorage.Auction(
            true,
            false,
            false,
            initAuction.maxPrice64x64,
            initAuction.minPrice64x64,
            0,
            initAuction.startTime,
            initAuction.endTime,
            0,
            0,
            0,
            initAuction.endTime - initAuction.startTime,
            0
        );

        // emit AuctionInitialized();
    }

    /************************************************
     *  PRICING
     ***********************************************/

    // @notice
    function _lastPrice(uint64 epoch) internal view returns (int128) {
        AuctionStorage.Layout storage l = AuctionStorage.layout();
        return l.auctions[epoch].lastPrice64x64;
    }

    // @notice Returns price during the auction
    function _priceCurve(uint64 epoch) internal view returns (int128) {
        AuctionStorage.Layout storage l = AuctionStorage.layout();
        uint256 startTime = l.auctions[epoch].startTime;
        uint256 totalTime = l.auctions[epoch].totalTime;

        int128 maxPrice64x64 = l.auctions[epoch].maxPrice64x64;
        int128 minPrice64x64 = l.auctions[epoch].minPrice64x64;

        uint256 elapsed = block.timestamp - startTime;
        int128 timeRemaining64x64 = elapsed.divu(totalTime);

        return
            maxPrice64x64.sub(
                timeRemaining64x64.mul(maxPrice64x64.sub(minPrice64x64))
            );
    }

    // @notice The current clearing price of the Dutch auction
    function _clearingPrice(uint64 epoch) internal view returns (int128) {
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

    function _addLimitOrder(
        uint64 epoch,
        int128 price64x64,
        uint256 size
    ) internal returns (uint256) {
        // modifier: reject if auction not initialized
        // modifier: reject if auction is finalized
        AuctionStorage.Layout storage l = AuctionStorage.layout();

        require(price64x64 > 0, "price <= 0");
        require(size > l.minSize, "size < minimum");

        if (block.timestamp >= l.auctions[epoch].startTime) {
            if (_finalizeAuction(epoch)) return 0;
        }

        uint256 cost = price64x64.mulu(size);
        ERC20.safeTransferFrom(msg.sender, address(this), cost);
        l.claimsByBuyer[msg.sender].add(epoch);

        // emit OrderAdded(msg.sender, price64x64, size, true);
        return l.orderbooks[epoch]._insert(price64x64, size, msg.sender);
    }

    function _cancelLimitOrder(uint64 epoch, uint256 id) internal {
        // modifier: reject if auction not initialized
        // modifier: reject if auction is finalized
        AuctionStorage.Layout storage l = AuctionStorage.layout();

        require(id > 0, "invalid order id");

        if (block.timestamp >= l.auctions[epoch].startTime) {
            if (_finalizeAuction(epoch)) return;
        }

        OrderBook.Index storage orderbook = l.orderbooks[epoch];
        (, int128 price64x64, uint256 size, address buyer) =
            orderbook._getOrderById(id);

        require(buyer != address(0), "order does not exist");
        require(buyer == msg.sender, "buyer != msg.sender");

        orderbook._remove(id);
        l.claimsByBuyer[buyer].remove(epoch);

        uint256 cost = price64x64.mulu(size);
        ERC20.safeTransfer(msg.sender, cost);

        // emit LimitOrderCanceled(msg.sender, id, price64x64, size);
    }

    function _addOrder(uint64 epoch, uint256 size) internal returns (uint256) {
        // modifier: reject if auction not initialized
        // modifier: reject if auction is finalized
        AuctionStorage.Layout storage l = AuctionStorage.layout();

        require(size >= l.minSize, "size < minimum");
        if (_finalizeAuction(epoch)) return 0;

        uint256 totalCollateral = l.auctions[epoch].totalCollateral;
        if (totalCollateral <= 0) {
            // Initializes totalCollateral if this is the first bid.
            l.auctions[epoch].totalCollateral = Vault.totalCollateral();
        }

        int128 price64x64 = _priceCurve(epoch);
        uint256 cost = price64x64.mulu(size);
        ERC20.safeTransferFrom(msg.sender, address(this), cost);
        l.auctions[epoch].lastPrice64x64 = price64x64;

        l.claimsByBuyer[msg.sender].add(epoch);

        // emit OrderAdded(msg.sender, price64x64, size, false);
        return l.orderbooks[epoch]._insert(price64x64, size, msg.sender);
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

        int128 price64x64;
        uint256 size;

        for (uint256 i = 1; i <= length; i++) {
            (, price64x64, size, ) = orderbook._getOrderById(next);

            // Reached the last "active" order
            if (price64x64 < _clearingPrice(epoch)) break;

            if (totalCollateralUsed + size >= totalCollateral) {
                l.auctions[epoch].lastPrice64x64 = price64x64;
                l.auctions[epoch].totalCollateralUsed = totalCollateral;
                return true;
            }

            totalCollateralUsed += size;
            next = orderbook._getNextOrder(next);
        }

        l.auctions[epoch].lastPrice64x64 = price64x64;
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

        int128 lastPrice64x64 = _lastPrice(epoch);
        uint256 totalCollateralUsed = l.auctions[epoch].totalCollateralUsed;

        require(l.auctions[epoch].totalPremiums <= 0, "premiums transferred");

        uint256 totalPremiums = lastPrice64x64.mulu(totalCollateralUsed);
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
        int128 lastPrice64x64 = _lastPrice(epoch);

        uint256 totalCollateralUsed;
        uint256 totalCollateral = l.auctions[epoch].totalCollateral;

        uint256 id;
        int128 price64x64;
        uint256 size;
        address buyer;

        for (uint256 i = 1; i <= orderbook._length(); i++) {
            (id, price64x64, size, buyer) = orderbook._getOrderById(next);

            if (buyer == msg.sender) {
                if (price64x64 >= lastPrice64x64) {
                    if (totalCollateralUsed + size >= totalCollateral) {
                        uint256 remainder =
                            totalCollateral - totalCollateralUsed;

                        fill += remainder;
                        uint256 paid = price64x64.mulu(size);
                        uint256 cost = lastPrice64x64.mulu(remainder);
                        refund += paid - cost;
                    } else fill += size;
                } else refund += price64x64.mulu(size);
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

    function _getAuction(uint64 epoch)
        internal
        view
        returns (AuctionStorage.Auction memory)
    {
        return AuctionStorage.layout()._getAuction(epoch);
    }

    function _getOrderById(uint64 epoch, uint256 id)
        internal
        view
        returns (
            uint256,
            int128,
            uint256,
            address
        )
    {
        AuctionStorage.Layout storage l = AuctionStorage.layout();
        OrderBook.Index storage orderbook = l.orderbooks[epoch];
        return orderbook._getOrderById(id);
    }
}
