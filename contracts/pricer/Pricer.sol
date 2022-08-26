// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./PricerInternal.sol";

contract Pricer is IPricer, PricerInternal {
    constructor(address pool, address volatilityOracle)
        PricerInternal(pool, volatilityOracle)
    {}

    /**
     * @inheritdoc IPricer
     */
    function latestAnswer64x64() external view returns (int128) {
        return _latestAnswer64x64();
    }

    /**
     * @inheritdoc IPricer
     */
    function getTimeToMaturity64x64(uint64 expiry)
        external
        view
        returns (int128)
    {
        return _getTimeToMaturity64x64(expiry);
    }

    /**
     * @inheritdoc IPricer
     */
    function getAnnualizedVolatility64x64(
        int128 spot64x64,
        int128 strike64x64,
        int128 timeToMaturity64x64
    ) external view returns (int128) {
        return
            _getAnnualizedVolatility64x64(
                spot64x64,
                strike64x64,
                timeToMaturity64x64
            );
    }

    /**
     * @inheritdoc IPricer
     */
    function getBlackScholesPrice64x64(
        int128 spot64x64,
        int128 strike64x64,
        int128 timeToMaturity64x64,
        bool isCall
    ) external view returns (int128) {
        return
            _getBlackScholesPrice64x64(
                spot64x64,
                strike64x64,
                timeToMaturity64x64,
                isCall
            );
    }

    /**
     * @inheritdoc IPricer
     */
    function getDeltaStrikePrice64x64(
        bool isCall,
        uint64 expiry,
        int128 delta64x64
    ) external view returns (int128) {
        return _getDeltaStrikePrice64x64(isCall, expiry, delta64x64);
    }

    /**
     * @inheritdoc IPricer
     */
    function snapToGrid64x64(bool isCall, int128 n)
        external
        pure
        returns (int128)
    {
        return _snapToGrid64x64(isCall, n);
    }
}