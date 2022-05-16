// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "hardhat/console.sol";

contract MockVault {
    address public immutable asset;

    constructor(address _asset) {
        asset = _asset;
    }

    function sync(uint256) external view returns (address) {
        return asset;
    }
}
