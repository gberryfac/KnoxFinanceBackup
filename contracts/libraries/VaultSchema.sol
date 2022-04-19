// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library VaultSchema {
    // @notice
    uint256 public constant LP_TOKEN_ID =
        0x0999999999999999999999999999999999999999999999999999999999999999;

    // TODO: VERIFY assetDecimals, underlyingDecimals, minimumContractSize

    struct VaultParams {
        // @notice Option type the vault is selling
        bool isCall;
        // @notice Token decimals for vault shares
        uint8 decimals;
        // @notice Decimals for asset used in vault
        uint8 assetDecimals;
        // @notice Asset used in vault
        address asset;
        // @notice Decimals for underlying used in vault
        uint8 underlyingDecimals;
        // @notice Underlying asset of the options sold by vault
        address underlying;
        // @notice Minimum supply of the vault shares issued, for ETH it's 10**10
        uint56 minimumSupply;
        // @notice Minimum contract size a vault will sell
        uint80 minimumContractSize;
        // @notice Maximum amount of assets to be deposited
        uint104 cap;
    }

    struct VaultState {
        // 32 byte slot 1
        // @notice  Current round number. `round` represents the number of `period`s elapsed.
        uint16 round;
        // @notice Amount of collateral currently used to underwrite options
        uint104 lockedCollateral;
        //
        uint256 lastTotalCapital;
        // 32 byte slot 2
        // @notice Amount withheld for weekly vault deposits
        uint128 queuedDeposits;
        // @notice Shares withheld for scheduled withdrawals during a round
        uint128 queuedWithdrawShares;
        // @notice Amount withheld for scheduled withdrawals
        uint128 queuedWithdrawals;
        // @notice The timestamp when the current round ends
        uint32 expiry;
    }

    struct DepositReceipt {
        // @notice Maximum of 65535 rounds. Assuming 1 round is 7 days, maximum is 1256 years.
        uint16 round;
        // @notice Deposit amount, max 20,282,409,603,651 or 20 trillion ETH deposit
        uint104 amount;
        // @notice Unredeemed shares balance
        uint128 unredeemedShares;
    }

    struct Withdrawal {
        // @notice Maximum of 65535 rounds. Assuming 1 round is 7 days, maximum is 1256 years.
        uint16 round;
        // @notice Number of shares withdrawn
        uint128 shares;
    }
}
