// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@solidstate/contracts/utils/ReentrancyGuard.sol";

import "./DutchAuctionInternal.sol";
import "./IDutchAuction.sol";

// TODO: Switch to stage modifiers
contract DutchAuction is DutchAuctionInternal, IDutchAuction, ReentrancyGuard {
    constructor(
        address asset,
        address pool,
        address vault
    ) DutchAuctionInternal(asset, pool, vault) {}

    /**
     * @dev Throws if called by any account other than the keeper.
     */
    modifier onlyVault() {
        require(msg.sender == address(Vault), "!vault");
        _;
    }

    function initializeAuction(
        DutchAuctionStorage.InitAuction memory initAuction
    ) external onlyVault {
        _initializeAuction(initAuction);
    }

    /************************************************
     *  PRICING
     ***********************************************/

    // @notice
    function lastPrice(uint64 epoch) external view returns (uint256) {
        return _lastPrice(epoch);
    }

    // @notice
    function priceCurve(uint64 epoch) external view returns (uint256) {
        return _priceCurve(epoch);
    }

    // @notice
    function clearingPrice(uint64 epoch) external view returns (uint256) {
        return _clearingPrice(epoch);
    }

    /************************************************
     *  AUCTION ORDER
     ***********************************************/

    // TODO: add addLimitOrderFor()
    // TODO: add cancelLimitOrderFor()
    // TODO: add addOrderFor()
    // TODO: add withdrawOrderFor()

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

    function setLongTokenId(uint64 epoch, uint256 longTokenId)
        external
        onlyVault
    {
        _setLongTokenId(epoch, longTokenId);
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

    /************************************************
     *  VIEW
     ***********************************************/

    function isFinalized(uint64 epoch) external view returns (bool) {
        return _isFinalized(epoch);
    }

    function totalCollateralUsed(uint64 epoch) external view returns (uint256) {
        return _totalCollateralUsed(epoch);
    }

    function claimsByBuyer(address buyer)
        external
        view
        returns (uint64[] memory)
    {
        return _claimsByBuyer(buyer);
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
