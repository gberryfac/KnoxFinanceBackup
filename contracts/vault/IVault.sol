// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/IPremiaPool.sol";

import "./IVaultAdmin.sol";
import "./IVaultBase.sol";
import "./IVaultEvents.sol";
import "./IVaultView.sol";

interface IVault is IVaultAdmin, IVaultBase, IVaultEvents, IVaultView {
    function ERC20() external view returns (IERC20);

    function Pool() external view returns (IPremiaPool);
}
