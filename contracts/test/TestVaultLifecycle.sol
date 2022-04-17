// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {VaultLifecycle} from "../libraries/VaultLifecycle.sol";

contract TestVaultLifecycle {
    function getBalanceForVaultFees(
        uint256 currentBalance,
        uint256 currentShareSupply,
        uint256 decimals,
        uint256 queuedDeposits,
        uint256 queuedWithdrawShares,
        uint256 queuedWithdrawals
    ) external pure returns (uint256 balanceForVaultFees) {
        return
            VaultLifecycle.getBalanceForVaultFees(
                currentBalance,
                currentShareSupply,
                decimals,
                queuedDeposits,
                queuedWithdrawShares,
                queuedWithdrawals
            );
    }

    function getVaultFees(
        uint256 balanceForVaultFees,
        uint256 lastlockedCollateral,
        uint256 pendingAmount,
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
        return
            VaultLifecycle.getVaultFees(
                balanceForVaultFees,
                lastlockedCollateral,
                pendingAmount,
                performanceFeePercent,
                managementFeePercent
            );
    }

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
        return
            VaultLifecycle.rollover(
                currentBalance,
                currentShareSupply,
                decimals,
                queuedDeposits,
                queuedWithdrawShares
            );
    }

    function getNextFriday(uint256 currentExpiry)
        external
        pure
        returns (uint256 nextFriday)
    {
        return VaultLifecycle.getNextFriday(currentExpiry);
    }
}
