// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "abdk-libraries-solidity/ABDKMath64x64.sol";

import "../../libraries/Helpers.sol";

import "./BaseInternal.sol";

contract AdminInternal is BaseInternal {
    using ABDKMath64x64 for int128;
    using SafeERC20 for IERC20;
    using Storage for Storage.Layout;

    constructor(bool isCall, address pool) BaseInternal(isCall, pool) {}

    /************************************************
     *  OPERATIONS
     ***********************************************/

    function _processEpoch(bool processExpired) internal {
        if (processExpired) _processExpired();
        _withdrawReservedLiquidity();
        _collectVaultFees();

        _depositQueuedToVault();

        _setNextEpoch();
        _setOptionParameters();

        _setAuctionPrices();
        _setAuctionWindow();
    }

    function _processExpired() internal {
        Storage.Layout storage l = Storage.layout();
        uint256[] memory tokenIds = Pool.tokensByAccount(address(this));

        for (uint256 i; i < tokenIds.length; i++) {
            if (
                tokenIds[i] != Constants.UNDERLYING_RESERVED_LIQ_TOKEN_ID &&
                tokenIds[i] != Constants.BASE_RESERVED_LIQ_TOKEN_ID
            ) {
                uint256 tokenBalance =
                    Pool.balanceOf(address(this), tokenIds[i]);

                if (tokenBalance >= l.minimumContractSize) {
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

        int128 spot64x64 = Pool.getPriceAfter64x64(l.expiry);
        uint256 intrinsicValue = 0;

        if (l.isCall && spot64x64 > l.strike64x64) {
            intrinsicValue = spot64x64.sub(l.strike64x64).mulu(
                l.totalShortAssets
            );
        } else if (!l.isCall && l.strike64x64 > spot64x64) {
            intrinsicValue = l.strike64x64.sub(spot64x64).mulu(
                l.totalShortAssets
            );
        }

        uint256 netIncome = l.totalPremiums - intrinsicValue;

        if (netIncome > 0) {
            /**
             * Take performance fee ONLY if premium remaining after the option expires is positive.
             * If it is negative, last week's option expired ITM past breakeven, and the vault took
             * a loss so we do not collect performance fee for last week.
             */
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

        uint256 epoch = l.epoch;
        uint256 totalSupply = Vault.totalSupply(epoch);

        if (mintedShares > 0 && totalSupply > 0) {
            _pricePerShare = (_pricePerShare * mintedShares) / totalSupply;
        }

        l.pricePerShare[l.epoch] = _pricePerShare;

        // emit DepositQueuedToVault(pricePerShare, mintedShares);
    }

    function _setNextEpoch() internal {
        Storage.Layout storage l = Storage.layout();
        l.epoch++;

        l.claimTokenId = _formatClaimTokenId(l.epoch);
        l.totalShortAssets = 0;

        // Note: index epoch
        // emit SetNextEpoch(l.epoch, l.claimTokenId);
    }

    function _setOptionParameters() internal {
        Storage.Layout storage l = Storage.layout();

        l.expiry = _getNextFriday();

        l.strike64x64 = l.Pricer.getDeltaStrikePrice64x64(
            l.isCall,
            l.expiry,
            l.delta64x64
        );

        l.strike64x64 = l.Pricer.snapToGrid(l.isCall, l.strike64x64);

        require(l.strike64x64 > 0, "invalid strike price");

        // emit OptionParametersSet(l.isCall, l.expiry, l.strike64x64);
    }

    // TODO:
    function _setAuctionPrices() internal {}

    function _setAuctionWindow() internal {
        Storage.Layout storage l = Storage.layout();

        uint256 startTimestamp = block.timestamp;

        l.saleWindow[0] = startTimestamp + l.startOffset;
        l.saleWindow[1] = startTimestamp + l.endOffset;

        // emit SaleWindowSet(startTimestamp, l.saleWindow[0], l.saleWindow[1]);
    }

    // // TODO: Change to '_underwrite' function
    // // TODO: When a position is underwritten update l.totalShortAssets
    // function _borrow(Storage.Layout storage l, uint256 amount) internal {
    //     uint256 totalFreeLiquidity = ERC20.balanceOf(address(this)) -
    //         l.totalDeposits;

    //     require(totalFreeLiquidity >= amount, Errors.FREE_LIQUIDTY_EXCEEDED);

    //     ERC20.safeTransfer(l.strategy, amount);
    // }

    /************************************************
     * HELPERS
     ***********************************************/

    function _getNextFriday() private view returns (uint64) {
        return uint64(Helpers.getNextFriday(block.timestamp));
    }

    function _formatClaimTokenId(uint64 epoch) private view returns (uint256) {
        return (uint256(uint160(address(this))) << 16) + uint16(epoch);
    }
}
