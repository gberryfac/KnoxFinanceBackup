// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@solidstate/contracts/token/ERC20/ERC20.sol";
import "@solidstate/contracts/token/ERC20/metadata/ERC20MetadataStorage.sol";
import "@solidstate/contracts/token/ERC4626/base/ERC4626Base.sol";
import "@solidstate/contracts/token/ERC4626/base/ERC4626BaseStorage.sol";

import "hardhat/console.sol";

abstract contract ERC4626 is ERC4626Base, ERC20 {
    using ERC20MetadataStorage for ERC20MetadataStorage.Layout;
    using ERC4626BaseStorage for ERC4626BaseStorage.Layout;

    constructor(
        string memory _name,
        string memory _symbol,
        address _asset
    ) {
        ERC20MetadataStorage.Layout storage ERC20Layout =
            ERC20MetadataStorage.layout();

        ERC20Layout.setName(_name);
        ERC20Layout.setSymbol(_symbol);
        ERC20Layout.setDecimals(18);

        ERC4626BaseStorage.Layout storage ERC4626Layout =
            ERC4626BaseStorage.layout();

        ERC4626Layout.asset = _asset;
    }
}
