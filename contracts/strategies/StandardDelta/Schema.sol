// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library Schema {
    struct AssetProperties {
        // @notice Decimals for base asset used in vault
        uint8 baseDecimals;
        // @notice Decimals for underlying asset used in vault
        uint8 underlyingDecimals;
        // @notice Address for base asset used in vault
        address base;
        // @notice Address for base asset used in vault
        address underlying;
    }

    struct Option {
        // @notice Option type the vault is strategy
        bool isCall;
        // @notice Minimum amount of the underlying a strategy will sell
        uint64 minimumContractSize;
        // @notice Timestamp when the current option expires
        uint64 expiry;
        // @notice Delta used to calculate strike price as a 64x64 bit fixed point number
        int128 delta64x64;
        // @notice Strike price of the option as a 64x64 bit fixed point number
        int128 strike64x64;
    }

    struct Oracles {
        // @notice Address of Vault asset Chainlink spot price oracle
        address spot;
        // @notice Address of Premia volatility surface oracle
        address volatility;
    }
}
