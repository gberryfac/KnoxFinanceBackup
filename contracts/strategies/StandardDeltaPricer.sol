// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IPremiaPool, PoolStorage} from "./../interfaces/IPremiaPool.sol";

import "./../libraries/Errors.sol";

import "./StandardDeltaPricer/StandardDeltaPricerStorage.sol";
import "./StandardDeltaPricer/StrikeSelection.sol";

import "hardhat/console.sol";

contract StandardDeltaPricer is StandardDeltaPricerStorage, StrikeSelection {
    constructor(address _pool, address _volatilityOracle) {
        require(_pool != address(0), Errors.ADDRESS_NOT_PROVIDED);
        require(_volatilityOracle != address(0), Errors.ADDRESS_NOT_PROVIDED);

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
