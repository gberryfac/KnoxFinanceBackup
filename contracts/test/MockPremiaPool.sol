// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "hardhat/console.sol";

contract MockPremiaPool {
    struct PoolSettings {
        address underlying;
        address base;
        address underlyingOracle;
        address baseOracle;
    }

    PoolSettings settings;

    constructor(
        address _underlying,
        address _base,
        address _underlyingOracle,
        address _baseOracle
    ) {
        settings.underlying = _underlying;
        settings.base = _base;
        settings.underlyingOracle = _underlyingOracle;
        settings.baseOracle = _baseOracle;
    }

    function getPoolSettings() external view returns (PoolSettings memory) {
        return settings;
    }

    function writeFrom(
        address underwriter,
        address longReceiver,
        uint64 maturity,
        int128 strike64x64,
        uint256 contractSize,
        bool isCall
    ) external payable returns (uint256 longTokenId, uint256 shortTokenId) {}

    function withdraw(uint256 amount, bool isCallPool) external {}

    function setDivestmentTimestamp(uint64 timestamp, bool isCallPool)
        external
    {}

    function processExpired(uint256 longTokenId, uint256 contractSize)
        external
    {}

    function balanceOf(address account, uint256 id)
        external
        view
        returns (uint256)
    {}
}
