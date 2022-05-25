// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../libraries/VaultDisplay.sol";
import "../libraries/VaultSchema.sol";

contract TestVaultDisplay {
    mapping(uint256 => uint256) public lpTokenPricePerShare;

    function setLpTokenPricePerShare(uint256 round, uint256 price) public {
        lpTokenPricePerShare[round] = price;
    }

    function lpShareBalances(
        uint256 round,
        uint256 decimals,
        uint256 balance,
        VaultSchema.DepositReceipt memory depositReceipt
    ) public view returns (uint256 heldByAccount, uint256 heldByVault) {
        (heldByAccount, heldByVault) = VaultDisplay.lpShareBalances(
            round,
            decimals,
            balance,
            depositReceipt,
            lpTokenPricePerShare
        );
    }
}
