// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "abdk-libraries-solidity/ABDKMath64x64.sol";

import "./Vault.sol";

import "hardhat/console.sol";

library ShareMath {
    using SafeMath for uint256;
    using ABDKMath64x64 for int128;

    uint256 internal constant PLACEHOLDER_UINT = 1;

    function assetToShares(
        uint256 assetAmount,
        uint256 assetPerShare,
        uint256 decimals
    ) internal pure returns (uint256) {
        // If this throws, it means that vault's roundPricePerShare[currentRound] has not been set
        // yet which should never happen. Has to be larger than 1 because `1` is used in
        // `initRoundPricePerShares` to prevent cold writes.
        require(
            assetPerShare > PLACEHOLDER_UINT,
            "share-math/invalid-assetPerShare"
        );

        return assetAmount.mul(10**decimals).div(assetPerShare);
    }

    function sharesToAsset(
        uint256 shares,
        uint256 assetPerShare,
        uint256 decimals
    ) internal pure returns (uint256) {
        // If this throws, it means that vault's roundPricePerShare[currentRound] has not been set
        // yet which should never happen. Has to be larger than 1 because `1` is used in
        // `initRoundPricePerShares` to prevent cold writes.
        require(
            assetPerShare > PLACEHOLDER_UINT,
            "share-math/invalid-assetPerShare"
        );

        return shares.mul(assetPerShare).div(10**decimals);
    }

    /**
     * @notice Returns the shares unredeemed by the user given their DepositReceipt
     * @param depositReceipt is the user's deposit receipt
     * @param currentRound is the `round` stored on the vault
     * @param assetPerShare is the price in asset per share
     * @param decimals is the number of decimals the asset/shares use
     * @return unredeemedShares is the user's virtual balance of shares that are owed
     */
    function getSharesFromReceipt(
        Vault.DepositReceipt memory depositReceipt,
        uint256 currentRound,
        uint256 assetPerShare,
        uint256 decimals
    ) internal pure returns (uint256 unredeemedShares) {
        if (depositReceipt.round > 0 && depositReceipt.round < currentRound) {
            uint256 sharesFromRound = assetToShares(
                depositReceipt.amount,
                assetPerShare,
                decimals
            );

            return
                uint256(depositReceipt.unredeemedShares).add(sharesFromRound);
        }

        return depositReceipt.unredeemedShares;
    }

    function pricePerShare(
        uint256 totalSupply,
        uint256 totalBalance,
        uint256 queuedDeposits,
        uint256 decimals
    ) internal pure returns (uint256) {
        uint256 singleShare = 10**decimals;
        return
            totalSupply > 0
                ? singleShare.mul(totalBalance.sub(queuedDeposits)).div(
                    totalSupply
                )
                : singleShare;
    }

    function assertUint128(uint256 num) internal pure {
        require(num <= type(uint128).max, "share-math/overflow-uint128");
    }

    /************************************************
     *  HELPERS
     ***********************************************/

    function assertUint104(uint256 num) internal pure {
        require(num <= type(uint104).max, "share-math/overflow-uint104");
    }
}
