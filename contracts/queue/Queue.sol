// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@solidstate/contracts/introspection/ERC165Storage.sol";
import "@solidstate/contracts/token/ERC1155/base/ERC1155Base.sol";
import "@solidstate/contracts/token/ERC1155/enumerable/ERC1155Enumerable.sol";

import "../access/Access.sol";

import "./IQueue.sol";
import "./QueueInternal.sol";

contract Queue is
    Access,
    ERC1155Base,
    ERC1155Enumerable,
    IQueue,
    QueueInternal
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

    function redeemMaxShares() external nonReentrant {
        _redeemMaxShares(msg.sender);
    }

    function redeemMaxShares(address receiver) external nonReentrant {
        _redeemMaxShares(receiver);
    }

    function redeemShares(uint64 _epoch) external nonReentrant {
        _redeemShares(_epoch, msg.sender);
    }

    function redeemShares(uint64 _epoch, address receiver)
        external
        nonReentrant
    {
        _redeemShares(_epoch, receiver);
    }

    /************************************************
     *  PROCESS EPOCH
     ***********************************************/

    function syncEpoch(uint64 _epoch) external onlyVault {
        _syncEpoch(_epoch);
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

    function previewUnredeemedShares(uint256 claimTokenId, address account)
        external
        view
        returns (uint256)
    {
        return _previewUnredeemedShares(claimTokenId, account);
    }

    function epoch() external view returns (uint64) {
        return _epoch();
    }

    function maxTVL() external view returns (uint256) {
        return _maxTVL();
    }

    function pricePerShare(uint64 _epoch) external view returns (uint256) {
        return _pricePerShare(_epoch);
    }

    /************************************************
     * HELPERS
     ***********************************************/

    function formatClaimTokenId(uint64 _epoch) external view returns (uint256) {
        return _formatClaimTokenId(_epoch);
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
