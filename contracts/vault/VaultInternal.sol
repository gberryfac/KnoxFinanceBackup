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
    using ABDKMath64x64Token for int128;
    using SafeERC20 for IERC20;
    using VaultStorage for VaultStorage.Layout;

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
     *  EXERCISE
     ***********************************************/

    function _exercise(
        address holder,
        uint256 longTokenId,
        uint256 contractSize
    ) internal {
        Pool.exerciseFrom(holder, longTokenId, contractSize);
    }

    /************************************************
     * PURCHASE
     ***********************************************/

    // TODO:
    function _purchase(uint256 contractSize) internal {}

    /************************************************
     *  INITIALIZE AUCTION
     ***********************************************/

    function _setAndInitializeAuction() internal {
        _setOptionParameters();
        _setAuctionPrices();
        _setAuctionWindow();
        _initializeAuction();
    }

    function _setOptionParameters() internal {
        VaultStorage.Layout storage l = VaultStorage.layout();

        uint64 expiry = _getNextFriday();

        int128 strike64x64 =
            l.Pricer.getDeltaStrikePrice64x64(l.isCall, expiry, l.delta64x64);

        strike64x64 = l.Pricer.snapToGrid(l.isCall, strike64x64);

        // Sets parameters for the next option
        VaultStorage.Option storage nextOption = l.options[l.epoch++];

        nextOption.expiry = expiry;
        nextOption.strike64x64 = strike64x64;

        require(nextOption.strike64x64 > 0, "invalid strike price");

        // emit OptionParametersSet(l.isCall, option.expiry, option.strike64x64);
    }

    function _setAuctionPrices() internal {
        VaultStorage.Layout storage l = VaultStorage.layout();
        VaultStorage.Option storage nextOption = l.options[l.epoch++];

        require(nextOption.strike64x64 > 0, "delta strike unset");

        int128 offsetStrike64x64 =
            l.Pricer.getDeltaStrikePrice64x64(
                l.isCall,
                nextOption.expiry,
                l.delta64x64 - l.deltaOffset64x64
            );

        offsetStrike64x64 = l.Pricer.snapToGrid(l.isCall, offsetStrike64x64);

        int128 spot64x64 = l.Pricer.latestAnswer64x64();
        int128 timeToMaturity64x64 =
            l.Pricer.getTimeToMaturity64x64(nextOption.expiry);

        int128 minPrice =
            l.Pricer.getBlackScholesPrice64x64(
                spot64x64,
                nextOption.strike64x64,
                timeToMaturity64x64,
                l.isCall
            );

        int128 maxPrice =
            l.Pricer.getBlackScholesPrice64x64(
                spot64x64,
                offsetStrike64x64,
                timeToMaturity64x64,
                l.isCall
            );

        // TODO: Skip auction, if true
        require(maxPrice > minPrice, "maxPrice <= minPrice");

        uint8 decimals = l.isCall ? l.underlyingDecimals : l.baseDecimals;

        l.maxPrice = maxPrice.toDecimals(decimals);
        l.minPrice = minPrice.toDecimals(decimals);

        // emit PriceRangeSet(l.maxPrice, l.minPrice);
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

        l.Auction.initialize(
            AuctionStorage.InitAuction(
                l.epoch++,
                l.startTime,
                l.endTime,
                l.maxPrice,
                l.minPrice,
                l.minimumContractSize
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
    }

    function _processExpired() internal {
        uint256[] memory tokenIds = Pool.tokensByAccount(address(this));

        for (uint256 i; i < tokenIds.length; i++) {
            if (
                tokenIds[i] != Constants.UNDERLYING_RESERVED_LIQ_TOKEN_ID &&
                tokenIds[i] != Constants.BASE_RESERVED_LIQ_TOKEN_ID
            ) {
                uint256 tokenBalance =
                    Pool.balanceOf(address(this), tokenIds[i]);

                // Don't process dust
                if (tokenBalance >= 10**14) {
                    Pool.processExpired(tokenIds[i], tokenBalance);
                }
            }
        }
    }

    function _withdrawReservedLiquidity() internal {
        VaultStorage.Layout storage l = VaultStorage.layout();

        uint256 reservedLiquidity =
            Pool.balanceOf(
                address(this),
                l.isCall
                    ? Constants.UNDERLYING_RESERVED_LIQ_TOKEN_ID
                    : Constants.BASE_RESERVED_LIQ_TOKEN_ID
            );

        Pool.withdraw(reservedLiquidity, l.isCall);

        // emit ReservedLiquidityWithdrawn(reservedLiquidity);
    }

    function _collectVaultFees() internal {
        VaultStorage.Layout storage l = VaultStorage.layout();

        (, uint256 intrinsicValue) = _getIntrinsicValue(l.epoch, l.totalShort);

        if (l.totalPremiums > intrinsicValue) {
            /**
             * Take performance fee ONLY if premium remaining after the option expires is positive.
             * If it is negative, last week's option expired ITM past breakeven, and the vault took
             * a loss so we do not collect performance fee for last week.
             */
            uint256 netIncome = l.totalPremiums - intrinsicValue;
            uint256 performanceFeeInAsset =
                (netIncome * l.performanceFee) /
                    (100 * Constants.FEE_MULTIPLIER);

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

    /************************************************
     *  PROCESS AUCTION
     ***********************************************/

    function _processAuction() internal {
        VaultStorage.Layout storage l = VaultStorage.layout();
        if (!l.Auction.isFinalized(l.epoch)) l.Auction.finalizeAuction(l.epoch);
        l.Auction.transferPremium(l.epoch);

        uint256 totalCollateralUsed = l.Auction.totalCollateralUsed(l.epoch);

        VaultStorage.Option memory option = l.options[l.epoch];

        (uint256 longTokenId, ) =
            Pool.writeFrom(
                address(this),
                address(l.Auction),
                option.expiry,
                option.strike64x64,
                totalCollateralUsed,
                l.isCall
            );

        l.Auction.setLongTokenId(l.epoch, longTokenId);
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

        uint256 multiplier = (100 * Constants.FEE_MULTIPLIER);

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
            option.optionTokenId,
            shortAmount,
            ""
        );
    }

    function _getNextFriday() private view returns (uint64) {
        return uint64(Helpers.getNextFriday(block.timestamp));
    }

    function _getIntrinsicValue(uint64 epoch, uint256 size)
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
        uint256 intrinsicValue;

        if (l.isCall && spot64x64 > strike64x64) {
            intrinsicValue = spot64x64.sub(strike64x64).mulu(size);
        } else if (!l.isCall && strike64x64 > spot64x64) {
            intrinsicValue = strike64x64.sub(spot64x64).mulu(size);
        }

        // TODO: toDecimal(?)
        return (true, intrinsicValue);
    }
}
