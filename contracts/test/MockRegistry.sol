// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Registry {
    bool public isTrue;

    constructor(bool _isTrue) {
        isTrue = _isTrue;
    }

    function authenticate(
        bytes memory signature,
        uint256 deadline,
        uint256 maturity,
        uint256 strikePrice,
        uint256 spotPrice,
        uint256 premium,
        bool isCall
    ) external view returns (bool) {
        return isTrue;
    }

    function setIsTrue(bool _isTrue) public {
        isTrue = _isTrue;
    }
}
