// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../auction/DutchAuctionStorage.sol";

import "../../libraries/ABDKMath64x64Token.sol";
import "../../libraries/Helpers.sol";

import "./BaseInternal.sol";

contract AdminInternal is BaseInternal {
    using ABDKMath64x64 for int128;
    using ABDKMath64x64Token for int128;
    using SafeERC20 for IERC20;
    using Storage for Storage.Layout;

    constructor(bool isCall, address pool) BaseInternal(isCall, pool) {}

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
        Storage.Layout storage l = Storage.layout();

        uint64 expiry = _getNextFriday();

        int128 strike64x64 =
            l.Pricer.getDeltaStrikePrice64x64(l.isCall, expiry, l.delta64x64);

        strike64x64 = l.Pricer.snapToGrid(l.isCall, strike64x64);

        // Sets parameters for the next option
        Storage.Option storage nextOption = l.options[l.epoch++];

        nextOption.expiry = expiry;
        nextOption.strike64x64 = strike64x64;

        require(nextOption.strike64x64 > 0, "invalid strike price");

        // emit OptionParametersSet(l.isCall, option.expiry, option.strike64x64);
    }

    function _setAuctionPrices() internal {
        Storage.Layout storage l = Storage.layout();
        Storage.Option storage nextOption = l.options[l.epoch++];

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
        Storage.Layout storage l = Storage.layout();
        Storage.Option memory option = l.options[l.epoch];

        uint256 startTimestamp = option.expiry;

        l.startTime = startTimestamp + l.startOffset;
        l.endTime = startTimestamp + l.endOffset;

        // emit SaleWindowSet(startTimestamp, l.startTime, l.endTime);
    }

    function _initializeAuction() internal {
        Storage.Layout storage l = Storage.layout();

        l.Auction.initializeAuction(
            DutchAuctionStorage.InitAuction(
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
        Storage.Layout storage l = Storage.layout();

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
        Storage.Layout storage l = Storage.layout();

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
        Storage.Layout storage l = Storage.layout();

        uint256 mintedShares = _deposit(l.totalDeposits, address(this));
        l.totalDeposits = 0;

        uint256 _pricePerShare = 10**18;
        uint256 totalSupply = Vault.totalSupply(l.epoch);

        if (mintedShares > 0 && totalSupply > 0) {
            _pricePerShare = (_pricePerShare * mintedShares) / totalSupply;
        }

        l.pricePerShare[l.epoch] = _pricePerShare;

        // emit DepositQueuedToVault(pricePerShare, mintedShares);
    }

    function _setNextEpoch() internal {
        Storage.Layout storage l = Storage.layout();

        l.claimTokenId = _formatClaimTokenId(l.epoch);
        l.totalShort = 0;

        l.epoch++;

        // Note: index epoch
        // emit SetNextEpoch(l.epoch, l.claimTokenId);
    }

    /************************************************
     *  PROCESS AUCTION
     ***********************************************/

    function _processAuction() internal {
        Storage.Layout storage l = Storage.layout();
        if (!l.Auction.isFinalized(l.epoch)) l.Auction.finalizeAuction(l.epoch);
        l.Auction.transferPremium(l.epoch);

        uint256 totalCollateralUsed = l.Auction.totalCollateralUsed(l.epoch);

        Storage.Option memory option = l.options[l.epoch];

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
     * HELPERS
     ***********************************************/

    function _getNextFriday() private view returns (uint64) {
        return uint64(Helpers.getNextFriday(block.timestamp));
    }

    function _formatClaimTokenId(uint64 epoch) internal view returns (uint256) {
        return (uint256(uint160(address(this))) << 16) + uint16(epoch);
    }

    // TODO:
    function _parseClaimTokenId(uint256 claimTokenId)
        internal
        view
        returns (uint64)
    {
        // returns epoch
    }

    function _getIntrinsicValue(uint64 epoch, uint256 size)
        internal
        view
        returns (bool, uint256)
    {
        Storage.Layout storage l = Storage.layout();
        Storage.Option memory option = l.options[epoch];

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
