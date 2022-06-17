// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../libraries/Helpers.sol";

import "./BaseInternal.sol";

contract AdminInternal is BaseInternal {
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
        _setOptionParameters();

        _setAuctionPrices();
        _setAuctionWindow();

        Storage.Layout storage l = Storage.layout();

        l.epoch++;

        l.claimTokenId = _formatClaimTokenId(l.epoch);
        l.lastTotalAssets = _totalAssets();

        // Note: index epoch
        // emit SetNextEpoch(l.epoch, l.claimTokenId, l.lastTotalAssets);
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
        // uint256 liquidityBefore = ERC20.balanceOf(address(this));

        uint256 reservedLiquidity =
            Pool.balanceOf(
                address(this),
                l.isCall
                    ? Constants.UNDERLYING_RESERVED_LIQ_TOKEN_ID
                    : Constants.BASE_RESERVED_LIQ_TOKEN_ID
            );

        Pool.withdraw(reservedLiquidity, l.isCall);

        // uint256 liquidityAfter = ERC20.balanceOf(address(this));

        // emit(liquidityBefore, liquidityAfter, reservedLiquidity);
    }

    function _collectVaultFees() internal {
        Storage.Layout storage l = Storage.layout();

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

                ERC20.safeTransfer(l.feeRecipient, vaultFee);
            }
        }

        if (vaultFee > 0) {
            ERC20.safeTransfer(l.feeRecipient, vaultFee);
        }

        // emit DisbursedVaultFees(
        //     vaultFee,
        //     managementFeeInAsset,
        //     performanceFeeInAsset
        // );
    }

    function _depositQueuedToVault() internal {
        Storage.Layout storage l = Storage.layout();
        uint256 mintedShares = _deposit(l.totalQueuedAssets, address(this));

        l.totalQueuedAssets = 0;
        uint256 _pricePerShare = 10**18;

        uint256 epoch = l.epoch;
        uint256 totalSupply = Vault.totalSupply(epoch);

        if (mintedShares > 0 && totalSupply > 0) {
            _pricePerShare = (_pricePerShare * mintedShares) / totalSupply;
        }

        l.pricePerShare[l.epoch] = _pricePerShare;

        // emit DepositQueuedToVault(pricePerShare, mintedShares);
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
    // function _borrow(Storage.Layout storage l, uint256 amount) internal {
    //     uint256 totalFreeLiquidity = ERC20.balanceOf(address(this)) -
    //         l.totalQueuedAssets;

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
