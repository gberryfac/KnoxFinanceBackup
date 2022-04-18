// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./../interfaces/IKnoxToken.sol";
import "../libraries/ShareMath.sol";
import "../libraries/VaultSchema.sol";

import "hardhat/console.sol";

library VaultDisplay {
    using ShareMath for VaultSchema.DepositReceipt;

    /**
     * @notice Returns the asset balance held on the vault for the account
     * @param account is the address to lookup balance for
     * @return the amount of `asset` custodied by the vault for the user
     */
    function accountVaultBalance(
        uint256 round,
        uint256 decimals,
        uint256 queuedDeposits,
        uint256 totalBalance,
        address account,
        address token,
        VaultSchema.DepositReceipt memory depositReceipt,
        mapping(uint256 => uint256) storage lpTokenPricePerShare
    ) external view returns (uint256) {
        uint256 assetPerShare = ShareMath.pricePerShare(
            IKnoxToken(token).totalSupply(VaultSchema.LP_TOKEN_ID),
            totalBalance,
            queuedDeposits,
            decimals
        );

        return
            ShareMath.sharesToAsset(
                lpShares(
                    round,
                    decimals,
                    account,
                    token,
                    depositReceipt,
                    lpTokenPricePerShare
                ),
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
        uint256 round,
        uint256 decimals,
        address account,
        address token,
        VaultSchema.DepositReceipt memory depositReceipt,
        mapping(uint256 => uint256) storage lpTokenPricePerShare
    ) public view returns (uint256) {
        (uint256 heldByAccount, uint256 heldByVault) = lpShareBalances(
            round,
            decimals,
            account,
            token,
            depositReceipt,
            lpTokenPricePerShare
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
        uint256 round,
        uint256 decimals,
        address account,
        address token,
        VaultSchema.DepositReceipt memory depositReceipt,
        mapping(uint256 => uint256) storage lpTokenPricePerShare
    ) public view returns (uint256 heldByAccount, uint256 heldByVault) {
        if (depositReceipt.round < ShareMath.PLACEHOLDER_UINT) {
            return (
                IKnoxToken(token).balanceOf(account, VaultSchema.LP_TOKEN_ID),
                0
            );
        }

        uint256 unredeemedShares = depositReceipt.getSharesFromReceipt(
            round,
            lpTokenPricePerShare[depositReceipt.round],
            decimals
        );

        return (
            IKnoxToken(token).balanceOf(account, VaultSchema.LP_TOKEN_ID),
            unredeemedShares
        );
    }

    /**
     * @notice The price of a unit of share denominated in the `asset`
     */
    function lpPricePerShare(
        uint256 decimals,
        uint256 queuedDeposits,
        uint256 totalBalance,
        address token
    ) external view returns (uint256) {
        return
            ShareMath.pricePerShare(
                IKnoxToken(token).totalSupply(VaultSchema.LP_TOKEN_ID),
                totalBalance,
                queuedDeposits,
                decimals
            );
    }
}
