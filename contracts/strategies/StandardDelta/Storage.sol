// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./../../interfaces/IPremiaPool.sol";
import "./../../interfaces/IVault.sol";

import "./Schema.sol";

import "hardhat/console.sol";

contract Storage {
    bool internal initialized = false;

    uint16 public startOffset;
    uint16 public endOffset;

    uint256[2] public saleWindow;

    address public keeper;

    IERC20 public Asset;
    IPremiaPool public Pool;
    IVault public Vault;

    Schema.Option public option;
    Schema.AssetProperties public assetProperties;
}
