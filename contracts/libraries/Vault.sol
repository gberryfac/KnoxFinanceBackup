// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library Vault {
    // @notice
    uint256 public constant LP_TOKEN_ID =
        0x0999999999999999999999999999999999999999999999999999999999999999;

    // @notice Fees are 6-decimal places. For example: 20 * 10**6 = 20%
    uint256 public constant FEE_MULTIPLIER = 10**6;

    // @notice Placeholder uint value to prevent cold writes
    uint256 public constant PLACEHOLDER_UINT = 1;

    struct VaultParams {
        // @notice option type the vault is selling
        bool isCall;
        // @notice token decimals for vault shares
        uint8 decimals;
        // @notice decimals for asset used in vault
        uint8 assetDecimals;
        // @notice asset used in vault
        address asset;
        // @notice decimals for underlying used in vault
        uint8 underlyingDecimals;
        // @notice underlying asset of the options sold by vault
        address underlying;
        // @notice minimum supply of the vault shares issued, for ETH it's 10**10
        uint56 minimumSupply;
        // @notice
        uint80 minimumContractSize;
        // @notice maximum amount of assets to be deposited
        uint104 cap;
    }

    struct VaultState {
        // 32 byte slot 1
        // @notice  Current round number. `round` represents the number of `period`s elapsed.
        uint16 round;
        // @notice Amount of collateral currently used to underwrite options
        uint104 lockedCollateral;
        // 32 byte slot 2
        // @notice
        uint128 queuedDeposits;
        // @notice
        uint128 queuedPayouts;
        // @notice Amount locked for scheduled withdrawals;
        uint128 queuedWithdrawShares;
        // @notice Amount locked for scheduled withdrawals last week;
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
