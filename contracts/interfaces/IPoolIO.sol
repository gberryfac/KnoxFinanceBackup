// SPDX-License-Identifier: LGPL-3.0-or-later
pragma solidity 0.8.4;

interface IPoolIO {
    function setDivestmentTimestamp(uint64 timestamp, bool isCallPool) external;
}
