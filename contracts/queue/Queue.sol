// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@solidstate/contracts/introspection/ERC165Storage.sol";
import "@solidstate/contracts/token/ERC1155/base/ERC1155Base.sol";
import "@solidstate/contracts/token/ERC1155/enumerable/ERC1155Enumerable.sol";

import "../access/Access.sol";

import "./QueueInternal.sol";

contract Queue is Access, ERC1155Base, ERC1155Enumerable, QueueInternal {
    using ERC165Storage for ERC165Storage.Layout;
    using QueueStorage for QueueStorage.Layout;
    using SafeERC20 for IERC20;

    constructor(
        bool isCall,
        address pool,
        address vault
    ) QueueInternal(isCall, pool, vault) {}

    /************************************************
     *  ADMIN
     ***********************************************/

    function setMaxTVL(uint256 newMaxTVL) external onlyOwner {
        _setMaxTVL(newMaxTVL);
    }

    /************************************************
     *  DEPOSIT
     ***********************************************/

    function depositToQueue(uint256 amount)
        external
        nonReentrant
        whenNotPaused
    {
        _depositToQueue(amount, msg.sender);
    }

    function depositToQueue(uint256 amount, address receiver)
        external
        nonReentrant
        whenNotPaused
    {
        _depositToQueue(amount, receiver);
    }

    /************************************************
     *  WITHDRAW
     ***********************************************/

    function withdrawFromQueue(uint256 amount) external nonReentrant {
        _withdrawFromQueue(amount);
    }

    /************************************************
     *  REDEEM
     ***********************************************/

    function redeemMaxShares(address receiver) external nonReentrant {
        require(
            receiver == msg.sender || isApprovedForAll(receiver, msg.sender),
            "ERC1155: caller is not owner nor approved"
        );

        _redeemMaxShares(receiver);
    }

    function redeemSharesFromEpoch(uint64 epoch, address receiver)
        external
        nonReentrant
    {
        require(
            receiver == msg.sender || isApprovedForAll(receiver, msg.sender),
            "ERC1155: caller is not owner nor approved"
        );
        _redeemSharesFromEpoch(epoch, receiver);
    }

    /************************************************
     *  PROCESS EPOCH
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

    function previewUnredeemedShares(address account)
        external
        view
        returns (uint256)
    {
        return _previewUnredeemedShares(account);
    }

    function previewUnredeemedSharesFromEpoch(uint64 epoch, uint256 balance)
        external
        view
        returns (uint256)
    {
        return _previewUnredeemedSharesFromEpoch(epoch, balance);
    }

    function epoch() external view returns (uint64) {
        return _epoch();
    }

    function maxTVL() external view returns (uint256) {
        return _maxTVL();
    }

    function pricePerShare(uint64 epoch) external view returns (uint256) {
        return _pricePerShare(epoch);
    }

    /************************************************
     * HELPERS
     ***********************************************/

    function formatClaimTokenId(uint64 epoch) external view returns (uint256) {
        return _formatClaimTokenId(epoch);
    }

    function parseClaimTokenId(uint256 claimTokenId)
        external
        pure
        returns (address, uint64)
    {
        return _parseClaimTokenId(claimTokenId);
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
