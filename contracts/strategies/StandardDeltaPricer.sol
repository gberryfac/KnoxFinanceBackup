// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IPremiaPool, PoolStorage} from "../interfaces/IPremiaPool.sol";

import "./StandardDeltaPricer/StandardDeltaPricerStorage.sol";
import "./StandardDeltaPricer/StrikeSelection.sol";

contract StandardDeltaPricer is StandardDeltaPricerStorage, StrikeSelection {
    constructor(address _pool, address _volatilityOracle) {
        require(_pool != address(0), "address not provided");
        require(_volatilityOracle != address(0), "address not provided");

        IVolOracle = IVolatilitySurfaceOracle(_volatilityOracle);

        PoolStorage.PoolSettings memory settings =
            IPremiaPool(_pool).getPoolSettings();

        assetProperties.base = settings.base;
        assetProperties.underlying = settings.underlying;

        BaseSpotOracle = AggregatorInterface(settings.baseOracle);
        UnderlyingSpotOracle = AggregatorInterface(settings.underlyingOracle);

        uint8 decimals = UnderlyingSpotOracle.decimals();

        require(
            BaseSpotOracle.decimals() == decimals,
            "oracle decimals must match"
        );
    }
}
