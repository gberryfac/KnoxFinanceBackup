// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface AggregatorInterface {
    function decimals() external view returns (uint8);

    function latestAnswer() external view returns (int256);
}

interface IVolatilitySurfaceOracle {
    function getAnnualizedVolatility64x64(
        address base,
        address underlying,
        int128 spot64x64,
        int128 strike64x64,
        int128 timeToMaturity64x64
    ) external view returns (int128);
}
