// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {
    AggregatorInterface,
    IVolatilitySurfaceOracle
} from "./../../interfaces/Oracles.sol";

import "./StandardDeltaPricerSchema.sol";

contract StandardDeltaPricerStorage {
    AggregatorInterface public BaseSpotOracle;
    AggregatorInterface public UnderlyingSpotOracle;

    IVolatilitySurfaceOracle public IVolOracle;

    StandardDeltaPricerSchema.AssetProperties public assetProperties;
}
