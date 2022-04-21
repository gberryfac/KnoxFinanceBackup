// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IPremiaPool {
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

    function balanceOf(address account, uint256 id)
        external
        view
        returns (uint256);
}