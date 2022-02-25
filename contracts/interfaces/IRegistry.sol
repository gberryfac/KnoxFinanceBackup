// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

interface IRegistry {
    struct Transaction {
        address controller;
        uint256 deadline;
        uint256 maturity;
        uint256[] strikePrices;
        uint256 spotPrice;
        uint256 premium;
        bool isCall;
    }

    function authenticate(
        bytes memory signature,
        uint256 deadline,
        uint256 strikePrices,
        uint256 spotPrice,
        uint256 premium,
        bool isCall
    ) external view returns (bool)
}
