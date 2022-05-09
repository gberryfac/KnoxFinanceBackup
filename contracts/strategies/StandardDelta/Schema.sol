// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library Schema {
    struct AssetProperties {
        // @notice Decimals for base asset used in vault
        uint8 baseDecimals;
        // @notice Decimals for underlying asset used in vault
        uint8 underlyingDecimals;
    }

    struct Option {
        // @notice Option type the vault is strategy
        bool isCall;
        // @notice Minimum amount of the underlying a strategy will sell
        uint64 minimumContractSize;
        // @notice Timestamp when the current option expires
        uint64 expiry;
        // @notice Strike price of the option as a 64x64 bit fixed point number
        int128 strike64x64;
    }
}
