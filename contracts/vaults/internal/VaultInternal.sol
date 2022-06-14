// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@solidstate/contracts/token/ERC20/IERC20.sol";
import "@solidstate/contracts/token/ERC4626/base/ERC4626Base.sol";
import "@solidstate/contracts/utils/SafeERC20.sol";

import "./../../libraries/Constants.sol";

import "./AdminInternal.sol";
import "./../VaultStorage.sol";

import "hardhat/console.sol";

contract VaultInternal is AdminInternal, ERC4626Base {
    using SafeERC20 for IERC20;
    using VaultStorage for VaultStorage.Layout;

    /************************************************
     *  OPERATIONS
     ***********************************************/

    function _processEpoch(
        VaultStorage.Layout storage l,
        uint64 expiry,
        uint256 tokenId
    ) internal {
        require(expiry > l.expiry, "previous expiry > new expiry");

        _withdrawReservedLiquidity(l);
        _collectVaultFees(l);
        _depositQueuedToVault(l);

        l.expiry = expiry;
        l.tokenId = tokenId;

        l.lastTotalAssets = _totalAssets();

        l.epoch++;

        // Note: index epoch
        // emit SetNextRound(expiry, tokenId, epoch);
    }

    /**
     * @notice Transfers reserved liquidity from Premia pool to Vault.
     * @dev Should only be called if option's expired.
     */
    function _withdrawReservedLiquidity(VaultStorage.Layout storage l)
        internal
    {
        // uint256 liquidityBefore = l.ERC20.balanceOf(address(this));

        uint256 reservedLiquidity =
            l.Pool.balanceOf(
                address(this),
                l.isCall
                    ? Constants.UNDERLYING_RESERVED_LIQ_TOKEN_ID
                    : Constants.BASE_RESERVED_LIQ_TOKEN_ID
            );

        l.Pool.withdraw(reservedLiquidity, l.isCall);

        // uint256 liquidityAfter = l.ERC20.balanceOf(address(this));

        // emit(liquidityBefore, liquidityAfter, reservedLiquidity);
    }

    function _depositQueuedToVault(VaultStorage.Layout storage l) internal {
        uint256 mintedShares = _deposit(l.totalQueuedAssets, address(this));

        l.totalQueuedAssets = 0;

        uint256 _pricePerShare = 10**18;
        uint256 epoch = l.epoch;

        if (mintedShares > 0 && l.Queue.totalSupply(epoch) > 0) {
            _pricePerShare =
                (_pricePerShare * mintedShares) /
                l.Queue.totalSupply(epoch);
        }

        l.pricePerShare[l.epoch] = _pricePerShare;

        // emit DepositQueuedToVault(pricePerShare, mintedShares);
    }

    function _collectVaultFees(VaultStorage.Layout storage l) internal {
        uint256 totalAssets = _totalAssets();

        uint256 vaultFee;
        uint256 performanceFeeInAsset;
        uint256 managementFeeInAsset;

        if (l.lastTotalAssets > 0) {
            // TODO: Remove in favor of withdrawal fee
            managementFeeInAsset = l.managementFee > 0
                ? ((totalAssets * l.managementFee) / 100) *
                    Constants.FEE_MULTIPLIER
                : 0;

            /**
             * Take performance fee ONLY if difference between last week and this week's
             * vault deposits, taking into account pending deposits and withdrawals, is
             * positive. If it is negative, last week's option expired ITM past breakeven,
             * and the vault took a loss so we do not collect performance fee for last week
             */
            if (totalAssets > l.lastTotalAssets) {
                performanceFeeInAsset = l.performanceFee > 0
                    ? ((totalAssets - l.lastTotalAssets) * l.performanceFee) /
                        (100 * Constants.FEE_MULTIPLIER)
                    : 0;

                vaultFee = performanceFeeInAsset + managementFeeInAsset;

                l.ERC20.safeTransfer(l.feeRecipient, vaultFee);
            }
        }

        if (vaultFee > 0) {
            l.ERC20.safeTransfer(l.feeRecipient, vaultFee);
        }

        // emit DisbursedVaultFees(
        //     vaultFee,
        //     managementFeeInAsset,
        //     performanceFeeInAsset
        // );
    }

    function _borrow(VaultStorage.Layout storage l, uint256 amount) internal {
        uint256 totalFreeLiquidity =
            l.ERC20.balanceOf(address(this)) - l.totalQueuedAssets;

        require(totalFreeLiquidity >= amount, Errors.FREE_LIQUIDTY_EXCEEDED);

        l.ERC20.safeTransfer(l.strategy, amount);
    }

    // function _totalBalance() internal view returns (uint256) {
    //     VaultStorage.Layout storage l = VaultStorage.layout();

    //     uint256 erc20Amount = l.ERC20.balanceOf(address(this));
    //     uint256 shortTokenAmount = l.Pool.balanceOf(address(this), l.tokenId);

    //     return erc20Amount + shortTokenAmount - l.totalQueuedAssets;
    // }

    /************************************************
     *  ERC4626 OVERRIDES
     ***********************************************/

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
        uint256 shortTokenAmount = l.Pool.balanceOf(address(this), l.tokenId);
        return erc20Amount + shortTokenAmount - l.totalQueuedAssets;
    }

    // /**
    //  * @notice get the total quantity of the assets managed by the vault sans queued assets
    //  * @return total managed asset amount
    //  */
    // function _totalAssets()
    //     internal
    //     view
    //     override(ERC4626BaseInternal)
    //     returns (uint256)
    // {
    //     VaultStorage.Layout storage l = VaultStorage.layout();
    //     return l.lastTotalAssets;
    // }

    /**
     * @notice execute a deposit of assets on behalf of given address
     * @dev only the vault keeper may call this function
     * @param assetAmount quantity of assets to deposit
     * @param receiver recipient of shares resulting from deposit
     * @return shareAmount quantity of shares to mint
     */
    function _deposit(uint256 assetAmount, address receiver)
        internal
        override(ERC4626BaseInternal)
        onlyAuthorized
        returns (uint256)
    {
        require(
            assetAmount <= _maxDeposit(receiver),
            "ERC4626: maximum amount exceeded"
        );

        uint256 shareAmount = _previewDeposit(assetAmount);

        __deposit(msg.sender, receiver, assetAmount, shareAmount);

        return shareAmount;
    }

    /**
     * @notice execute a minting of shares on behalf of given address
     * @dev only the vault keeper may call this function
     * @param shareAmount quantity of shares to mint
     * @param receiver recipient of shares resulting from deposit
     * @return assetAmount quantity of assets to deposit
     */
    function _mint(uint256 shareAmount, address receiver)
        internal
        override(ERC4626BaseInternal)
        onlyAuthorized
        returns (uint256)
    {
        require(
            shareAmount <= _maxMint(receiver),
            "ERC4626: maximum amount exceeded"
        );

        uint256 assetAmount = _previewMint(shareAmount);

        __deposit(msg.sender, receiver, assetAmount, shareAmount);

        return assetAmount;
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
    ) internal override(ERC4626BaseInternal) returns (uint256) {
        VaultStorage.Layout storage l = VaultStorage.layout();
        l.Queue.maxRedeemShares(owner);

        require(
            assetAmount <= _maxWithdraw(owner),
            "ERC4626: maximum amount exceeded"
        );

        uint256 shareAmount = _previewWithdraw(assetAmount);

        __withdraw(msg.sender, receiver, owner, assetAmount, shareAmount);

        return shareAmount;
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
    ) internal override(ERC4626BaseInternal) returns (uint256) {
        VaultStorage.Layout storage l = VaultStorage.layout();
        l.Queue.maxRedeemShares(owner);

        require(
            shareAmount <= _maxRedeem(owner),
            "ERC4626: maximum amount exceeded"
        );

        uint256 assetAmount = _previewRedeem(shareAmount);

        __withdraw(msg.sender, receiver, owner, assetAmount, shareAmount);

        return assetAmount;
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
            _balanceDisbursement(assetAmount, _totalAssets());

        // TODO: Calculate and deduct Withdrawal fee

        IERC20(_asset()).safeTransfer(receiver, vaultAssetAmount);

        IERC1155(address(this)).safeTransferFrom(
            address(this),
            receiver,
            VaultStorage.layout().tokenId,
            shortAssetAmount,
            ""
        );

        emit Withdraw(caller, receiver, owner, assetAmount, shareAmount);
    }

    /************************************************
     *  HELPERS
     ***********************************************/

    function _balanceDisbursement(uint256 assetAmount, uint256 totalAssets)
        private
        view
        returns (uint256, uint256)
    {
        VaultStorage.Layout storage l = VaultStorage.layout();

        uint256 tokenId = l.tokenId;

        uint256 vaultAssetRatio =
            l.ERC20.balanceOf(address(this)) / totalAssets;
        uint256 shortAssetRatio =
            l.Pool.balanceOf(address(this), tokenId) / totalAssets;

        uint256 vaultAssetAmount = assetAmount * vaultAssetRatio;
        uint256 shortAssetAmount = assetAmount * shortAssetRatio;

        return (vaultAssetAmount, shortAssetAmount);
    }
}
