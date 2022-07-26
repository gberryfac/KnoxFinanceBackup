// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IVaultAdmin.sol";
import "./IVaultBase.sol";
import "./IVaultEvents.sol";
import "./IVaultView.sol";

interface IVault is IVaultAdmin, IVaultBase, IVaultEvents, IVaultView {}
