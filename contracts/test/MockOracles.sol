// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MockSpotPriceOracle {
    uint8 public decimals;
    int256 private price;

    constructor(uint8 _decimals, int256 _price) {
        decimals = _decimals;
        price = _price;
    }

    function latestAnswer() external view returns (int256) {
        return price;
    }
}

contract MockVolatilityOracle {
    int128 private annualizedVolatility;

    constructor(int128 _annualizedVolatility) {
        annualizedVolatility = _annualizedVolatility;
    }

    function getAnnualizedVolatility64x64(
        address,
        address,
        int128,
        int128,
        int128
    ) external view returns (int128) {
        return annualizedVolatility;
    }
}
