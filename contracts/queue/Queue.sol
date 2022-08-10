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
     * @notice pauses the vault during an emergency preventing deposits and borrowing.
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice unpauses the vault during following an emergency allowing deposits and borrowing.
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /************************************************
     *  ADMIN
     ***********************************************/

    /**
     * @inheritdoc IQueue
     */
    function setMaxTVL(uint256 newMaxTVL) external onlyOwner {
        _setMaxTVL(newMaxTVL);
    }

    /************************************************
     *  DEPOSIT
     ***********************************************/

    /**
     * @inheritdoc IQueue
     */
    function deposit(uint256 amount) external nonReentrant whenNotPaused {
        _deposit(amount, msg.sender);
    }

    /**
     * @inheritdoc IQueue
     */
    function deposit(uint256 amount, address receiver)
        external
        nonReentrant
        whenNotPaused
    {
        _deposit(amount, receiver);
    }

    /************************************************
     *  CANCEL
     ***********************************************/

    /**
     * @inheritdoc IQueue
     */
    function cancel(uint256 amount) external nonReentrant {
        _cancel(amount);
    }

    /************************************************
     *  REDEEM
     ***********************************************/

    /**
     * @inheritdoc IQueue
     */
    function redeem(uint256 tokenId) external nonReentrant {
        _redeem(tokenId, msg.sender, msg.sender);
    }

    /**
     * @inheritdoc IQueue
     */
    function redeem(uint256 tokenId, address receiver) external nonReentrant {
        _redeem(tokenId, receiver, msg.sender);
    }

    /**
     * @inheritdoc IQueue
     */
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

    /**
     * @inheritdoc IQueue
     */
    function redeemMax() external nonReentrant {
        _redeemMax(msg.sender, msg.sender);
    }

    function redeemMax(address receiver) external nonReentrant {
        _redeemMax(receiver, msg.sender);
    }

    /**
     * @inheritdoc IQueue
     */
    function redeemMax(address receiver, address owner) external nonReentrant {
        require(
            owner == msg.sender || isApprovedForAll(owner, msg.sender),
            "ERC1155: caller is not owner nor approved"
        );

        _redeemMax(receiver, owner);
    }

    /************************************************
     *  INITIALIZE NEXT EPOCH
     ***********************************************/

    /**
     * @inheritdoc IQueue
     */
    function syncEpoch(uint64 epoch) external onlyVault {
        _syncEpoch(epoch);
    }

    /**
     * @inheritdoc IQueue
     */
    function processDeposits() external onlyVault {
        _processDeposits();
    }

    /************************************************
     *  VIEW
     ***********************************************/

    /**
     * @inheritdoc IQueue
     */
    function getCurrentTokenId() external view returns (uint256) {
        return QueueStorage._getCurrentTokenId();
    }

    /**
     * @inheritdoc IQueue
     */
    function getEpoch() external view returns (uint64) {
        return QueueStorage._getEpoch();
    }

    /**
     * @inheritdoc IQueue
     */
    function getMaxTVL() external view returns (uint256) {
        return QueueStorage._getMaxTVL();
    }

    /**
     * @inheritdoc IQueue
     */
    function getPricePerShare(uint256 tokenId) external view returns (uint256) {
        return QueueStorage._getPricePerShare(tokenId);
    }

    /**
     * @inheritdoc IQueue
     */
    function previewUnredeemed(uint256 tokenId)
        external
        view
        returns (uint256)
    {
        return _previewUnredeemed(tokenId, msg.sender);
    }

    /**
     * @inheritdoc IQueue
     */
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

    /**
     * @inheritdoc IQueue
     */
    function formatClaimTokenId(uint64 epoch) external view returns (uint256) {
        return QueueStorage._formatTokenId(epoch);
    }

    /**
     * @inheritdoc IQueue
     */
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
