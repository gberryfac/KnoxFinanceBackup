// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./../libraries/VaultSchema.sol";

contract VaultStorageV1 {
    // @notice Performance fee charged on premiums earned in round. Only charged when there is no loss.
    uint256 public performanceFee;

    // @notice Management fee charged on entire AUM in round. Only charged when there is no loss.
    uint256 public managementFee;

    // @notice Fee recipient for the performance and management fees.
    address public feeRecipient;

    // @notice Role in charge of weekly vault operations such as harvest, no access to critical vault changes
    address public keeper;

    // @notice Stratgy contract associated with the vault.
    address public strategy;

    // @notice Stores the user's pending deposit for the round.
    mapping(address => VaultSchema.DepositReceipt) public depositReceipts;

    // @notice Stores pending user withdrawals.
    mapping(address => VaultSchema.Withdrawal) public withdrawals;

    // @notice On every round's close, the price per share value of an lp token is stored. This is used to determine the number of shares to be returned to a user with their DepositReceipt.depositAmount
    mapping(uint256 => uint256) public lpTokenPricePerShare;

    // @notice Vault's parameters like cap, decimals.
    VaultSchema.VaultParams public vaultParams;

    // @notice Vault's lifecycle state like round and locked amounts.
    VaultSchema.VaultState public vaultState;
}

contract VaultStorage is VaultStorageV1 {}