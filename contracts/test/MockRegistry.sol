// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MockRegistry {
    bool public isTrue;

    constructor(bool _isTrue) {
        isTrue = _isTrue;
    }

    function authenticate(
        bytes memory signature,
        uint64 deadline,
        uint64 maturity,
        int128 strikePrice,
        int128 premium,
        bool isCall
    ) external view returns (bool) {
        return isTrue;
    }

    function setIsTrue(bool _isTrue) public {
        isTrue = _isTrue;
    }
}
