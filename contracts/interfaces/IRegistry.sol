// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

interface IRegistry {
    function authenticate(bytes memory data, bytes memory signature)
        external
        returns (bool);

    function getTreasuryAddress(bytes memory signature)
        external
        returns (address);
}
