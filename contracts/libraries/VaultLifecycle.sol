// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./Vault.sol";
import "./ShareMath.sol";

library VaultLifecycle {
    using SafeMath for uint256;

    /**
     * @param currentShareSupply is the supply of the shares invoked with totalSupply()
     * @param asset is the address of the vault's asset
     * @param decimals is the decimals of the asset
     * @param lastQueuedWithdrawAmount is the amount queued for withdrawals from last round
     * @param performanceFee is the perf fee percent to charge on premiums
     * @param managementFee is the management fee percent to charge on the AUM
     */
    struct RolloverParams {
        uint256 decimals;
        uint256 totalBalance;
        uint256 currentShareSupply;
        uint256 lastQueuedWithdrawAmount;
        uint256 performanceFee;
        uint256 managementFee;
    }

    /**
     * @notice Verify the constructor params satisfy requirements
     * @param owner is the owner of the vault with critical permissions
     * @param feeRecipient is the address to recieve vault performance and management fees
     * @param performanceFee is the perfomance fee pct.
     * @param tokenName is the name of the token
     * @param tokenSymbol is the symbol of the token
     * @param _vaultParams is the struct with vault general data
     */
    function verifyInitializerParams(
        address owner,
        address keeper,
        address feeRecipient,
        uint256 performanceFee,
        uint256 managementFee,
        string calldata tokenName,
        string calldata tokenSymbol,
        Vault.VaultParams calldata _vaultParams
    ) external pure {
        require(owner != address(0), "!owner");
        require(keeper != address(0), "!keeper");
        require(feeRecipient != address(0), "!feeRecipient");
        require(
            performanceFee < 100 * Vault.FEE_MULTIPLIER,
            "performanceFee >= 100%"
        );
        require(
            managementFee < 100 * Vault.FEE_MULTIPLIER,
            "managementFee >= 100%"
        );
        require(bytes(tokenName).length > 0, "!tokenName");
        require(bytes(tokenSymbol).length > 0, "!tokenSymbol");

        require(_vaultParams.asset != address(0), "!asset");
        require(_vaultParams.underlying != address(0), "!underlying");
        require(_vaultParams.minimumSupply > 0, "!minimumSupply");
        require(_vaultParams.cap > 0, "!cap");
        require(
            _vaultParams.cap > _vaultParams.minimumSupply,
            "cap has to be higher than minimumSupply"
        );
    }

    // /**
    //  * @notice Gets the next option expiry timestamp
    //  * @param currentOption is the otoken address that the vault is currently writing
    //  */
    // function getNextExpiry(address currentOption)
    //     internal
    //     view
    //     returns (uint256)
    // {
    //     // uninitialized state
    //     if (currentOption == address(0)) {
    //         return getNextFriday(block.timestamp);
    //     }
    //     uint256 currentExpiry = IOtoken(currentOption).expiryTimestamp();

    //     // After options expiry if no options are written for >1 week
    //     // We need to give the ability continue writing options
    //     if (block.timestamp > currentExpiry + 7 days) {
    //         return getNextFriday(block.timestamp);
    //     }
    //     return getNextFriday(currentExpiry);
    // }

    // /**
    //  * @notice Gets the next options expiry timestamp
    //  * @param timestamp is the expiry timestamp of the current option
    //  * Reference: https://codereview.stackexchange.com/a/33532
    //  * Examples:
    //  * getNextFriday(week 1 thursday) -> week 1 friday
    //  * getNextFriday(week 1 friday) -> week 2 friday
    //  * getNextFriday(week 1 saturday) -> week 2 friday
    //  */
    // function getNextFriday(uint256 timestamp) internal pure returns (uint256) {
    //     // dayOfWeek = 0 (sunday) - 6 (saturday)
    //     uint256 dayOfWeek = ((timestamp / 1 days) + 4) % 7;
    //     uint256 nextFriday = timestamp + ((7 + 5 - dayOfWeek) % 7) * 1 days;
    //     uint256 friday8am = nextFriday - (nextFriday % (24 hours)) + (8 hours);

    //     // If the passed timestamp is day=Friday hour>8am, we simply increment it by a week to next Friday
    //     if (timestamp >= friday8am) {
    //         friday8am += 7 days;
    //     }
    //     return friday8am;
    // }

    /**
     * @notice Calculate the shares to mint, new price per share, and
      amount of funds to re-allocate as collateral for the new round
     * @param vaultState is the storage variable vaultState passed from RibbonVault
     * @param params is the rollover parameters passed to compute the next state
     * @return newLockedAmount is the amount of funds to allocate for the new round
     * @return queuedWithdrawAmount is the amount of funds set aside for withdrawal
     * @return newPricePerShare is the price per share of the new round
     * @return mintShares is the amount of shares to mint from deposits
     * @return performanceFeeInAsset is the performance fee charged by vault
     * @return totalVaultFee is the total amount of fee charged by vault
     */
    function rollover(
        Vault.VaultState storage vaultState,
        RolloverParams calldata params
    )
        external
        view
        returns (
            uint256 newLockedAmount,
            uint256 queuedWithdrawAmount,
            uint256 newPricePerShare,
            uint256 mintShares,
            uint256 performanceFeeInAsset,
            uint256 totalVaultFee
        )
    {
        uint256 currentBalance = params.totalBalance;
        uint256 pendingAmount = vaultState.totalPending;
        uint256 queuedWithdrawShares = vaultState.queuedWithdrawShares;

        uint256 balanceForVaultFees;
        {
            uint256 pricePerShareBeforeFee = ShareMath.pricePerShare(
                params.currentShareSupply,
                currentBalance,
                pendingAmount,
                params.decimals
            );

            uint256 queuedWithdrawBeforeFee = params.currentShareSupply > 0
                ? ShareMath.sharesToAsset(
                    queuedWithdrawShares,
                    pricePerShareBeforeFee,
                    params.decimals
                )
                : 0;

            // Deduct the difference between the newly scheduled withdrawals
            // and the older withdrawals
            // so we can charge them fees before they leave
            uint256 withdrawAmountDiff = queuedWithdrawBeforeFee >
                params.lastQueuedWithdrawAmount
                ? queuedWithdrawBeforeFee.sub(params.lastQueuedWithdrawAmount)
                : 0;

            balanceForVaultFees = currentBalance
                .sub(queuedWithdrawBeforeFee)
                .add(withdrawAmountDiff);
        }

        {
            (performanceFeeInAsset, , totalVaultFee) = VaultLifecycle
                .getVaultFees(
                    balanceForVaultFees,
                    vaultState.lastLockedAmount,
                    vaultState.totalPending,
                    params.performanceFee,
                    params.managementFee
                );
        }

        // Take into account the fee
        // so we can calculate the newPricePerShare
        currentBalance = currentBalance.sub(totalVaultFee);

        {
            newPricePerShare = ShareMath.pricePerShare(
                params.currentShareSupply,
                currentBalance,
                pendingAmount,
                params.decimals
            );

            // After closing the short, if the options expire in-the-money
            // vault pricePerShare would go down because vault's asset balance decreased.
            // This ensures that the newly-minted shares do not take on the loss.
            mintShares = ShareMath.assetToShares(
                pendingAmount,
                newPricePerShare,
                params.decimals
            );

            uint256 newSupply = params.currentShareSupply.add(mintShares);

            queuedWithdrawAmount = newSupply > 0
                ? ShareMath.sharesToAsset(
                    queuedWithdrawShares,
                    newPricePerShare,
                    params.decimals
                )
                : 0;
        }

        return (
            currentBalance.sub(queuedWithdrawAmount), // new locked balance subtracts the queued withdrawals
            queuedWithdrawAmount,
            newPricePerShare,
            mintShares,
            performanceFeeInAsset,
            totalVaultFee
        );
    }

    /**
     * @notice Calculates the performance and management fee for this week's round
     * @param currentBalance is the balance of funds held on the vault after closing short
     * @param lastLockedAmount is the amount of funds locked from the previous round
     * @param pendingAmount is the pending deposit amount
     * @param performanceFeePercent is the performance fee pct.
     * @param managementFeePercent is the management fee pct.
     * @return performanceFeeInAsset is the performance fee
     * @return managementFeeInAsset is the management fee
     * @return vaultFee is the total fees
     */
    function getVaultFees(
        uint256 currentBalance,
        uint256 lastLockedAmount,
        uint256 pendingAmount,
        uint256 performanceFeePercent,
        uint256 managementFeePercent
    )
        internal
        pure
        returns (
            uint256 performanceFeeInAsset,
            uint256 managementFeeInAsset,
            uint256 vaultFee
        )
    {
        // At the first round, currentBalance=0, pendingAmount>0
        // so we just do not charge anything on the first round
        uint256 lockedBalanceSansPending = currentBalance > pendingAmount
            ? currentBalance.sub(pendingAmount)
            : 0;

        uint256 _performanceFeeInAsset;
        uint256 _managementFeeInAsset;
        uint256 _vaultFee;

        // Take performance fee and management fee ONLY if difference between
        // last week and this week's vault deposits, taking into account pending
        // deposits and withdrawals, is positive. If it is negative, last week's
        // option expired ITM past breakeven, and the vault took a loss so we
        // do not collect performance fee for last week
        if (lockedBalanceSansPending > lastLockedAmount) {
            _performanceFeeInAsset = performanceFeePercent > 0
                ? lockedBalanceSansPending
                    .sub(lastLockedAmount)
                    .mul(performanceFeePercent)
                    .div(100 * Vault.FEE_MULTIPLIER)
                : 0;
            _managementFeeInAsset = managementFeePercent > 0
                ? lockedBalanceSansPending.mul(managementFeePercent).div(
                    100 * Vault.FEE_MULTIPLIER
                )
                : 0;

            _vaultFee = _performanceFeeInAsset.add(_managementFeeInAsset);
        }

        return (_performanceFeeInAsset, _managementFeeInAsset, _vaultFee);
    }
}
