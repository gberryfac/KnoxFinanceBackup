// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@solidstate/contracts/token/ERC1155/IERC1155.sol";
import "@solidstate/contracts/token/ERC4626/base/ERC4626BaseInternal.sol";

import "../access/AccessInternal.sol";

import "../interfaces/IPremiaPool.sol";

import "../libraries/ABDKMath64x64Token.sol";
import "../libraries/Helpers.sol";

import "./IVault.sol";
import "./VaultStorage.sol";

import "hardhat/console.sol";

contract VaultInternal is AccessInternal, ERC4626BaseInternal {
    using ABDKMath64x64 for int128;
    using ABDKMath64x64 for uint256;
    using ABDKMath64x64Token for int128;
    using ABDKMath64x64Token for uint256;
    using SafeERC20 for IERC20;
    using VaultStorage for VaultStorage.Layout;

    uint256 private constant UNDERLYING_RESERVED_LIQ_TOKEN_ID =
        0x0200000000000000000000000000000000000000000000000000000000000000;
    uint256 private constant BASE_RESERVED_LIQ_TOKEN_ID =
        0x0300000000000000000000000000000000000000000000000000000000000000;

    IERC20 public immutable ERC20;
    IPremiaPool public immutable Pool;
    IVault public immutable Vault;

    constructor(bool isCall, address pool) {
        Pool = IPremiaPool(pool);
        IPremiaPool.PoolSettings memory settings = Pool.getPoolSettings();
        address asset = isCall ? settings.underlying : settings.base;

        ERC20 = IERC20(asset);
        Vault = IVault(address(this));
    }

    /************************************************
     *  INITIALIZE AUCTION
     ***********************************************/

    function _setAndInitializeAuction() internal {
        _setOptionParameters();
        _setAuctionWindow();
        _initializeAuction();
    }

    function _setOptionParameters() internal {
        VaultStorage.Layout storage l = VaultStorage.layout();

        uint64 expiry = _getNextFriday();

        int128 strike64x64 =
            l.Pricer.getDeltaStrikePrice64x64(l.isCall, expiry, l.delta64x64);

        strike64x64 = l.Pricer.snapToGrid(l.isCall, strike64x64);

        uint64 nextEpoch = l.epoch + 1;

        // Sets parameters for the next option
        VaultStorage.Option storage nextOption = l.options[nextEpoch];

        nextOption.expiry = expiry;
        nextOption.strike64x64 = strike64x64;

        TokenType longTokenType =
            l.isCall ? TokenType.LONG_CALL : TokenType.LONG_PUT;

        nextOption.longTokenId = _formatTokenId(
            longTokenType,
            expiry,
            strike64x64
        );

        TokenType shortTokenType =
            l.isCall ? TokenType.SHORT_CALL : TokenType.SHORT_PUT;

        nextOption.shortTokenId = _formatTokenId(
            shortTokenType,
            expiry,
            strike64x64
        );

        require(nextOption.strike64x64 > 0, "invalid strike price");

        // emit OptionParametersSet(l.isCall, option.expiry, option.strike64x64);
    }

    function _setAuctionWindow() internal {
        VaultStorage.Layout storage l = VaultStorage.layout();
        VaultStorage.Option memory option = l.options[l.epoch];

        uint256 startTimestamp = option.expiry;

        l.startTime = startTimestamp + l.startOffset;
        l.endTime = startTimestamp + l.endOffset;

        // emit SaleWindowSet(startTimestamp, l.startTime, l.endTime);
    }

    function _initializeAuction() internal {
        VaultStorage.Layout storage l = VaultStorage.layout();

        uint64 nextEpoch = l.epoch++;
        VaultStorage.Option storage nextOption = l.options[nextEpoch];

        l.Auction.initialize(
            AuctionStorage.InitAuction(
                nextEpoch,
                nextOption.strike64x64,
                nextOption.longTokenId,
                l.startTime,
                l.endTime
            )
        );
    }

    /************************************************
     *  PROCESS EPOCH
     ***********************************************/

    function _processEpoch(bool processExpired) internal {
        if (processExpired) _processExpired();
        _withdrawReservedLiquidity();
        _collectVaultFees();

        _depositQueuedToVault();
        _setNextEpoch();
        _setAuctionPrices();
    }

    function _processExpired() internal {
        VaultStorage.Layout storage l = VaultStorage.layout();
        VaultStorage.Option storage option = l.options[l.epoch];

        address[] memory accounts = Pool.accountsByToken(option.longTokenId);
        uint256 balances;

        for (uint256 i; i < accounts.length; i++) {
            balances += Pool.balanceOf(accounts[i], option.longTokenId);
        }

        Pool.processExpired(option.longTokenId, balances);
    }

    function _withdrawReservedLiquidity() internal {
        VaultStorage.Layout storage l = VaultStorage.layout();

        uint256 reservedLiquidity =
            Pool.balanceOf(
                address(this),
                l.isCall
                    ? UNDERLYING_RESERVED_LIQ_TOKEN_ID
                    : BASE_RESERVED_LIQ_TOKEN_ID
            );

        Pool.withdraw(reservedLiquidity, l.isCall);

        // emit ReservedLiquidityWithdrawn(reservedLiquidity);
    }

    function _collectVaultFees() internal {
        VaultStorage.Layout storage l = VaultStorage.layout();

        (, uint256 exerciseAmount) = _getExerciseAmount(l.epoch, l.totalShort);

        if (l.totalPremiums > exerciseAmount) {
            /**
             * Take performance fee ONLY if premium remaining after the option expires is positive.
             * If it is negative, last week's option expired ITM past breakeven, and the vault took
             * a loss so we do not collect performance fee for last week.
             */
            uint256 netIncome = l.totalPremiums - exerciseAmount;
            uint256 performanceFeeInAsset =
                (netIncome * l.performanceFee) /
                    (100 * VaultStorage.FEE_MULTIPLIER);

            ERC20.safeTransfer(l.feeRecipient, performanceFeeInAsset);
        }

        l.totalPremiums = 0;

        // Note: index epoch
        // emit CollectPerformanceFee(
        //     l.epoch
        //     netIncome
        //     performanceFeeInAsset
        // );
    }

    function _depositQueuedToVault() internal {
        VaultStorage.Layout storage l = VaultStorage.layout();
        l.Queue.depositToVault();
    }

    function _setNextEpoch() internal {
        VaultStorage.Layout storage l = VaultStorage.layout();
        l.totalShort = 0;
        l.epoch++;

        l.Queue.syncEpoch(l.epoch);

        // Note: index epoch
        // emit SetNextEpoch(l.epoch, l.claimTokenId);
    }

    function _setAuctionPrices() internal {
        VaultStorage.Layout storage l = VaultStorage.layout();
        VaultStorage.Option storage option = l.options[l.epoch];

        require(option.strike64x64 > 0, "delta strike unset");

        int128 offsetStrike64x64 =
            l.Pricer.getDeltaStrikePrice64x64(
                l.isCall,
                option.expiry,
                l.delta64x64 - l.deltaOffset64x64
            );

        offsetStrike64x64 = l.Pricer.snapToGrid(l.isCall, offsetStrike64x64);

        int128 spot64x64 = l.Pricer.latestAnswer64x64();
        int128 timeToMaturity64x64 =
            l.Pricer.getTimeToMaturity64x64(option.expiry);

        int128 maxPrice64x64 =
            l.Pricer.getBlackScholesPrice64x64(
                spot64x64,
                offsetStrike64x64,
                timeToMaturity64x64,
                l.isCall
            );

        int128 minPrice64x64 =
            l.Pricer.getBlackScholesPrice64x64(
                spot64x64,
                option.strike64x64,
                timeToMaturity64x64,
                l.isCall
            );

        if (l.isCall) {
            maxPrice64x64.div(spot64x64);
            minPrice64x64.div(spot64x64);
        }

        l.Auction.setAuctionPrices(l.epoch, maxPrice64x64, minPrice64x64);

        // emit PriceRangeSet(l.maxPrice, l.minPrice);
    }

    /************************************************
     *  PROCESS AUCTION
     ***********************************************/

    function _processAuction() internal {
        VaultStorage.Layout storage l = VaultStorage.layout();
        VaultStorage.Option memory option = l.options[l.epoch];

        if (!l.Auction.isFinalized(l.epoch)) l.Auction.finalizeAuction(l.epoch);

        l.Auction.transferPremium(l.epoch);
        uint256 totalContractsSold = l.Auction.totalContractsSold(l.epoch);

        uint256 totalCollateralUsed =
            l.isCall
                ? totalContractsSold
                : ABDKMath64x64Token.toBaseTokenAmount(
                    l.underlyingDecimals,
                    l.baseDecimals,
                    option.strike64x64.mulu(totalContractsSold)
                );

        ERC20.approve(address(Pool), totalCollateralUsed);

        Pool.writeFrom(
            address(this),
            address(l.Auction),
            option.expiry,
            option.strike64x64,
            totalContractsSold,
            l.isCall
        );

        l.Auction.processAuction(l.epoch);
    }

    /************************************************
     *  VIEW
     ***********************************************/

    function _totalCollateral() internal view returns (uint256) {
        VaultStorage.Layout storage l = VaultStorage.layout();
        return ERC20.balanceOf(address(this)) - l.totalPremiums;
    }

    /************************************************
     *  ERC4626 OVERRIDES
     ***********************************************/

    /**
     * @notice get the total quantity of the assets managed by the vault
     * @return total active asset amount
     */
    function _totalAssets()
        internal
        view
        override(ERC4626BaseInternal)
        returns (uint256)
    {
        VaultStorage.Layout storage l = VaultStorage.layout();
        return _totalCollateral() + l.totalShort + l.totalPremiums;
    }

    /**
     * @notice execute a withdrawal of assets on behalf of given address
     * @dev owner must approve vault to redeem claim tokens
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
    ) internal virtual override(ERC4626BaseInternal) returns (uint256) {
        VaultStorage.Layout storage l = VaultStorage.layout();
        l.Queue.redeemMaxShares(receiver, owner);

        require(
            assetAmount <= _maxWithdraw(owner),
            "ERC4626: maximum amount exceeded"
        );

        uint256 shareAmount = _previewWithdraw(assetAmount);

        _withdraw(msg.sender, receiver, owner, assetAmount, shareAmount);

        return shareAmount;
    }

    /**
     * @notice execute a redemption of shares on behalf of given address
     * @dev owner must approve vault to redeem claim tokens
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
    ) internal virtual override(ERC4626BaseInternal) returns (uint256) {
        VaultStorage.Layout storage l = VaultStorage.layout();
        l.Queue.redeemMaxShares(receiver, owner);

        require(
            shareAmount <= _maxRedeem(owner),
            "ERC4626: maximum amount exceeded"
        );

        uint256 assetAmount = _previewRedeem(shareAmount);

        _withdraw(msg.sender, receiver, owner, assetAmount, shareAmount);

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
    function _withdraw(
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

        (
            uint256 collateralAssetAmount,
            uint256 premiumAssetAmount,
            uint256 shortAssetAmount
        ) = _calculateDistribution(assetAmount);

        VaultStorage.Layout storage l = VaultStorage.layout();

        l.totalPremiums -= premiumAssetAmount;
        l.totalShort -= shortAssetAmount;

        (
            uint256 collateralAssetAmountSansFee,
            uint256 shortAssetAmountSansFee
        ) =
            _collectWithdrawalFee(
                collateralAssetAmount,
                premiumAssetAmount,
                shortAssetAmount
            );

        _transferAssets(
            collateralAssetAmountSansFee,
            shortAssetAmountSansFee,
            receiver
        );

        emit Withdraw(
            caller,
            receiver,
            owner,
            collateralAssetAmountSansFee + shortAssetAmountSansFee,
            shareAmount
        );
    }

    /************************************************
     *  HELPERS
     ***********************************************/

    function _calculateDistribution(uint256 assetAmount)
        private
        view
        returns (
            uint256,
            uint256,
            uint256
        )
    {
        VaultStorage.Layout storage l = VaultStorage.layout();
        uint256 totalAssets = _totalAssets();

        uint256 collateralAssetRatio = l.totalCollateral / totalAssets;
        uint256 premiumRatio = l.totalPremiums / totalAssets;
        uint256 shortAssetRatio = l.totalShort / totalAssets;

        uint256 collateralAssetAmount = assetAmount * collateralAssetRatio;
        uint256 premiumAssetAmount = assetAmount * premiumRatio;
        uint256 shortAssetAmount = assetAmount * shortAssetRatio;

        return (collateralAssetAmount, premiumAssetAmount, shortAssetAmount);
    }

    function _collectWithdrawalFee(
        uint256 collateralAssetAmount,
        uint256 premiumAssetAmount,
        uint256 shortAssetAmount
    ) private returns (uint256, uint256) {
        VaultStorage.Layout storage l = VaultStorage.layout();

        uint256 multiplier = (100 * VaultStorage.FEE_MULTIPLIER);

        uint256 feesInCollateralAsset =
            ((collateralAssetAmount + premiumAssetAmount) * l.withdrawalFee) /
                multiplier;

        uint256 feesInShortAsset =
            (shortAssetAmount * l.withdrawalFee) / multiplier;

        _transferAssets(
            feesInCollateralAsset,
            feesInShortAsset,
            l.feeRecipient
        );

        // Note: index address
        // emit CollectWithdrawalFee(msg.sender, feesInCollateralAsset, feesInShortAsset)

        return (
            collateralAssetAmount + premiumAssetAmount - feesInCollateralAsset,
            shortAssetAmount - feesInShortAsset
        );
    }

    function _transferAssets(
        uint256 collateralAmount,
        uint256 shortAmount,
        address receiver
    ) private {
        VaultStorage.Layout storage l = VaultStorage.layout();
        VaultStorage.Option memory option = l.options[l.epoch];
        IERC1155 ERC1155 = IERC1155(address(this));

        if (collateralAmount > 0) {
            ERC20.safeTransfer(receiver, collateralAmount);
        }

        ERC1155.safeTransferFrom(
            address(this),
            receiver,
            option.shortTokenId,
            shortAmount,
            ""
        );
    }

    function _getNextFriday() private view returns (uint64) {
        return uint64(Helpers.getNextFriday(block.timestamp));
    }

    function _getExerciseAmount(uint64 epoch, uint256 size)
        internal
        view
        returns (bool, uint256)
    {
        VaultStorage.Layout storage l = VaultStorage.layout();
        VaultStorage.Option memory option = l.options[epoch];

        uint64 expiry = option.expiry;
        int128 strike64x64 = option.strike64x64;

        if (block.timestamp < expiry) return (false, 0);

        int128 spot64x64 = Pool.getPriceAfter64x64(expiry);
        uint256 amount;

        if (l.isCall && spot64x64 > strike64x64) {
            amount = spot64x64.sub(strike64x64).div(spot64x64).mulu(size);
        } else if (!l.isCall && strike64x64 > spot64x64) {
            uint256 value = strike64x64.sub(spot64x64).mulu(size);
            amount = ABDKMath64x64Token.toBaseTokenAmount(
                l.underlyingDecimals,
                l.baseDecimals,
                value
            );
        }

        return (true, amount);
    }

    enum TokenType {
        UNDERLYING_FREE_LIQ,
        BASE_FREE_LIQ,
        UNDERLYING_RESERVED_LIQ,
        BASE_RESERVED_LIQ,
        LONG_CALL,
        SHORT_CALL,
        LONG_PUT,
        SHORT_PUT
    }

    function _formatTokenId(
        TokenType tokenType,
        uint64 maturity,
        int128 strike64x64
    ) private pure returns (uint256 tokenId) {
        tokenId =
            (uint256(tokenType) << 248) +
            (uint256(maturity) << 128) +
            uint256(int256(strike64x64));
    }
}
