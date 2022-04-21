// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library VaultSchema {
    struct InitParams {
        // @notice Owner of the vault with critical permissions.
        address _owner;
        // @notice Address to recieve vault performance and management fees.
        address _feeRecipient;
        // @notice Address of vault keeper.
        address _keeper;
        // @notice Address of the strategy contract.
        address _strategy;
        // @notice Management fee pct.
        uint256 _managementFee;
        // @notice Perfomance fee pct.
        uint256 _performanceFee;
        // @notice Name of the token.
        string _tokenName;
        // @notice Symbol of the token.
        string _tokenSymbol;
    }

    struct VaultParams {
        // @notice Option type the vault is selling
        bool isCall;
        // @notice Token decimals for vault shares
        uint8 decimals;
        // @notice Decimals for asset used in vault
        uint8 assetDecimals;
        // @notice Decimals for underlying used in vault
        uint8 underlyingDecimals;
        // @notice Minimum supply of the vault shares issued, for ETH it's 10**10
        uint56 minimumSupply;
        // @notice Minimum contract size a vault will sell
        uint64 minimumContractSize;
        // @notice Maximum amount of assets to be deposited
        uint104 cap;
        // @notice Asset used in vault
        address asset;
    }

    struct VaultState {
        // 32 byte slot 1
        // @notice  Current round number. `round` represents the number of `period`s elapsed.
        uint16 round;
        // @notice The timestamp when the current round ends
        uint32 expiry;
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
