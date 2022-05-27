// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "hardhat/console.sol";

contract MockVault {
    address public immutable asset;

    event Sync();

    constructor(address _asset) {
        asset = _asset;
    }

    function sync(uint256) external returns (address) {
        // NOTE: A `Sync` event is ONLY emitted for TESTING.
        emit Sync();
        return asset;
    }
}
