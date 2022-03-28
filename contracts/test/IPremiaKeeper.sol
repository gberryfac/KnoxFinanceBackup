// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IPremiaKeeper {
    struct PoolSettings {
        address underlying;
        address base;
        address underlyingOracle;
        address baseOracle;
    }

    function getPoolSettings()
        external
        view
        returns (PoolSettings memory);

    function getPrice(uint256 timestamp) external view returns (int128);

    function getUserTVL(address account)
        external
        view
        returns (uint256 underlyingTVL, uint256 baseTVL);

    function processExpired(uint256 longTokenId, uint256 contractSize) external;
}

