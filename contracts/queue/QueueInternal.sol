// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@solidstate/contracts/access/ownable/OwnableInternal.sol";
import "@solidstate/contracts/security/PausableInternal.sol";
import "@solidstate/contracts/token/ERC20/IERC20.sol";
import "@solidstate/contracts/token/ERC1155/base/ERC1155BaseInternal.sol";
import "@solidstate/contracts/token/ERC1155/enumerable/ERC1155EnumerableInternal.sol";
import "@solidstate/contracts/utils/SafeERC20.sol";

import "../interfaces/IPremiaPool.sol";

import "../vault/IVault.sol";

import "./IQueueEvents.sol";
import "./QueueStorage.sol";

import "hardhat/console.sol";

contract QueueInternal is
    ERC1155BaseInternal,
    ERC1155EnumerableInternal,
    IQueueEvents,
    OwnableInternal,
    PausableInternal
{
    using QueueStorage for QueueStorage.Layout;
    using SafeERC20 for IERC20;

    uint256 internal constant ONE_SHARE = 10**18;

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
     *  ACCESS CONTROL
     ***********************************************/

    /**
     * @dev Throws if called by any account other than the vault.
     */
    modifier onlyVault() {
        QueueStorage.Layout storage l = QueueStorage.layout();
        require(msg.sender == l.vault, "!vault");
        _;
    }

    /************************************************
     *  ADMIN
     ***********************************************/

    /**
     * @notice sets a new max TVL for deposits
     * @param newMaxTVL is the new TVL limit for deposits
     */
    function _setMaxTVL(uint256 newMaxTVL) internal {
        QueueStorage.Layout storage l = QueueStorage.layout();
        require(newMaxTVL > 0, "value exceeds minimum");
        l.maxTVL = newMaxTVL;
        emit MaxTVLSet(l.epoch, l.maxTVL, newMaxTVL, msg.sender);
    }

    /************************************************
     *  DEPOSIT
     ***********************************************/

    /**
     * @notice deposits collateral asset
     * @param amount total collateral deposited
     * @param receiver claim token recipient
     */
    function _deposit(uint256 amount, address receiver) internal {
        QueueStorage.Layout storage l = QueueStorage.layout();

        uint256 totalWithDepositedAmount =
            Vault.totalAssets() + ERC20.balanceOf(address(this)) + amount;

        require(totalWithDepositedAmount <= l.maxTVL, "maxTVL exceeded");
        require(amount > 0, "value exceeds minimum");

        // redeems shares from previous epochs
        _redeemMax(receiver, msg.sender);

        uint256 currentTokenId = QueueStorage._getCurrentTokenId();
        _mint(receiver, currentTokenId, amount, "");

        // an approve() by the msg.sender is required beforehand
        ERC20.safeTransferFrom(msg.sender, address(this), amount);

        emit Deposit(l.epoch, receiver, msg.sender, amount);
    }

    /************************************************
     *  CANCEL
     ***********************************************/

    /**
     * @notice cancels deposit, refunds collateral asset
     * @dev cancellation must be made within the same epoch as the deposit
     * @param amount total collateral which will be withdrawn
     */
    function _cancel(uint256 amount) internal {
        uint256 currentTokenId = QueueStorage._getCurrentTokenId();
        _burn(msg.sender, currentTokenId, amount);
        ERC20.safeTransfer(msg.sender, amount);

        uint64 epoch = QueueStorage._getEpoch();
        emit Cancel(epoch, msg.sender, amount);
    }

    /************************************************
     *  REDEEM
     ***********************************************/

    /**
     * @notice exchanges claim token for vault shares
     * @param tokenId claim token id
     * @param receiver vault share recipient
     * @param owner claim token holder
     */
    function _redeem(
        uint256 tokenId,
        address receiver,
        address owner
    ) internal {
        uint256 currentTokenId = QueueStorage._getCurrentTokenId();

        require(
            tokenId != currentTokenId,
            "current claim token cannot be redeemed"
        );

        uint256 balance = _balanceOf(owner, tokenId);

        uint256 unredeemedShares = _previewUnredeemed(tokenId, owner);

        _burn(owner, tokenId, balance);
        require(Vault.transfer(receiver, unredeemedShares), "transfer failed");

        uint64 epoch = QueueStorage._getEpoch();
        emit Redeem(epoch, receiver, owner, unredeemedShares);
    }

    /**
     * @notice exchanges all claim tokens for vault shares
     * @param receiver vault share recipient
     * @param owner claim token holder
     */
    function _redeemMax(address receiver, address owner) internal {
        uint256[] memory tokenIds = _tokensByAccount(owner);
        uint256 currentTokenId = QueueStorage._getCurrentTokenId();

        for (uint256 i; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            if (tokenId != currentTokenId) {
                _redeem(tokenId, receiver, owner);
            }
        }
    }

    /************************************************
     *  PROCESS LAST EPOCH
     ***********************************************/

    /**
     * @notice syncs queue epoch with vault epoch
     * @param epoch current epoch of vault
     */
    function _syncEpoch(uint64 epoch) internal {
        QueueStorage.Layout storage l = QueueStorage.layout();
        l.epoch = epoch;
        emit EpochSet(l.epoch, msg.sender);
    }

    /**
     * @notice transfers deposited collateral to vault, calculates the price per share
     */
    function _processDeposits() internal {
        uint256 deposits = ERC20.balanceOf(address(this));

        ERC20.approve(address(Vault), deposits);
        uint256 shares = Vault.deposit(deposits, address(this));

        uint256 currentTokenId = QueueStorage._getCurrentTokenId();
        uint256 claimTokenSupply = _totalSupply(currentTokenId);
        uint256 pricePerShare = ONE_SHARE;

        if (shares == 0) {
            pricePerShare = 0;
        } else if (claimTokenSupply > 0) {
            pricePerShare = (pricePerShare * shares) / claimTokenSupply;
        }

        QueueStorage.Layout storage l = QueueStorage.layout();
        l.pricePerShare[currentTokenId] = pricePerShare;

        emit ProcessQueuedDeposits(
            l.epoch,
            deposits,
            pricePerShare,
            shares,
            claimTokenSupply
        );
    }

    /************************************************
     *  VIEW
     ***********************************************/

    /**
     * @notice calculates unredeemed vault shares available
     * @param tokenId claim token id
     * @param account claim token holder
     * @return total unredeemed vault shares
     */
    function _previewUnredeemed(uint256 tokenId, address account)
        internal
        view
        returns (uint256)
    {
        QueueStorage.Layout storage l = QueueStorage.layout();
        uint256 balance = _balanceOf(account, tokenId);
        return (balance * l.pricePerShare[tokenId]) / ONE_SHARE;
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