// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library PoolStorage {
    struct PoolSettings {
        address underlying;
        address base;
        address underlyingOracle;
        address baseOracle;
    }
}

interface IPremiaPool {
    function exerciseFrom(
        address holder,
        uint256 longTokenId,
        uint256 contractSize
    ) external;

    function writeFrom(
        address underwriter,
        address longReceiver,
        uint64 maturity,
        int128 strike64x64,
        uint256 contractSize,
        bool isCall
    ) external payable returns (uint256 longTokenId, uint256 shortTokenId);

    function withdraw(uint256 amount, bool isCallPool) external;

    function setDivestmentTimestamp(uint64 timestamp, bool isCallPool) external;

    function getPoolSettings()
        external
        view
        returns (PoolStorage.PoolSettings memory);

    function balanceOf(address account, uint256 id)
        external
        view
        returns (uint256);

    function accountsByToken(uint256 id)
        external
        view
        returns (address[] memory);

    function tokensByAccount(address account)
        external
        view
        returns (uint256[] memory);
}
