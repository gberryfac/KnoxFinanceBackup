// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "abdk-libraries-solidity/ABDKMath64x64.sol";

import {IStrikeSelection} from "./../../interfaces/IStandardDeltaPricer.sol";
import {
    AggregatorInterface,
    IVolatilitySurfaceOracle
} from "./../../interfaces/Oracles.sol";

import "./../../libraries/CumulativeNormalDistribution.sol";

import "./StandardDeltaPricerStorage.sol";

import "hardhat/console.sol";

contract StrikeSelection is IStrikeSelection, StandardDeltaPricerStorage {
    using ABDKMath64x64 for int128;
    using ABDKMath64x64 for uint256;

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

    function getAnnualizedVolatilityATM64x64(int128 tau64x64, int128 spot64x64)
        external
        view
        returns (int128)
    {
        return _getAnnualizedVolatilityATM64x64(tau64x64, spot64x64);
    }

    function getDeltaStrikePrice64x64(
        bool isCall,
        uint64 expiry,
        int128 delta64x64
    ) external view returns (int128) {
        return _getDeltaStrikePrice64x64(isCall, expiry, delta64x64);
    }

    function snapToGrid(int128 n) external view returns (int128) {
        return _snapToGrid(n);
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

    function _getAnnualizedVolatilityATM64x64(int128 tau64x64, int128 spot64x64)
        internal
        view
        returns (int128)
    {
        return
            IVolOracle.getAnnualizedVolatility64x64(
                assetProperties.base,
                assetProperties.underlying,
                spot64x64,
                spot64x64,
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

        int128 iv_atm = _getAnnualizedVolatilityATM64x64(tau64x64, spot64x64);
        require(iv_atm > 0, "iv_atm <= 0");

        int128 v = iv_atm.mul(tau64x64.sqrt());
        int128 w = tau64x64.mul(iv_atm.pow(2)) >> 1;

        if (!isCall) delta64x64 = int128(0x010000000000000000).sub(delta64x64);
        int128 beta = CumulativeNormalDistribution.getInverseCDF(delta64x64);

        int128 z = w.sub(beta.mul(v));
        return spot64x64.mul(z.exp());
    }

    function _snapToGrid(int128 n) internal view returns (int128) {
        if (n.toUInt() < sFactor) return n;

        return
            uint256(((n.toUInt() + (sFactor / 2)) / sFactor) * sFactor)
                .fromUInt();
    }
}
