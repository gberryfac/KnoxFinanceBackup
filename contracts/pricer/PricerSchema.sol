// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library PricerSchema {
    struct AssetProperties {
        // @notice Base asset of option used in vault
        address base;
        // @notice Underlying asset of option used in vault
        address underlying;
    }
}
