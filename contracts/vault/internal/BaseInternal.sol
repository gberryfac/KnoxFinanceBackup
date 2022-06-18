// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@solidstate/contracts/token/ERC1155/IERC1155.sol";
import "@solidstate/contracts/token/ERC4626/base/ERC4626BaseInternal.sol";

import "../IVault.sol";

import "./AccessInternal.sol";

import "hardhat/console.sol";

contract BaseInternal is AccessInternal, ERC4626BaseInternal {
    using SafeERC20 for IERC20;
    using Storage for Storage.Layout;

    IERC20 immutable ERC20;
    IPremiaPool immutable Pool;
    IVault immutable Vault;

    constructor(bool isCall, address pool) {
        Pool = IPremiaPool(pool);

        PoolStorage.PoolSettings memory settings = Pool.getPoolSettings();
        address asset = isCall ? settings.underlying : settings.base;

        ERC20 = IERC20(asset);
        Vault = IVault(address(this));
    }

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
        Storage.Layout storage l = Storage.layout();
        uint256 erc20Amount = ERC20.balanceOf(address(this));
        uint256 shortTokenAmount =
            Pool.balanceOf(address(this), l.optionTokenId);

        if (l.optionTokenId == 0) shortTokenAmount = 0;
        return erc20Amount + shortTokenAmount - l.totalQueuedAssets;
    }

    /**
     * @notice execute a deposit of assets on behalf of given address
     * @dev only the vault keeper may call this function
     * @param assetAmount quantity of assets to deposit
     * @param receiver recipient of shares resulting from deposit
     * @return shareAmount quantity of shares to mint
     */
    function _deposit(uint256 assetAmount, address receiver)
        internal
        virtual
        override(ERC4626BaseInternal)
        onlyKeeper
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
        virtual
        override(ERC4626BaseInternal)
        onlyKeeper
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
     * @dev this function may not be called while the auction is in progress
     * @param assetAmount quantity of assets to withdraw
     * @param receiver recipient of assets resulting from withdrawal
     * @param owner holder of shares to be redeemed
     * @return shareAmount quantity of shares to redeem
     */
    function _withdraw(
        uint256 assetAmount,
        address receiver,
        address owner
    )
        internal
        virtual
        override(ERC4626BaseInternal)
        AuctionInactive
        returns (uint256)
    {
        Vault.maxRedeemShares(owner);

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
     * @dev this function may not be called while the auction is in progress
     * @param shareAmount quantity of shares to redeem
     * @param receiver recipient of assets resulting from withdrawal
     * @param owner holder of shares to be redeemed
     * @return assetAmount quantity of assets to withdraw
     */
    function _redeem(
        uint256 shareAmount,
        address receiver,
        address owner
    )
        internal
        virtual
        override(ERC4626BaseInternal)
        AuctionInactive
        returns (uint256)
    {
        Vault.maxRedeemShares(owner);

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
            Storage.layout().optionTokenId,
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
        Storage.Layout storage l = Storage.layout();

        uint256 vaultAssetRatio = ERC20.balanceOf(address(this)) / totalAssets;
        uint256 shortAssetRatio =
            Pool.balanceOf(address(this), l.optionTokenId) / totalAssets;

        uint256 vaultAssetAmount = assetAmount * vaultAssetRatio;
        uint256 shortAssetAmount = assetAmount * shortAssetRatio;
        return (vaultAssetAmount, shortAssetAmount);
    }
}
