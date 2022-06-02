// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@solidstate/contracts/token/ERC20/IERC20.sol";
import "@solidstate/contracts/token/ERC4626/base/ERC4626BaseInternal.sol";
import "@solidstate/contracts/utils/SafeERC20.sol";

import "./../libraries/Constants.sol";

import "./Queue.sol";
import "./VaultStorage.sol";

import "hardhat/console.sol";

abstract contract VaultInternal is Queue {
    using SafeERC20 for IERC20;
    using VaultStorage for VaultStorage.Layout;

    function _setNextRound(uint64 expiry, uint256 tokenId) internal {
        _withdrawLiquidityFromPool();
        _depositQueuedToVault();

        // TODO: Calculate and disburse management/ performance fees

        VaultStorage.Layout storage l = VaultStorage.layout();

        l.option.expiry = expiry;
        l.option.tokenId = tokenId;

        l.state.epoch++;

        // Note: index epoch
        // emit SetNextRound(expiry, tokenId, epoch);
    }

    /**
     * @notice Transfers freed liquidity from Premia pool to Vault.
     * @dev Should only be called if option's expired.
     */
    function _withdrawLiquidityFromPool() internal {
        VaultStorage.Layout storage l = VaultStorage.layout();

        // uint256 liquidityBefore = l.ERC20.balanceOf(address(this));

        uint256 reservedLiquidity =
            l.Pool.balanceOf(
                address(this),
                l.option.isCall
                    ? Constants.UNDERLYING_RESERVED_LIQ_TOKEN_ID
                    : Constants.BASE_RESERVED_LIQ_TOKEN_ID
            );

        l.Pool.withdraw(reservedLiquidity, l.option.isCall);

        // uint256 liquidityAfter = l.ERC20.balanceOf(address(this));

        // emit(liquidityBefore, liquidityAfter, reservedLiquidity);
    }

    function _depositQueuedToVault() internal {
        VaultStorage.Layout storage l = VaultStorage.layout();

        uint256 mintedShares =
            _deposit(l.state.totalQueuedAssets, address(this));

        l.state.totalQueuedAssets = 0;

        uint256 _pricePerShare = 10**18;
        uint256 epoch = l.state.epoch;

        if (mintedShares > 0 && _totalSupply(epoch) > 0) {
            _pricePerShare =
                (_pricePerShare * mintedShares) /
                _totalSupply(epoch);
        }

        l.pricePerShare[l.state.epoch] = _pricePerShare;

        // emit DepositQueuedToVault(pricePerShare, mintedShares, l.state.totalQueuedAssets);
    }

    /**
     * @notice get the total quantity of the assets managed by the vault sans queued assets
     * @return total managed asset amount
     */
    function _totalAssets()
        internal
        view
        override(ERC4626BaseInternal)
        returns (uint256)
    {
        VaultStorage.Layout storage l = VaultStorage.layout();

        uint256 erc20Amount = l.ERC20.balanceOf(address(this));
        uint256 shortTokenAmount =
            l.Pool.balanceOf(address(this), l.option.tokenId);

        return erc20Amount + shortTokenAmount - l.state.totalQueuedAssets;
    }

    /**
     * @notice execute a deposit of assets on behalf of given address
     * @param assetAmount quantity of assets to deposit
     * @param receiver recipient of shares resulting from deposit
     * @return shareAmount quantity of shares to mint
     */
    function _deposit(uint256 assetAmount, address receiver)
        internal
        override(ERC4626BaseInternal)
        returns (uint256 shareAmount)
    {
        require(
            assetAmount <= _maxDeposit(receiver),
            "ERC4626: maximum amount exceeded"
        );

        shareAmount = _previewDeposit(assetAmount);

        __deposit(msg.sender, receiver, assetAmount, shareAmount);
    }

    /**
     * @notice execute a minting of shares on behalf of given address
     * @param shareAmount quantity of shares to mint
     * @param receiver recipient of shares resulting from deposit
     * @return assetAmount quantity of assets to deposit
     */
    function _mint(uint256 shareAmount, address receiver)
        internal
        override(ERC4626BaseInternal)
        returns (uint256 assetAmount)
    {
        require(
            shareAmount <= _maxMint(receiver),
            "ERC4626: maximum amount exceeded"
        );

        assetAmount = _previewMint(shareAmount);

        __deposit(msg.sender, receiver, assetAmount, shareAmount);
    }

    /**
     * @notice exchange assets for shares on behalf of given address
     * @param caller supplier of assets to be deposited
     * @param receiver recipient of shares resulting from deposit
     * @param assetAmount quantity of assets to deposit
     * @param shareAmount quantity of shares to mint
     */
    function __deposit(
        address caller,
        address receiver,
        uint256 assetAmount,
        uint256 shareAmount
    ) private {
        IERC20(_asset()).safeTransfer(address(this), assetAmount);

        _mint(receiver, shareAmount);

        _afterDeposit(receiver, assetAmount, shareAmount);

        emit Deposit(caller, receiver, assetAmount, shareAmount);
    }

    /**
     * @notice execute a withdrawal of assets on behalf of given address
     * @param assetAmount quantity of assets to withdraw
     * @param receiver recipient of assets resulting from withdrawal
     * @param owner holder of shares to be redeemed
     * @return shareAmount quantity of shares to redeem
     */
    function _withdraw(
        uint256 assetAmount,
        address receiver,
        address owner
    ) internal override(ERC4626BaseInternal) returns (uint256 shareAmount) {
        _maxRedeemShares();

        require(
            assetAmount <= _maxWithdraw(owner),
            "ERC4626: maximum amount exceeded"
        );

        shareAmount = _previewWithdraw(assetAmount);

        __withdraw(msg.sender, receiver, owner, assetAmount, shareAmount);
    }

    /**
     * @notice execute a redemption of shares on behalf of given address
     * @param shareAmount quantity of shares to redeem
     * @param receiver recipient of assets resulting from withdrawal
     * @param owner holder of shares to be redeemed
     * @return assetAmount quantity of assets to withdraw
     */
    function _redeem(
        uint256 shareAmount,
        address receiver,
        address owner
    ) internal override(ERC4626BaseInternal) returns (uint256 assetAmount) {
        _maxRedeemShares();

        require(
            shareAmount <= _maxRedeem(owner),
            "ERC4626: maximum amount exceeded"
        );

        assetAmount = _previewRedeem(shareAmount);

        __withdraw(msg.sender, receiver, owner, assetAmount, shareAmount);
    }

    /**
     * @notice exchange shares for assets on behalf of given address
     * @param caller transaction operator for purposes of allowance verification
     * @param receiver recipient of assets resulting from withdrawal
     * @param owner holder of shares to be redeemed
     * @param assetAmount quantity of assets to withdraw
     * @param shareAmount quantity of shares to redeem
     */
    function __withdraw(
        address caller,
        address receiver,
        address owner,
        uint256 assetAmount,
        uint256 shareAmount
    ) private {
        if (caller != owner) {
            uint256 allowance = _allowance(owner, caller);

            require(
                allowance >= shareAmount,
                "ERC4626: share amount exceeds allowance"
            );

            unchecked {_approve(owner, caller, allowance - shareAmount);}
        }

        _beforeWithdraw(owner, assetAmount, shareAmount);

        _burn(owner, shareAmount);

        (uint256 vaultAssetAmount, uint256 shortAssetAmount) =
            VaultStorage._balanceDisbursement(assetAmount, _totalAssets());

        IERC20(_asset()).safeTransfer(receiver, vaultAssetAmount);
        VaultStorage._safeTransferERC1155(receiver, shortAssetAmount);

        emit Withdraw(caller, receiver, owner, assetAmount, shareAmount);
    }
}
