// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../libraries/ShareMath.sol";
import "../libraries/Vault.sol";
import "../vaults/BaseVault.sol";

import "hardhat/console.sol";

contract VaultDisplay {
    using ShareMath for Vault.DepositReceipt;

    constructor() {}

    /**
     * @notice Returns the asset balance held on the vault for the account
     * @param account is the address to lookup balance for
     * @return the amount of `asset` custodied by the vault for the user
     */
    function accountVaultBalance(
        uint256 decimals,
        uint256 round,
        uint256 queuedDeposits,
        BaseVault vault,
        address account,
        Vault.DepositReceipt memory depositReceipt
    ) public view returns (uint256) {
        uint256 assetPerShare = ShareMath.pricePerShare(
            vault.totalSupply(Vault.LP_TOKEN_ID),
            vault.totalBalance(),
            queuedDeposits,
            decimals
        );

        return
            ShareMath.sharesToAsset(
                lpShares(decimals, round, vault, account, depositReceipt),
                assetPerShare,
                decimals
            );
    }

    /**
     * @notice Getter for returning the account's share balance including unredeemed shares
     * @param account is the account to lookup share balance for
     * @return the share balance
     */
    function lpShares(
        uint256 decimals,
        uint256 round,
        BaseVault vault,
        address account,
        Vault.DepositReceipt memory depositReceipt
    ) public view returns (uint256) {
        (uint256 heldByAccount, uint256 heldByVault) = lpShareBalances(
            decimals,
            round,
            vault,
            account,
            depositReceipt
        );

        return heldByAccount + heldByVault;
    }

    /**
     * @notice Getter for returning the account's share balance split between account and vault holdings
     * @param account is the account to lookup share balance for
     * @return heldByAccount is the shares held by account
     * @return heldByVault is the shares held on the vault (unredeemedShares)
     */
    function lpShareBalances(
        uint256 decimals,
        uint256 round,
        BaseVault vault,
        address account,
        Vault.DepositReceipt memory depositReceipt
    ) public view returns (uint256 heldByAccount, uint256 heldByVault) {
        if (depositReceipt.round < ShareMath.PLACEHOLDER_UINT) {
            return (vault.balanceOf(account, Vault.LP_TOKEN_ID), 0);
        }

        uint256 unredeemedShares = depositReceipt.getSharesFromReceipt(
            round,
            vault.lpTokenPricePerShare(depositReceipt.round),
            decimals
        );

        return (vault.balanceOf(account, Vault.LP_TOKEN_ID), unredeemedShares);
    }

    /**
     * @notice The price of a unit of share denominated in the `asset`
     */
    function lpPricePerShare(
        uint256 decimals,
        uint256 queuedDeposits,
        BaseVault vault
    ) public view returns (uint256) {
        return
            ShareMath.pricePerShare(
                vault.totalSupply(Vault.LP_TOKEN_ID),
                vault.totalBalance(),
                queuedDeposits,
                decimals
            );
    }
}
