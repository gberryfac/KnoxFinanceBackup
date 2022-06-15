// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IStrikeSelection {
    function latestAnswer64x64() external view returns (int128);

    function getTimeToMaturity64x64(uint64 expiry)
        external
        view
        returns (int128);

    function getAnnualizedVolatilityATM64x64(
        int128 tau64x64,
        int128 spot64x64,
        int128 strike64x64
    ) external view returns (int128);

    function getDeltaStrikePrice64x64(
        bool isCall,
        uint64 expiry,
        int128 delta64x64
    ) external view returns (int128);

    function snapToGrid(bool isCall, int128 n) external view returns (int128);
}

interface IDeltaPricer is IStrikeSelection {}
