// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IStrikeSelection} from "../../interfaces/IPricer.sol";
import {
    AggregatorInterface,
    IVolatilitySurfaceOracle
} from "../interfaces/Oracles.sol";

import {
    ABDKMath64x64,
    ABDKMath64x64Token
} from "../../libraries/ABDKMath64x64Token.sol";
import "../../libraries/CumulativeNormalDistribution.sol";

import "./PricerStorage.sol";

contract StrikeSelection is IStrikeSelection, PricerStorage {
    using ABDKMath64x64 for int128;
    using ABDKMath64x64 for uint256;
    using ABDKMath64x64Token for int128;

    function latestAnswer64x64() external view returns (int128) {
        return _latestAnswer64x64();
    }

    function getTimeToMaturity64x64(uint64 expiry)
        external
        view
        returns (int128)
    {
        return _getTimeToMaturity64x64(expiry);
    }

    function getAnnualizedVolatilityATM64x64(
        int128 tau64x64,
        int128 spot64x64,
        int128 strike64x64
    ) external view returns (int128) {
        return
            _getAnnualizedVolatilityATM64x64(tau64x64, spot64x64, strike64x64);
    }

    function getDeltaStrikePrice64x64(
        bool isCall,
        uint64 expiry,
        int128 delta64x64
    ) external view returns (int128) {
        return _getDeltaStrikePrice64x64(isCall, expiry, delta64x64);
    }

    function snapToGrid(bool isCall, int128 n) external pure returns (int128) {
        return _snapToGrid(isCall, n);
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

    function _getAnnualizedVolatilityATM64x64(
        int128 tau64x64,
        int128 spot64x64,
        int128 strike64x64
    ) internal view returns (int128) {
        return
            IVolOracle.getAnnualizedVolatility64x64(
                assetProperties.base,
                assetProperties.underlying,
                spot64x64,
                strike64x64,
                tau64x64
            );
    }

    function _getDeltaStrikePrice64x64(
        bool isCall,
        uint64 expiry,
        int128 delta64x64
    ) internal view returns (int128) {
        int128 spot64x64 = _latestAnswer64x64();

        int128 tau64x64 = _getTimeToMaturity64x64(expiry);
        require(tau64x64 > 0, "tau <= 0");

        int128 iv_atm =
            _getAnnualizedVolatilityATM64x64(tau64x64, spot64x64, spot64x64);
        require(iv_atm > 0, "iv_atm <= 0");

        int128 v = iv_atm.mul(tau64x64.sqrt());
        int128 w = tau64x64.mul(iv_atm.pow(2)) >> 1;

        if (!isCall) delta64x64 = int128(0x010000000000000000).sub(delta64x64);
        int128 beta = CumulativeNormalDistribution.getInverseCDF(delta64x64);

        int128 z = w.sub(beta.mul(v));
        return spot64x64.mul(z.exp());
    }

    function _snapToGrid(bool isCall, int128 n) internal pure returns (int128) {
        return isCall ? n.ceil64x64() : n.floor64x64();
    }
}
