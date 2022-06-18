// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IAdmin.sol";
import "./IAuction.sol";
import "./IBase.sol";
import "./IQueue.sol";
import "./IView.sol";

interface IVault is IAdmin, IAuction, IBase, IQueue, IView {}
