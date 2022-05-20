// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./../../interfaces/IPremiaPool.sol";
import "./../../interfaces/IStandardDeltaPricer.sol";
import "./../../interfaces/IVault.sol";
import {
    AggregatorInterface,
    IVolatilitySurfaceOracle
} from "./../../interfaces/Oracles.sol";

import "./../StandardDeltaPricer.sol";

import "./StandardDeltaSchema.sol";

contract StandardDeltaStorage {
    bool internal initialized = false;

    uint16 public startOffset;
    uint16 public endOffset;

    uint256[2] public saleWindow;

    address public keeper;

    IERC20 public Asset;
    IPremiaPool public Pool;

    IStandardDeltaPricer public Pricer;
    IVault public Vault;

    StandardDeltaSchema.AssetProperties public assetProperties;
    StandardDeltaSchema.Option public option;
}
