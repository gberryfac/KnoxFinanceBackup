// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../libraries/ShareMath.sol";
import "../libraries/Vault.sol";

contract TestShareMath {
    function sharesToAsset(
        uint256 shares,
        uint256 pps,
        uint256 decimals
    ) external pure returns (uint256) {
        return ShareMath.sharesToAsset(shares, pps, decimals);
    }

    function assetToShares(
        uint256 assetAmount,
        uint256 pps,
        uint256 decimals
    ) external pure returns (uint256) {
        return ShareMath.assetToShares(assetAmount, pps, decimals);
    }

    function getSharesFromReceipt(
        Vault.DepositReceipt memory depositReceipt,
        uint256 currentRound,
        uint256 assetPerShare,
        uint256 decimals
    ) external pure returns (uint256 unredeemedShares) {
        return
            ShareMath.getSharesFromReceipt(
                depositReceipt,
                currentRound,
                assetPerShare,
                decimals
            );
    }

    function pricePerShare(
        uint256 totalSupply,
        uint256 totalBalance,
        uint256 pendingAmount,
        uint256 decimals
    ) external pure returns (uint256) {
        return
            ShareMath.pricePerShare(
                totalSupply,
                totalBalance,
                pendingAmount,
                decimals
            );
    }
}
