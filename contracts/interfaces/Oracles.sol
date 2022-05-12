// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface AggregatorInterface {
    function latestAnswer() external view returns (int256);
}

interface IVolatilitySurfaceOracle {
    function getAnnualizedVolatility64x64(
        address baseToken,
        address underlyingToken,
        int128 spot64x64,
        int128 strike64x64,
        int128 timeToMaturity64x64,
        bool isCall
    ) external view returns (int128);
}
