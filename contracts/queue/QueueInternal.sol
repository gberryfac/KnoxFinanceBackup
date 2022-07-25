// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@solidstate/contracts/token/ERC20/IERC20.sol";
import "@solidstate/contracts/token/ERC1155/base/ERC1155BaseInternal.sol";
import "@solidstate/contracts/token/ERC1155/enumerable/ERC1155EnumerableInternal.sol";
import "@solidstate/contracts/utils/SafeERC20.sol";

import "../interfaces/IPremiaPool.sol";

import "../vault/IVault.sol";

import "./QueueStorage.sol";

import "hardhat/console.sol";

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
        _redeemMax(receiver, msg.sender);

        uint256 currentTokenId = _getCurrentTokenId();
        _mint(receiver, currentTokenId, amount, "");

        // An approve() by the msg.sender is required beforehand
        ERC20.safeTransferFrom(msg.sender, address(this), amount);

        // Note: Index receiver
        // emit DepositedToQueue(receiver, amount, l.tokenId);
    }

    /************************************************
     *  WITHDRAW
     ***********************************************/

    function _withdraw(uint256 amount) internal {
        uint256 currentTokenId = _getCurrentTokenId();
        _burn(msg.sender, currentTokenId, amount);
        ERC20.safeTransfer(msg.sender, amount);
    }

    /************************************************
     *  REDEEM
     ***********************************************/

    function _redeem(
        uint256 tokenId,
        address receiver,
        address owner
    ) internal {
        uint256 currentTokenId = _getCurrentTokenId();

        require(
            tokenId != currentTokenId,
            "current claim token cannot be redeemed"
        );

        uint256 balance = _balanceOf(owner, tokenId);

        uint256 unredeemedShares = _previewUnredeemed(tokenId, owner);

        _burn(owner, tokenId, balance);
        require(Vault.transfer(receiver, unredeemedShares), "transfer failed");

        // Note: Index receiver
        // emit RedeemedShares(receiver, unredeemedShares, tokenId);
    }

    function _redeemMax(address receiver, address owner) internal {
        uint256[] memory tokenIds = _tokensByAccount(owner);
        uint256 currentTokenId = _getCurrentTokenId();

        for (uint256 i; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            if (tokenId != currentTokenId) {
                _redeem(tokenId, receiver, owner);
            }
        }
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

        uint256 currentTokenId = _getCurrentTokenId();
        uint256 totalSupply = _totalSupply(currentTokenId);
        uint256 pricePerShare = QueueStorage.ONE_SHARE;

        if (shareAmount > 0 && totalSupply > 0) {
            pricePerShare = (pricePerShare * shareAmount) / totalSupply;
        }

        l.pricePerShare[currentTokenId] = pricePerShare;

        // emit DepositQueuedToVault(pricePerShare, mintedShares);
    }

    /************************************************
     *  VIEW
     ***********************************************/

    function _previewUnredeemed(uint256 tokenId, address account)
        internal
        view
        returns (uint256)
    {
        QueueStorage.Layout storage l = QueueStorage.layout();
        uint256 balance = _balanceOf(account, tokenId);
        return (balance * l.pricePerShare[tokenId]) / QueueStorage.ONE_SHARE;
    }

    function _getEpoch() internal view returns (uint64) {
        return QueueStorage.layout()._getEpoch();
    }

    function _getMaxTVL() internal view returns (uint256) {
        return QueueStorage.layout()._getMaxTVL();
    }

    function _getCurrentTokenId() internal view returns (uint256) {
        return _formatTokenId(_getEpoch());
    }

    function _getPricePerShare(uint256 tokenId)
        internal
        view
        returns (uint256)
    {
        return QueueStorage.layout()._getPricePerShare(tokenId);
    }

    /************************************************
     * HELPERS
     ***********************************************/

    function _formatTokenId(uint64 epoch) internal view returns (uint256) {
        return (uint256(uint160(address(this))) << 64) + uint256(epoch);
    }

    function _parseTokenId(uint256 tokenId)
        internal
        pure
        returns (address, uint64)
    {
        address queue;
        uint64 epoch;

        assembly {
            queue := shr(64, tokenId)
            epoch := tokenId
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
