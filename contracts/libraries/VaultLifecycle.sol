// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "./Constants.sol";
import "./Errors.sol";
import "./ShareMath.sol";
import "./VaultSchema.sol";

import "hardhat/console.sol";

library VaultLifecycle {
    using SafeMath for uint256;

    /**
     * @notice Verify the constructor params satisfy requirements
     */
    function verifyInitializerParams(
        address owner,
        address feeRecipient,
        address keeper,
        address strategy,
        uint256 performanceFee,
        uint256 managementFee,
        string calldata tokenName,
        string calldata tokenSymbol,
        VaultSchema.VaultParams calldata _vaultParams
    ) external pure {
        require(owner != address(0), Errors.ADDRESS_NOT_PROVIDED);
        require(feeRecipient != address(0), Errors.ADDRESS_NOT_PROVIDED);
        require(keeper != address(0), Errors.ADDRESS_NOT_PROVIDED);
        require(strategy != address(0), Errors.ADDRESS_NOT_PROVIDED);
        require(
            performanceFee < 100 * Constants.FEE_MULTIPLIER,
            Errors.INVALID_FEE_AMOUNT
        );
        require(
            managementFee < 100 * Constants.FEE_MULTIPLIER,
            Errors.INVALID_FEE_AMOUNT
        );
        require(bytes(tokenName).length > 0, Errors.VAULT_TOKEN_NAME_INVALID);
        require(
            bytes(tokenSymbol).length > 0,
            Errors.VAULT_TOKEN_SYMBOL_INVALID
        );

        require(_vaultParams.decimals > 0, Errors.VAULT_TOKEN_DECIMALS_INVALID);
        require(
            _vaultParams.assetDecimals > 0,
            Errors.VAULT_ASSET_DECIMALS_INVALID
        );
        require(
            _vaultParams.underlyingDecimals > 0,
            Errors.VAULT_UNDERLYING_DECIMALS_INVALID
        );
        require(_vaultParams.minimumSupply > 0, Errors.VALUE_EXCEEDS_MINIMUM);
        require(
            _vaultParams.minimumContractSize > 0,
            Errors.VALUE_EXCEEDS_MINIMUM
        );
        require(_vaultParams.cap > 0, Errors.VALUE_EXCEEDS_MINIMUM);
        require(
            _vaultParams.cap > _vaultParams.minimumSupply,
            Errors.VAULT_CAP_TOO_LOW
        );
        require(_vaultParams.asset != address(0), Errors.ADDRESS_NOT_PROVIDED);
    }

    // /**
    //  * @notice Calculate the shares to mint, new price per share, and
    //   amount of funds to re-allocate as collateral for the new round
    //  * @param vaultState is the storage variable vaultState passed from RibbonVault
    //  * @param params is the rollover parameters passed to compute the next state
    //  * @return queuedWithdrawals is the amount of funds set aside for withdrawal
    //  * @return newPricePerShare is the price per share of the new round
    //  * @return mintShares is the amount of shares to mint from deposits
    //  * @return performanceFeeInAsset is the performance fee charged by vault
    //  * @return totalVaultFee is the total amount of fee charged by vault
    //  */
    function getBalanceForVaultFees(
        uint256 currentBalance,
        uint256 currentShareSupply,
        uint256 decimals,
        uint256 queuedDeposits,
        uint256 queuedWithdrawShares,
        uint256 lastQueuedWithdrawals
    ) external pure returns (uint256 balanceForVaultFees) {
        uint256 pricePerShareBeforeFee = ShareMath.pricePerShare(
            currentShareSupply,
            currentBalance,
            queuedDeposits,
            decimals
        );

        uint256 queuedWithdrawalsBeforeFee = currentShareSupply > 0
            ? ShareMath.sharesToAsset(
                queuedWithdrawShares,
                pricePerShareBeforeFee,
                decimals
            )
            : 0;

        /*
         * Deduct the difference between the newly scheduled withdrawals
         * and the older withdrawals so we can charge them fees before they leave
         */
        balanceForVaultFees = queuedWithdrawalsBeforeFee > lastQueuedWithdrawals
            ? currentBalance.sub(lastQueuedWithdrawals)
            : currentBalance.sub(queuedWithdrawalsBeforeFee);
    }

    // /**
    //  * @notice Calculates the performance and management fee for this week's round
    //  * @param balanceForVaultFees is the balance of funds held on the vault after closing short
    //  * @param lastlockedCollateral is the amount of funds locked from the previous round
    //  * @param queuedDeposits is the pending deposit amount
    //  * @param performanceFeePercent is the performance fee pct.
    //  * @param managementFeePercent is the management fee pct.
    //  * @return performanceFeeInAsset is the performance fee
    //  * @return managementFeeInAsset is the management fee
    //  * @return vaultFee is the total fees
    //  */
    function getVaultFees(
        uint256 balanceForVaultFees,
        uint256 lastTotalCapital,
        uint256 queuedDeposits,
        uint256 performanceFeePercent,
        uint256 managementFeePercent
    )
        external
        pure
        returns (
            uint256 performanceFeeInAsset,
            uint256 managementFeeInAsset,
            uint256 vaultFee
        )
    {
        /* At the first round, balanceForVaultFees=0, queuedDeposits>0
        so we just do not charge anything on the first round */
        uint256 lockedBalanceSansPending = balanceForVaultFees > queuedDeposits
            ? balanceForVaultFees.sub(queuedDeposits)
            : 0;

        /* Take performance fee and management fee ONLY if difference between 
        last week and this week's vault deposits, taking into account pending 
        deposits and withdrawals, is positive. If it is negative, last week's 
        option expired ITM past breakeven, and the vault took a loss so we do 
        not collect performance fee for last week */
        if (lastTotalCapital > 0) {
            if (lockedBalanceSansPending > lastTotalCapital) {
                performanceFeeInAsset = performanceFeePercent > 0
                    ? lockedBalanceSansPending
                        .sub(lastTotalCapital)
                        .mul(performanceFeePercent)
                        .div(100 * Constants.FEE_MULTIPLIER)
                    : 0;
                managementFeeInAsset = managementFeePercent > 0
                    ? lockedBalanceSansPending.mul(managementFeePercent).div(
                        100 * Constants.FEE_MULTIPLIER
                    )
                    : 0;

                vaultFee = performanceFeeInAsset.add(managementFeeInAsset);
            }
        }
    }

    // /**
    //  * @notice Calculate the shares to mint, new price per share, and
    //   amount of funds to re-allocate as collateral for the new round
    //  * @param vaultState is the storage variable vaultState passed from RibbonVault
    //  * @param params is the rollover parameters passed to compute the next state
    //  * @return queuedWithdrawals is the amount of funds set aside for withdrawal
    //  * @return newPricePerShare is the price per share of the new round
    //  * @return mintShares is the amount of shares to mint from deposits
    //  * @return performanceFeeInAsset is the performance fee charged by vault
    //  * @return totalVaultFee is the total amount of fee charged by vault
    //  */
    function rollover(
        uint256 currentBalance,
        uint256 currentShareSupply,
        uint256 decimals,
        uint256 queuedDeposits,
        uint256 queuedWithdrawShares
    )
        external
        pure
        returns (
            uint256 queuedWithdrawals,
            uint256 newPricePerShare,
            uint256 mintShares
        )
    {
        newPricePerShare = ShareMath.pricePerShare(
            currentShareSupply,
            currentBalance,
            queuedDeposits,
            decimals
        );

        /* After closing the short, if the options expire in-the-money vault pricePerShare 
        would go down because vault's asset balance decreased. This ensures that the 
        newly-minted shares do not take on the loss. */
        mintShares = ShareMath.assetToShares(
            queuedDeposits,
            newPricePerShare,
            decimals
        );

        uint256 newSupply = currentShareSupply.add(mintShares);

        queuedWithdrawals = newSupply > 0
            ? ShareMath.sharesToAsset(
                queuedWithdrawShares,
                newPricePerShare,
                decimals
            )
            : 0;
    }

    /**
     * @notice Gets the next options expiry timestamp
     * @param timestamp is the expiry timestamp of the current option
     * Reference: https://codereview.stackexchange.com/a/33532
     * Examples:
     * getNextFriday(week 1 thursday) -> week 1 friday
     * getNextFriday(week 1 friday) -> week 2 friday
     * getNextFriday(week 1 saturday) -> week 2 friday
     */
    function getNextFriday(uint256 timestamp) external pure returns (uint256) {
        // dayOfWeek = 0 (sunday) - 6 (saturday)
        uint256 dayOfWeek = ((timestamp / 1 days) + 4) % 7;
        uint256 nextFriday = timestamp + ((7 + 5 - dayOfWeek) % 7) * 1 days;
        uint256 friday8am = nextFriday - (nextFriday % (24 hours)) + (8 hours);

        // If the passed timestamp is day=Friday hour>8am, we simply increment it by a week to next Friday
        if (timestamp >= friday8am) {
            friday8am += 7 days;
        }
        return friday8am;
    }
}
