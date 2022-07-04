// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IAdmin.sol";
import "./IBase.sol";
import "./IView.sol";
import "./IWrite.sol";

interface IVault is IAdmin, IBase, IView, IWrite {}
