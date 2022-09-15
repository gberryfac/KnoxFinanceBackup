// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../vault/IVault.sol";

/**
 * @title Knox Vault Interface
 */

interface IVaultMock is IVault {
    function withdrawReservedLiquidity() external;
}
