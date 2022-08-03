// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@solidstate/contracts/token/ERC4626/base/ERC4626BaseInternal.sol";

import "../access/AccessInternal.sol";

import "../interfaces/IPremiaPool.sol";

import "../libraries/ABDKMath64x64Token.sol";
import "../libraries/Helpers.sol";

import "./IVault.sol";
import "./IVaultEvents.sol";
import "./VaultStorage.sol";

import "hardhat/console.sol";

contract VaultInternal is AccessInternal, ERC4626BaseInternal, IVaultEvents {
    using ABDKMath64x64 for int128;
    using ABDKMath64x64 for uint256;
    using ABDKMath64x64Token for int128;
    using ABDKMath64x64Token for uint256;
    using Helpers for uint256;
    using SafeERC20 for IERC20;
    using VaultStorage for VaultStorage.Layout;

    int128 private constant ONE_64x64 = 0x10000000000000000;
    uint256 private constant UNDERLYING_RESERVED_LIQ_TOKEN_ID =
        0x0200000000000000000000000000000000000000000000000000000000000000;
    uint256 private constant BASE_RESERVED_LIQ_TOKEN_ID =
        0x0300000000000000000000000000000000000000000000000000000000000000;

    IERC20 public immutable ERC20;
    IPremiaPool public immutable Pool;

    constructor(bool isCall, address pool) {
        Pool = IPremiaPool(pool);
        IPremiaPool.PoolSettings memory settings = Pool.getPoolSettings();
        address asset = isCall ? settings.underlying : settings.base;

        ERC20 = IERC20(asset);
    }

    /************************************************
     *  ADMIN
     ***********************************************/

    function _setAuctionWindowOffsets(uint16 start, uint16 end) internal {
        VaultStorage.Layout storage l = VaultStorage.layout();
        l.startOffset = start;
        l.endOffset = end;
        // emit AuctionWindowOffsetsSet();
    }

    function _setFeeRecipient(address newFeeRecipient) internal {
        VaultStorage.Layout storage l = VaultStorage.layout();
        require(newFeeRecipient != address(0), "address not provided");
        require(newFeeRecipient != l.feeRecipient, "new address equals old");
        l.feeRecipient = newFeeRecipient;
        // emit FeeRecipientSet();
    }

    function _setPricer(address newPricer) internal {
        VaultStorage.Layout storage l = VaultStorage.layout();
        require(newPricer != address(0), "address not provided");
        require(newPricer != address(l.Pricer), "new address equals old");
        l.Pricer = IPricer(newPricer);
        // emit PricerSet();
    }

    function _setPerformanceFee64x64(int128 newPerformanceFee64x64) internal {
        VaultStorage.Layout storage l = VaultStorage.layout();
        require(newPerformanceFee64x64 < ONE_64x64, "invalid fee amount");
        l.performanceFee64x64 = newPerformanceFee64x64;
        // emit PerformanceFeeSet(l.performanceFee64x64, newPerformanceFee);
    }

    function _setWithdrawalFee64x64(int128 newWithdrawalFee64x64) internal {
        VaultStorage.Layout storage l = VaultStorage.layout();
        require(newWithdrawalFee64x64 < ONE_64x64, "invalid fee amount");
        l.withdrawalFee64x64 = newWithdrawalFee64x64;
        // emit WithdrawalFeeSet(l.withdrawalFee64x64, newWithdrawalFee64x64);
    }

    /************************************************
     *  INITIALIZE AUCTION
     ***********************************************/

    function _setAndInitializeAuction() internal {
        _setOptionParameters();
        _setAuctionWindow();
        _initializeAuction();
    }

    // sets option parameters used in the current epoch's auction
    function _setOptionParameters() internal {
        VaultStorage.Layout storage l = VaultStorage.layout();

        uint64 expiry = _getNextFriday();

        int128 strike64x64 =
            l.Pricer.getDeltaStrikePrice64x64(l.isCall, expiry, l.delta64x64);

        strike64x64 = l.Pricer.snapToGrid(l.isCall, strike64x64);

        // Sets parameters for the next option
        VaultStorage.Option storage option = l.options[l.epoch];

        option.expiry = expiry;
        option.strike64x64 = strike64x64;

        TokenType longTokenType =
            l.isCall ? TokenType.LONG_CALL : TokenType.LONG_PUT;

        option.longTokenId = _formatTokenId(longTokenType, expiry, strike64x64);

        TokenType shortTokenType =
            l.isCall ? TokenType.SHORT_CALL : TokenType.SHORT_PUT;

        option.shortTokenId = _formatTokenId(
            shortTokenType,
            expiry,
            strike64x64
        );

        require(option.strike64x64 > 0, "invalid strike price");

        // emit OptionParametersSet(l.isCall, option.expiry, option.strike64x64);
    }

    // TODO: merge with initializeAuction()???
    function _setAuctionWindow() internal {
        VaultStorage.Layout storage l = VaultStorage.layout();
        VaultStorage.Option memory option = l.options[l.epoch];

        uint256 startTimestamp = option.expiry;

        if (l.epoch == 0) startTimestamp = Helpers._getFriday(block.timestamp);

        l.startTime = startTimestamp + l.startOffset;
        l.endTime = startTimestamp + l.endOffset;

        // emit SaleWindowSet(startTimestamp, l.startTime, l.endTime);
    }

    function _initializeAuction() internal {
        VaultStorage.Layout storage l = VaultStorage.layout();
        VaultStorage.Option storage option = l.options[l.epoch];

        l.Auction.initialize(
            AuctionStorage.InitAuction(
                l.epoch,
                option.strike64x64,
                option.longTokenId,
                l.startTime,
                l.endTime
            )
        );
    }

    /************************************************
     *  PROCESS EPOCH
     ***********************************************/

    function _initializeAndProcessEpochs(bool processExpired) internal {
        _processLastEpoch(processExpired);
        _initalizeNextEpoch();
    }

    function _processLastEpoch(bool processExpired) internal {
        if (processExpired) _processExpired();
        _withdrawReservedLiquidity();
        _collectPerformanceFee();
    }

    function _initalizeNextEpoch() internal {
        _depositQueuedToVault();
        _setAuctionPrices();
        _setNextEpoch();
    }

    // processes expired options underwritten in previous epoch
    function _processExpired() internal {
        VaultStorage.Layout storage l = VaultStorage.layout();

        uint64 lastEpoch = l.epoch - 1;
        VaultStorage.Option storage option = l.options[lastEpoch];

        address[] memory accounts = Pool.accountsByToken(option.longTokenId);
        uint256 balances;

        for (uint256 i; i < accounts.length; i++) {
            balances += Pool.balanceOf(accounts[i], option.longTokenId);
        }

        Pool.processExpired(option.longTokenId, balances);
    }

    // withdraws reserved liquidity from options underwritten in previous epoch
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

    // collect performance fees on net income collected in previous epoch
    function _collectPerformanceFee() internal {
        VaultStorage.Layout storage l = VaultStorage.layout();

        uint64 lastEpoch = l.epoch - 1;
        (, uint256 exerciseAmount) =
            _getExerciseAmount(lastEpoch, l.totalShortContracts);

        if (l.totalPremiums > exerciseAmount) {
            /**
             * Take performance fee ONLY if premium remaining after the option expires is positive.
             * If it is negative, last week's option expired ITM past breakeven, and the vault took
             * a loss so we do not collect performance fee for last week.
             */
            uint256 netIncome = l.totalPremiums - exerciseAmount;
            uint256 performanceFeeInAsset =
                l.performanceFee64x64.mulu(netIncome);

            ERC20.safeTransfer(l.feeRecipient, performanceFeeInAsset);
        }

        l.totalPremiums = 0;

        // Note: index epoch
        // emit CollectPerformanceFee(
        //     lastEpoch
        //     netIncome
        //     performanceFeeInAsset
        // );
    }

    // transfers collateral deposited in current epoch from queue to vault
    function _depositQueuedToVault() internal {
        VaultStorage.Layout storage l = VaultStorage.layout();
        l.Queue.depositToVault();
    }

    // sets option prices of current epoch auction
    function _setAuctionPrices() internal {
        VaultStorage.Layout storage l = VaultStorage.layout();
        VaultStorage.Option storage option = l.options[l.epoch];

        require(option.strike64x64 > 0, "delta strike unset");

        int128 offsetStrike64x64 =
            l.Pricer.getDeltaStrikePrice64x64(
                l.isCall,
                option.expiry,
                l.delta64x64.sub(l.deltaOffset64x64)
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
            // denominates price in collateral asset
            maxPrice64x64.div(spot64x64);
            minPrice64x64.div(spot64x64);
        }

        l.Auction.setAuctionPrices(l.epoch, maxPrice64x64, minPrice64x64);

        // emit PriceRangeSet(l.maxPrice, l.minPrice);
    }

    // resets state variables and increments epoch id
    function _setNextEpoch() internal {
        VaultStorage.Layout storage l = VaultStorage.layout();
        l.totalShortContracts = 0;

        // transitions to next epoch
        l.epoch = l.epoch + 1;

        l.Queue.syncEpoch(l.epoch);

        // Note: index epoch
        // emit SetNextEpoch(l.epoch);
    }

    /************************************************
     *  PROCESS AUCTION
     ***********************************************/

    // processes auction initialized in previous epoch
    function _processAuction() internal {
        VaultStorage.Layout storage l = VaultStorage.layout();

        uint64 lastEpoch = l.epoch - 1;
        VaultStorage.Option memory option = l.options[lastEpoch];

        if (!l.Auction.isFinalized(lastEpoch))
            l.Auction.finalizeAuction(lastEpoch);

        l.totalPremiums = l.Auction.transferPremium(lastEpoch);
        uint256 totalContractsSold = l.Auction.getTotalContractsSold(lastEpoch);

        uint256 totalCollateralUsed =
            totalContractsSold._fromContractsToCollateral(
                l.isCall,
                l.underlyingDecimals,
                l.baseDecimals,
                option.strike64x64
            );

        ERC20.approve(address(Pool), totalCollateralUsed + _totalReserves());

        Pool.writeFrom(
            address(this),
            address(l.Auction),
            option.expiry,
            option.strike64x64,
            totalContractsSold,
            l.isCall
        );

        uint64 divestmentTimestamp = uint64(block.timestamp + 24 hours);
        Pool.setDivestmentTimestamp(divestmentTimestamp, l.isCall);

        l.totalShortContracts = totalContractsSold;
        l.Auction.processAuction(lastEpoch);
    }

    /************************************************
     *  VIEW
     ***********************************************/

    function _totalCollateral() internal view returns (uint256) {
        VaultStorage.Layout storage l = VaultStorage.layout();
        return
            ERC20.balanceOf(address(this)) - l.totalPremiums - _totalReserves();
    }

    function _totalReserves() internal view returns (uint256) {
        VaultStorage.Layout storage l = VaultStorage.layout();
        return l.reserveRate64x64.mulu(ERC20.balanceOf(address(this)));
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

        // references the last option underwritten by the vault
        uint64 lastEpoch = l.epoch > 0 ? l.epoch - 1 : 0;
        VaultStorage.Option memory option = l.options[lastEpoch];

        uint256 shortPositionValue =
            l.totalShortContracts._fromContractsToCollateral(
                l.isCall,
                l.underlyingDecimals,
                l.baseDecimals,
                option.strike64x64
            );

        return _totalCollateral() + shortPositionValue + l.totalPremiums;
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
        l.Queue.redeemMax(receiver, owner);

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
        l.Queue.redeemMax(receiver, owner);

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
        VaultStorage.Layout storage l = VaultStorage.layout();

        require(l.epoch > 0, "cannot withdraw on epoch 0");

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
            uint256 shortContracts
        ) = _calculateDistribution(assetAmount);

        l.totalPremiums -= premiumAssetAmount;
        l.totalShortContracts -= shortContracts;

        (
            uint256 collateralAssetAmountSansFee,
            uint256 shortAssetAmountSansFee
        ) =
            _collectWithdrawalFee(
                collateralAssetAmount,
                premiumAssetAmount,
                shortContracts
            );

        _transferAssets(
            collateralAssetAmountSansFee,
            shortAssetAmountSansFee,
            receiver
        );

        // emit Withdraw(
        //     caller,
        //     receiver,
        //     owner,
        //     collateralAssetAmountSansFee + shortAssetAmountSansFee,
        //     shareAmount
        // );
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
        uint256 scale =
            l.isCall ? 10**l.underlyingDecimals : 10**l.baseDecimals;

        // TODO: move math logic to function
        uint256 collateralAssetRatio =
            _totalCollateral() > 0
                ? (scale * _totalCollateral()) / totalAssets
                : 0;

        uint256 premiumRatio =
            l.totalPremiums > 0 ? (scale * l.totalPremiums) / totalAssets : 0;

        uint256 shortPositionValue =
            l.totalShortContracts._fromContractsToCollateral(
                l.isCall,
                l.underlyingDecimals,
                l.baseDecimals,
                l.options[l.epoch - 1].strike64x64
            );

        // calculate the short asset ratio based on the short position value
        uint256 shortAssetRatio =
            shortPositionValue > 0
                ? (scale * shortPositionValue) / totalAssets
                : 0;

        // TODO: move math logic to function
        uint256 collateralAssetAmount =
            collateralAssetRatio > 0
                ? (assetAmount * collateralAssetRatio) / scale
                : 0;

        uint256 premiumAssetAmount =
            premiumRatio > 0 ? (assetAmount * premiumRatio) / scale : 0;

        uint256 shortContracts =
            shortAssetRatio > 0 ? (assetAmount * shortAssetRatio) / scale : 0;

        // calculate the number of contracts that will be sent to the LP
        shortContracts = shortContracts._fromCollateralToContracts(
            l.isCall,
            l.baseDecimals,
            l.options[l.epoch - 1].strike64x64
        );

        return (collateralAssetAmount, premiumAssetAmount, shortContracts);
    }

    function _collectWithdrawalFee(
        uint256 collateralAssetAmount,
        uint256 premiumAssetAmount,
        uint256 shortContracts
    ) private returns (uint256, uint256) {
        VaultStorage.Layout storage l = VaultStorage.layout();

        uint256 feesInCollateralAsset =
            l.withdrawalFee64x64.mulu(
                collateralAssetAmount + premiumAssetAmount
            );

        uint256 feesInShortAsset = l.withdrawalFee64x64.mulu(shortContracts);

        _transferAssets(
            feesInCollateralAsset,
            feesInShortAsset,
            l.feeRecipient
        );

        // Note: index address
        // emit CollectWithdrawalFee(msg.sender, feesInCollateralAsset, feesInShortAsset)

        return (
            collateralAssetAmount + premiumAssetAmount - feesInCollateralAsset,
            shortContracts - feesInShortAsset
        );
    }

    function _transferAssets(
        uint256 collateralAmount,
        uint256 shortAmount,
        address receiver
    ) private {
        VaultStorage.Layout storage l = VaultStorage.layout();
        uint64 lastEpoch = l.epoch - 1;

        if (collateralAmount > 0) {
            ERC20.safeTransfer(receiver, collateralAmount);
        }

        if (shortAmount > 0) {
            Pool.safeTransferFrom(
                address(this),
                receiver,
                l.options[lastEpoch].shortTokenId,
                shortAmount,
                ""
            );
        }
    }

    function _getNextFriday() private view returns (uint64) {
        return uint64(Helpers._getNextFriday(block.timestamp));
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
