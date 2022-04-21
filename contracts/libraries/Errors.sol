// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library Errors {
    // @notice address provided cannot be 0x0
    string internal constant ADDRESS_NOT_PROVIDED = "0";
    // @notice address provided is not assigned keeper role
    string internal constant ADDRESS_NOT_KEEPER = "1";
    // @notice claim exceeds the balance held
    string internal constant CLAIM_AMOUNT_EXCEEDS_BALANCE = "2";
    // @notice contract size must be greater than the minimum
    string internal constant CONTRACT_SIZE_EXCEEDS_MINIMUM = "3";
    // @notice deposit does not meet the minimum supply requirement
    string internal constant DEPOSIT_MINIMUM_NOT_MET = "4";
    // @notice position size exceeds the amount of free liquidity
    string internal constant FREE_LIQUIDTY_EXCEEDED = "5";
    // @notice an initiated withdrawal exists, this must be completed before a new one is created
    string internal constant INITIATED_WITHDRAWAL_INCOMPLETE = "6";
    // @notice current round is not equal to the round eligible for an instant deposit
    string internal constant INSTANT_WITHDRAWAL_ROUND_ENDED = "7";
    // @notice address provided does not match vault asset address
    string internal constant INVALID_ASSET_ADDRESS = "8";
    // @notice fee amount provided exeedes the fee limit
    string internal constant INVALID_FEE_AMOUNT = "9";
    // @notice signature provided does not match the authorized signer
    string internal constant INVALID_SIGNATURE = "10";
    // @notice address provided is the same as the currently assigned address
    string internal constant NEW_ADDRESS_EQUALS_OLD = "11";
    // @notice redeem shares exceeds the balance held
    string internal constant REDEEMED_SHARES_EXCEEDS_BALANCE = "12";
    // @notice redeem shares must be greater than 0
    string internal constant REDEEMED_SHARES_EXCEEDS_MINIMUM = "13";
    // @notice ETH transfer from vault to user failed
    string internal constant TRANSFER_FAILED = "14";
    // @notice value provided exceeds the minimum
    string internal constant VALUE_EXCEEDS_MINIMUM = "15";
    // @notice deposit exceeds the vault limit
    string internal constant VAULT_CAP_EXCEEDED = "16";
    // @notice cap must be higher than minimum supply
    string internal constant VAULT_CAP_TOO_LOW = "17";
    // @notice valid token name must be provided
    string internal constant VAULT_TOKEN_NAME_INVALID = "18";
    // @notice round must expire before completing action
    string internal constant VAULT_ROUND_NOT_CLOSED = "19";
    // @notice withdrawal amount exceeds the balance held
    string internal constant WITHDRAWAL_AMOUNT_EXCEEDS_BALANCE = "20";
    // @notice withdrawal amount must be greater than 0
    string internal constant WITHDRAWAL_AMOUNT_EXCEEDS_MINIMUM = "21";
    // @notice withdrawal has not been initiated
    string internal constant WITHDRAWAL_NOT_INITIATED = "22";
    // @notice a claim for the provided longTokenID does not exist
    string internal constant CLAIM_NOT_FOUND = "23";
    // @notice withdrawal has not been initiated
    string internal constant CALLER_MUST_BE_VAULT = "24";
    // @notice valid token symbol must be provided
    string internal constant VAULT_TOKEN_SYMBOL_INVALID = "25";
    string internal constant VAULT_TOKEN_DECIMALS_INVALID = "26";
    string internal constant VAULT_ASSET_DECIMALS_INVALID = "27";
    string internal constant VAULT_UNDERLYING_DECIMALS_INVALID = "28";
    string internal constant PURCHASE_WINDOW_HAS_CLOSED = "29";
}
