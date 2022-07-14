// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@solidstate/contracts/token/ERC20/IERC20.sol";
import "@solidstate/contracts/token/ERC1155/base/ERC1155BaseInternal.sol";
import "@solidstate/contracts/token/ERC1155/enumerable/ERC1155EnumerableInternal.sol";
import "@solidstate/contracts/utils/SafeERC20.sol";

import "../interfaces/IPremiaPool.sol";

import "../vault/IVault.sol";

import "./QueueStorage.sol";

contract QueueInternal is ERC1155BaseInternal, ERC1155EnumerableInternal {
    using QueueStorage for QueueStorage.Layout;
    using SafeERC20 for IERC20;

    IERC20 public immutable ERC20;
    IVault public immutable Vault;

    constructor(
        bool isCall,
        address pool,
        address vault
    ) {
        IPremiaPool.PoolSettings memory settings =
            IPremiaPool(pool).getPoolSettings();
        address asset = isCall ? settings.underlying : settings.base;

        ERC20 = IERC20(asset);
        Vault = IVault(vault);
    }

    /************************************************
     *  ADMIN
     ***********************************************/

    function _setMaxTVL(uint256 newMaxTVL) internal {
        return QueueStorage.layout()._setMaxTVL(newMaxTVL);
    }

    /************************************************
     *  DEPOSIT
     ***********************************************/

    function _deposit(uint256 amount, address receiver) internal {
        QueueStorage.Layout storage l = QueueStorage.layout();

        uint256 totalWithDepositedAmount =
            Vault.totalAssets() + ERC20.balanceOf(address(this)) + amount;

        require(totalWithDepositedAmount <= l.maxTVL, "maxTVL exceeded");
        require(amount > 0, "value exceeds minimum");

        // redeems shares from previous epochs
        _redeemMaxShares(receiver);

        uint256 currentClaimTokenId = _formatClaimTokenId(l.epoch);
        _mint(receiver, currentClaimTokenId, amount, "");

        // An approve() by the msg.sender is required beforehand
        ERC20.safeTransferFrom(msg.sender, address(this), amount);

        // Note: Index receiver
        // emit DepositedToQueue(receiver, amount, l.claimTokenId);
    }

    /************************************************
     *  WITHDRAW
     ***********************************************/

    function _withdraw(uint256 amount) internal {
        QueueStorage.Layout storage l = QueueStorage.layout();
        uint256 currentClaimTokenId = _formatClaimTokenId(l.epoch);
        _burn(msg.sender, currentClaimTokenId, amount);
        ERC20.safeTransfer(msg.sender, amount);
    }

    /************************************************
     *  REDEEM
     ***********************************************/

    function _redeemMaxShares(address receiver) internal {
        uint256[] memory claimTokenIds = _tokensByAccount(msg.sender);

        uint256 unredeemedShares;

        for (uint256 i; i < claimTokenIds.length; i++) {
            uint256 claimTokenId = claimTokenIds[i];
            unredeemedShares += _redeemShares(claimTokenId, receiver);
        }
    }

    function _redeemShares(uint256 claimTokenId, address receiver)
        internal
        returns (uint256)
    {
        QueueStorage.Layout storage l = QueueStorage.layout();
        uint256 currentClaimTokenId = _formatClaimTokenId(l.epoch);

        if (claimTokenId != currentClaimTokenId) {
            uint256 claimTokenBalance = _balanceOf(receiver, claimTokenId);

            uint256 unredeemedShares =
                _previewUnredeemedShares(claimTokenId, msg.sender);

            _burn(msg.sender, claimTokenId, claimTokenBalance);
            require(Vault.transfer(receiver, unredeemedShares));

            // Note: Index receiver
            // emit RedeemedShares(receiver, unredeemedShares, claimTokenId);
        }

        return 0;
    }

    /************************************************
     *  PROCESS EPOCH
     ***********************************************/

    function _syncEpoch(uint64 epoch) internal {
        QueueStorage.Layout storage l = QueueStorage.layout();
        l.epoch = epoch;
    }

    function _depositToVault() internal {
        uint256 queueBalance = ERC20.balanceOf(address(this));

        ERC20.approve(address(Vault), queueBalance);
        uint256 shareAmount = Vault.deposit(queueBalance, address(this));

        QueueStorage.Layout storage l = QueueStorage.layout();

        uint256 currentClaimTokenId = _formatClaimTokenId(l.epoch);
        uint256 totalSupply = _totalSupply(currentClaimTokenId);
        uint256 pricePerShare = 10**18;

        if (shareAmount > 0 && totalSupply > 0) {
            pricePerShare = (pricePerShare * shareAmount) / totalSupply;
        }

        l.pricePerShare[l.epoch] = pricePerShare;

        // emit DepositQueuedToVault(pricePerShare, mintedShares);
    }

    /************************************************
     *  VIEW
     ***********************************************/

    function _previewUnredeemedShares(address account)
        internal
        view
        returns (uint256)
    {
        uint256[] memory claimTokenIds = _tokensByAccount(account);

        uint256 unredeemedShares;
        for (uint256 i; i < claimTokenIds.length; i++) {
            uint256 claimTokenId = claimTokenIds[i];
            unredeemedShares += _previewUnredeemedShares(claimTokenId, account);
        }

        return unredeemedShares;
    }

    function _previewUnredeemedShares(uint256 claimTokenId, address account)
        internal
        view
        returns (uint256)
    {
        QueueStorage.Layout storage l = QueueStorage.layout();
        uint256 currentClaimTokenId = _formatClaimTokenId(l.epoch);

        // TODO: Remove check, pps is 0 if uninitialized
        if (claimTokenId != currentClaimTokenId) {
            uint256 claimTokenBalance = _balanceOf(account, claimTokenId);
            return (claimTokenBalance * l.pricePerShare[claimTokenId]) / 10**18;
        }

        return 0;
    }

    function _epoch() internal view returns (uint64) {
        return QueueStorage.layout()._epoch();
    }

    function _maxTVL() internal view returns (uint256) {
        return QueueStorage.layout()._maxTVL();
    }

    function _pricePerShare(uint64 epoch) internal view returns (uint256) {
        return QueueStorage.layout()._pricePerShare(epoch);
    }

    /************************************************
     * HELPERS
     ***********************************************/

    function _formatClaimTokenId(uint64 epoch) internal view returns (uint256) {
        return (uint256(uint160(address(this))) << 64) + uint256(epoch);
    }

    function _parseClaimTokenId(uint256 claimTokenId)
        internal
        pure
        returns (address, uint64)
    {
        address queue;
        uint64 epoch;

        assembly {
            queue := shr(64, claimTokenId)
            epoch := claimTokenId
        }

        return (queue, epoch);
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
        override(ERC1155BaseInternal, ERC1155EnumerableInternal)
    {
        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
    }
}
