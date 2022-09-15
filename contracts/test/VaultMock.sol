// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../vault/VaultBase.sol";

/**
 * @title Knox Vault Mock Contract
 * @dev deployed standalone and referenced by VaultDiamond
 */

contract VaultMock is VaultBase {
    using SafeERC20 for IERC20;
    using VaultStorage for VaultStorage.Layout;

    constructor(bool isCall, address pool) VaultBase(isCall, pool) {}

    function withdrawReservedLiquidity() external {
        _withdrawReservedLiquidity();
    }
}
