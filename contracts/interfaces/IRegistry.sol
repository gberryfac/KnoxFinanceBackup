// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IRegistry {
    function authenticate(
        bytes memory signature,
        uint64 deadline,
        uint64 maturity,
        int128 strikePrice,
        int128 premium,
        bool isCall
    ) external view returns (bool);
}
