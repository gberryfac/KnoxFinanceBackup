// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IPremiaPool {
    struct PoolSettings {
        address underlying;
        address base;
        address underlyingOracle;
        address baseOracle;
    }

    function accountsByToken(uint256 id)
        external
        view
        returns (address[] memory);

    function balanceOf(address account, uint256 id)
        external
        view
        returns (uint256);

    function exerciseFrom(
        address holder,
        uint256 longTokenId,
        uint256 contractSize
    ) external;

    function getPoolSettings() external view returns (PoolSettings memory);

    function getPriceAfter64x64(uint256 timestamp)
        external
        view
        returns (int128 spot64x64);

    function processExpired(uint256 longTokenId, uint256 contractSize) external;

    function safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes calldata data
    ) external;

    function setDivestmentTimestamp(uint64 timestamp, bool isCallPool) external;

    function tokensByAccount(address account)
        external
        view
        returns (uint256[] memory);

    function update() external;

    function withdraw(uint256 amount, bool isCallPool) external;

    function writeFrom(
        address underwriter,
        address longReceiver,
        uint64 maturity,
        int128 strike64x64,
        uint256 contractSize,
        bool isCall
    ) external payable returns (uint256 longTokenId, uint256 shortTokenId);
}
