// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MockRegistry {
    bool public isTrue;

    constructor(bool _isTrue) {
        isTrue = _isTrue;
    }

    function authenticate(
        bytes memory,
        uint64,
        uint64,
        int128,
        int128,
        bool
    ) external view returns (bool) {
        return isTrue;
    }

    function setIsTrue(bool _isTrue) public {
        isTrue = _isTrue;
    }
}
