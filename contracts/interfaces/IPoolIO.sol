// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

interface IPoolIO {
    function setDivestmentTimestamp(uint64 timestamp, bool isCallPool) external;
}
