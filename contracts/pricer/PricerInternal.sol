// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IPremiaPool, PoolStorage} from "../interfaces/IPremiaPool.sol";

import "../libraries/ABDKMath64x64Token.sol";

import "./IPricer.sol";
import "./OptionStatistics.sol";

contract PricerInternal {
    using ABDKMath64x64 for int128;
    using ABDKMath64x64 for uint256;
    using ABDKMath64x64Token for int128;
    using OptionStatistics for int128;

    address public immutable base;
    address public immutable underlying;
    IVolatilitySurfaceOracle public immutable IVolOracle;
    AggregatorInterface public immutable BaseSpotOracle;
    AggregatorInterface public immutable UnderlyingSpotOracle;

    constructor(address pool, address volatilityOracle) {
        require(pool != address(0), "address not provided");
        require(volatilityOracle != address(0), "address not provided");

        IVolOracle = IVolatilitySurfaceOracle(volatilityOracle);

        PoolStorage.PoolSettings memory settings =
            IPremiaPool(pool).getPoolSettings();

        base = settings.base;
        underlying = settings.underlying;

        BaseSpotOracle = AggregatorInterface(settings.baseOracle);
        UnderlyingSpotOracle = AggregatorInterface(settings.underlyingOracle);

        uint8 decimals = UnderlyingSpotOracle.decimals();

        require(
            BaseSpotOracle.decimals() == decimals,
            "oracle decimals must match"
        );
    }

    function _latestAnswer64x64() internal view returns (int128) {
        int256 basePrice = BaseSpotOracle.latestAnswer();
        int256 underlyingPrice = UnderlyingSpotOracle.latestAnswer();

        return ABDKMath64x64.divi(underlyingPrice, basePrice);
    }

    function _getTimeToMaturity64x64(uint64 expiry)
        internal
        view
        returns (int128)
    {
        return ABDKMath64x64.divu(expiry - block.timestamp, 365 days);
    }

    function _getAnnualizedVolatility64x64(
        int128 spot64x64,
        int128 strike64x64,
        int128 timeToMaturity64x64
    ) internal view returns (int128) {
        return
            IVolOracle.getAnnualizedVolatility64x64(
                base,
                underlying,
                spot64x64,
                strike64x64,
                timeToMaturity64x64
            );
    }

    function _getBlackScholesPrice64x64(
        int128 spot64x64,
        int128 strike64x64,
        int128 timeToMaturity64x64,
        bool isCall
    ) internal view returns (int128) {
        return
            IVolOracle.getBlackScholesPrice64x64(
                base,
                underlying,
                spot64x64,
                strike64x64,
                timeToMaturity64x64,
                isCall
            );
    }

    function _getDeltaStrikePrice64x64(
        bool isCall,
        uint64 expiry,
        int128 delta64x64
    ) internal view returns (int128) {
        int128 spot64x64 = _latestAnswer64x64();

        int128 timeToMaturity64x64 = _getTimeToMaturity64x64(expiry);
        require(timeToMaturity64x64 > 0, "tau <= 0");

        int128 iv_atm =
            _getAnnualizedVolatility64x64(
                spot64x64,
                spot64x64,
                timeToMaturity64x64
            );
        require(iv_atm > 0, "iv_atm <= 0");

        int128 v = iv_atm.mul(timeToMaturity64x64.sqrt());
        int128 w = timeToMaturity64x64.mul(iv_atm.pow(2)) >> 1;

        if (!isCall) delta64x64 = int128(0x010000000000000000).sub(delta64x64);
        int128 beta = delta64x64.invCDF();

        int128 z = w.sub(beta.mul(v));
        return spot64x64.mul(z.exp());
    }

    function _snapToGrid(bool isCall, int128 n) internal pure returns (int128) {
        return isCall ? n.ceil64x64() : n.floor64x64();
    }
}
