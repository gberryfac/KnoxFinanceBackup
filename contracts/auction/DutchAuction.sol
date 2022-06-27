// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "abdk-libraries-solidity/ABDKMath64x64.sol";

import "@solidstate/contracts/token/ERC1155/IERC1155.sol";
import "@solidstate/contracts/token/ERC20/IERC20.sol";
import "@solidstate/contracts/utils/ReentrancyGuard.sol";
import "@solidstate/contracts/utils/SafeERC20.sol";
import "@solidstate/contracts/utils/EnumerableSet.sol";

import "./IDutchAuction.sol";
import "./OrderBook.sol";

import "../vault/IVault.sol";

// TODO: Switch to stage modifiers
contract DutchAuction is IDutchAuction, ReentrancyGuard {
    using ABDKMath64x64 for int128;
    using ABDKMath64x64 for uint256;
    using EnumerableSet for EnumerableSet.UintSet;
    using OrderBook for OrderBook.Index;
    using SafeERC20 for IERC20;

    mapping(uint64 => Auction) auctions;
    mapping(uint64 => OrderBook.Index) orderbooks;
    mapping(address => EnumerableSet.UintSet) claimsByBuyer;

    address immutable keeper;
    IERC20 immutable ERC20;
    IERC1155 immutable ERC1155;
    IVault immutable Vault;

    constructor(
        address asset,
        address _keeper,
        address pool,
        address vault
    ) {
        keeper = _keeper;
        ERC20 = IERC20(asset);
        ERC1155 = IERC1155(pool);
        Vault = IVault(vault);
    }

    function initializeAuction(InitAuction memory initAuction) external {
        // TODO: Input validation
        require(msg.sender == keeper, "!keeper");
        require(initAuction.minPrice > 0, "minPrice <= 0");

        require(
            initAuction.endTime > initAuction.startTime,
            "endTime < startTime"
        );

        require(
            block.timestamp > initAuction.startTime,
            "start time too early"
        );

        auctions[initAuction.epoch] = Auction(
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
    }

    // @notice
    function addLimitOrder(
        uint64 epoch,
        uint256 price,
        uint256 size
    ) external nonReentrant returns (uint256) {
        return _addLimitOrder(epoch, price, size);
    }

    // @notice
    function cancelLimitOrder(uint64 epoch, uint256 id)
        external
        nonReentrant
        returns (bool)
    {
        return _cancelLimitOrder(epoch, id);
    }

    // @notice
    // @dev must approve contract prior to committing tokens to auction
    function addOrder(uint64 epoch, uint256 size)
        external
        nonReentrant
        returns (uint256)
    {
        return _addOrder(epoch, size);
    }

    /************************************************
     *  PRICING
     ***********************************************/

    // @notice
    function _lastPrice(uint64 epoch) internal view returns (uint256) {
        return auctions[epoch].lastPrice;
    }

    // @notice Returns price during the auction
    // @dev when block.timestamp = endTime, currentPrice == minPrice
    function _priceCurve(uint64 epoch) internal view returns (uint256) {
        uint256 startTime = auctions[epoch].startTime;
        uint256 totalTime = auctions[epoch].totalTime;

        uint256 maxPrice = auctions[epoch].maxPrice;
        uint256 minPrice = auctions[epoch].minPrice;

        uint256 elapsed = block.timestamp - startTime;
        int128 timeRemaining = elapsed.divu(totalTime);
        return maxPrice - timeRemaining.mulu(maxPrice - minPrice);
    }

    // @notice The current clearing price of the Dutch auction
    function _clearingPrice(uint64 epoch) internal view returns (uint256) {
        return
            auctions[epoch].finalized ? _lastPrice(epoch) : _priceCurve(epoch);
    }

    /************************************************
     *  AUCTION ORDER
     ***********************************************/

    function _addLimitOrder(
        uint64 epoch,
        uint256 price,
        uint256 size
    ) internal returns (uint256) {
        // modifier: reject if auction not initialized
        // modifier: reject if auction is finalized
        require(size > auctions[epoch].minSize, "size < minimum");

        if (block.timestamp >= auctions[epoch].startTime) {
            if (_finalizeAuction(epoch)) return 0;
        }

        uint256 cost = price * size;
        ERC20.safeTransferFrom(msg.sender, address(this), cost);
        claimsByBuyer[msg.sender].add(epoch);

        emit OrderAdded(msg.sender, price, size, true);
        return orderbooks[epoch]._insert(price, size, msg.sender);
    }

    function _cancelLimitOrder(uint64 epoch, uint256 id)
        internal
        returns (bool)
    {
        // modifier: reject if auction not initialized
        // modifier: reject if auction is finalized
        if (block.timestamp >= auctions[epoch].startTime) {
            if (_finalizeAuction(epoch)) return false;
        }

        OrderBook.Index storage orderbook = orderbooks[epoch];
        (, uint256 price, uint256 size, address buyer) =
            orderbook._getOrder(id);

        if (buyer != msg.sender) return false;

        uint256 cost = price * size;
        ERC20.safeTransfer(msg.sender, cost);
        claimsByBuyer[buyer].remove(epoch);

        // emit LimitOrderCanceled(msg.sender, id, price, size);
        return orderbook._remove(id);
    }

    function _addOrder(uint64 epoch, uint256 size) internal returns (uint256) {
        // modifier: reject if auction not initialized
        // modifier: reject if auction is finalized
        require(size >= auctions[epoch].minSize, "size < minimum");
        if (_finalizeAuction(epoch)) return 0;

        uint256 totalCollateral = auctions[epoch].totalCollateral;
        if (totalCollateral <= 0) {
            // Initializes totalCollateral if this is the first bid.
            auctions[epoch].totalCollateral = Vault.totalCollateral();
        }

        uint256 price = _priceCurve(epoch);
        uint256 cost = price * size;
        ERC20.safeTransferFrom(msg.sender, address(this), cost);
        auctions[epoch].lastPrice = price;

        claimsByBuyer[msg.sender].add(epoch);

        emit OrderAdded(msg.sender, price, size, false);
        return orderbooks[epoch]._insert(price, size, msg.sender);
    }

    /************************************************
     *  MAINTENANCE
     ***********************************************/

    // @notice traverses orderbook to check if the utilization is 100%
    function _processOrders(uint64 epoch) internal returns (bool) {
        // modifier: reject if auction not initialized
        // modifier: reject if auction has not started
        // modifier: reject if auction is finalized
        OrderBook.Index storage orderbook = orderbooks[epoch];

        uint256 next = orderbook._head();
        uint256 length = orderbook._length();

        uint256 totalCollateralUsed;
        uint256 totalCollateral = auctions[epoch].totalCollateral;

        uint256 price;
        uint256 size;

        for (uint256 i = 1; i <= length; i++) {
            (, price, size, ) = orderbook._getOrder(next);

            // Reached the last "active" order
            if (price < _clearingPrice(epoch)) break;

            if (totalCollateralUsed + size >= totalCollateral) {
                auctions[epoch].lastPrice = price;
                auctions[epoch].totalCollateralUsed = totalCollateral;
                return true;
            }

            totalCollateralUsed += size;
            next = orderbook._getNextOrder(next);
        }

        auctions[epoch].lastPrice = price;
        auctions[epoch].totalCollateralUsed = totalCollateralUsed;
        return false;
    }

    function _finalizeAuction(uint64 epoch) internal returns (bool) {
        // modifier: reject if auction not initialized
        // modifier: reject if auction has not started
        // modifier: reject if auction is finalized
        if (
            _processOrders(epoch) || block.timestamp > auctions[epoch].endTime
        ) {
            auctions[epoch].finalized = true;
            return true;
        }
        return false;
    }

    function _transferPremium(uint64 epoch) internal returns (uint256) {
        // modifier: reject if auction is not finalized
        // modifier: reject if auction is processed
        uint256 lastPrice = _lastPrice(epoch);
        uint256 totalCollateralUsed = auctions[epoch].totalCollateralUsed;
        uint256 totalPremiums = lastPrice * totalCollateralUsed;

        auctions[epoch].totalPremiums = totalPremiums;
        ERC20.safeTransfer(address(Vault), totalPremiums);

        return totalCollateralUsed;
    }

    function _setLongTokenId(uint64 epoch, uint256 longTokenId) internal {
        // modifier: reject if auction is not finalized
        // modifier: reject if auction is processed
        require(msg.sender == keeper, "!keeper");
        require(auctions[epoch].longTokenId != 0);
        auctions[epoch].longTokenId = longTokenId;
    }

    function _processAuction(uint64 epoch) internal {
        // modifier: reject if auction is not finalized
        // modifier: reject if auction is processed
        uint256 totalCollateralUsed = auctions[epoch].totalCollateralUsed;

        if (totalCollateralUsed > 0) {
            uint256 longTokenId = auctions[epoch].longTokenId;
            uint256 longTokenBalance =
                ERC1155.balanceOf(address(this), longTokenId);

            require(
                auctions[epoch].totalPremiums != 0,
                "premiums not transferred"
            );

            require(auctions[epoch].longTokenId != 0, "long token id not set");

            require(
                longTokenBalance >= totalCollateralUsed,
                "long tokens not transferred"
            );
        }

        auctions[epoch].processed = true;
    }

    /************************************************
     *  WITHDRAW
     ***********************************************/

    function _withdraw(uint64 epoch) internal {
        // modifier: reject if auction is not processed
        OrderBook.Index storage orderbook = orderbooks[epoch];

        uint256 next = orderbook._head();
        uint256 length = orderbook._length();
        uint256 lastPrice = _lastPrice(epoch);

        uint256 totalCollateralUsed;
        uint256 totalCollateral = auctions[epoch].totalCollateral;

        uint256 id;
        uint256 price;
        uint256 size;
        address buyer;

        uint256 refund;
        uint256 fill;

        for (uint256 i = 1; i <= length; i++) {
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

            next = orderbook._getNextOrder(next);
            orderbook._remove(id);
        }

        claimsByBuyer[buyer].remove(epoch);

        // TODO: Check if option expired ITM
        // // if it has, adjust the ERC20/Long balances

        if (fill > 0) {
            ERC1155.safeTransferFrom(
                address(this),
                buyer,
                auctions[epoch].longTokenId,
                fill,
                ""
            );
        }

        if (refund > 0) {
            ERC20.safeTransfer(buyer, refund);
        }
    }

    /************************************************
     *  VIEW
     ***********************************************/

    function _claimsByBuyer(address buyer)
        internal
        view
        returns (uint64[] memory)
    {
        EnumerableSet.UintSet storage epochs = claimsByBuyer[buyer];
        uint64[] memory claims = new uint64[](epochs.length());

        unchecked {
            for (uint256 i; i < epochs.length(); i++) {
                claims[i] = uint64(epochs.at(i));
            }
        }

        return claims;
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
