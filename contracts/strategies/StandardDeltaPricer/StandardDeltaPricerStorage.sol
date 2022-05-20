// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {
    AggregatorInterface,
    IVolatilitySurfaceOracle
} from "./../../interfaces/Oracles.sol";

import "./StandardDeltaPricerSchema.sol";

contract StandardDeltaPricerStorage {
    uint64 public sFactor;

    AggregatorInterface public BaseSpotOracle;
    AggregatorInterface public UnderlyingSpotOracle;

    IVolatilitySurfaceOracle public IVolOracle;

    StandardDeltaPricerSchema.AssetProperties public assetProperties;
}
