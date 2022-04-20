// SPDX-License-Identifier: MIT
// Based on OpenZeppelin Contracts v4.4.1 (token/ERC1155/ERC1155.sol)

pragma solidity ^0.8.0;

import "@solidstate/contracts/token/ERC1155/ERC1155.sol";

import "hardhat/console.sol";

contract KToken is ERC1155 {
    constructor() {}

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}
