// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@solidstate/contracts/introspection/ERC165Storage.sol";
import "@solidstate/contracts/token/ERC1155/base/ERC1155Base.sol";
import "@solidstate/contracts/token/ERC1155/enumerable/ERC1155Enumerable.sol";
import "@solidstate/contracts/utils/ReentrancyGuard.sol";

import "./IQueue.sol";
import "./QueueInternal.sol";

contract Queue is
    ERC1155Base,
    ERC1155Enumerable,
    IQueue,
    QueueInternal,
    ReentrancyGuard
{
    using ERC165Storage for ERC165Storage.Layout;
    using QueueStorage for QueueStorage.Layout;
    using SafeERC20 for IERC20;

    constructor(
        bool isCall,
        address pool,
        address vault
    ) QueueInternal(isCall, pool, vault) {}

    /************************************************
     *  SAFETY
     ***********************************************/

    /**
     * @notice Pauses the vault during an emergency preventing deposits and borrowing.
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpauses the vault during following an emergency allowing deposits and borrowing.
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /************************************************
     *  ADMIN
     ***********************************************/

    function setMaxTVL(uint256 newMaxTVL) external onlyOwner {
        _setMaxTVL(newMaxTVL);
    }

    /************************************************
     *  DEPOSIT
     ***********************************************/

    function deposit(uint256 amount) external nonReentrant whenNotPaused {
        _deposit(amount, msg.sender);
    }

    function deposit(uint256 amount, address receiver)
        external
        nonReentrant
        whenNotPaused
    {
        _deposit(amount, receiver);
    }

    /************************************************
     *  WITHDRAW
     ***********************************************/

    function withdraw(uint256 amount) external nonReentrant {
        _withdraw(amount);
    }

    /************************************************
     *  REDEEM
     ***********************************************/

    function redeem(uint256 tokenId) external nonReentrant {
        _redeem(tokenId, msg.sender, msg.sender);
    }

    function redeem(uint256 tokenId, address receiver) external nonReentrant {
        _redeem(tokenId, receiver, msg.sender);
    }

    function redeem(
        uint256 tokenId,
        address receiver,
        address owner
    ) external nonReentrant {
        require(
            owner == msg.sender || isApprovedForAll(owner, msg.sender),
            "ERC1155: caller is not owner nor approved"
        );

        _redeem(tokenId, receiver, owner);
    }

    function redeemMax() external nonReentrant {
        _redeemMax(msg.sender, msg.sender);
    }

    function redeemMax(address receiver) external nonReentrant {
        _redeemMax(receiver, msg.sender);
    }

    function redeemMax(address receiver, address owner) external nonReentrant {
        require(
            owner == msg.sender || isApprovedForAll(owner, msg.sender),
            "ERC1155: caller is not owner nor approved"
        );

        _redeemMax(receiver, owner);
    }

    /************************************************
     *  PROCESS LAST EPOCH
     ***********************************************/

    function syncEpoch(uint64 epoch) external onlyVault {
        _syncEpoch(epoch);
    }

    function depositToVault() external onlyVault {
        _depositToVault();
    }

    /************************************************
     *  VIEW
     ***********************************************/

    function getCurrentTokenId() external view returns (uint256) {
        return _getCurrentTokenId();
    }

    function getEpoch() external view returns (uint64) {
        return QueueStorage.layout()._getEpoch();
    }

    function getMaxTVL() external view returns (uint256) {
        return QueueStorage.layout()._getMaxTVL();
    }

    function getPricePerShare(uint256 tokenId) external view returns (uint256) {
        return QueueStorage.layout()._getPricePerShare(tokenId);
    }

    function previewUnredeemed(uint256 tokenId)
        external
        view
        returns (uint256)
    {
        return _previewUnredeemed(tokenId, msg.sender);
    }

    function previewUnredeemed(uint256 tokenId, address account)
        external
        view
        returns (uint256)
    {
        return _previewUnredeemed(tokenId, account);
    }

    /************************************************
     * HELPERS
     ***********************************************/

    function formatClaimTokenId(uint64 epoch) external view returns (uint256) {
        return QueueStorage._formatTokenId(epoch);
    }

    function parseClaimTokenId(uint256 tokenId)
        external
        pure
        returns (address, uint64)
    {
        return QueueStorage._parseTokenId(tokenId);
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
     *  ERC1155 OVERRIDES
     ***********************************************/

    function _beforeTokenTransfer(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    )
        internal
        virtual
        override(QueueInternal, ERC1155BaseInternal, ERC1155EnumerableInternal)
    {
        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
    }
}
