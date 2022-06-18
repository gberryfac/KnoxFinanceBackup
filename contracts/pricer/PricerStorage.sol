// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {
    AggregatorInterface,
    IVolatilitySurfaceOracle
} from "../interfaces/Oracles.sol";

import "./PricerSchema.sol";

// TODO: Switch to diamond storage pattern
contract PricerStorage {
    AggregatorInterface public BaseSpotOracle;
    AggregatorInterface public UnderlyingSpotOracle;

    IVolatilitySurfaceOracle public IVolOracle;

    PricerSchema.AssetProperties public assetProperties;
}
