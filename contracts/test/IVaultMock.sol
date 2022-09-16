// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../vault/IVault.sol";

/**
 * @title Knox Vault Interface
 */

interface IVaultMock is IVault {
    function withdrawReservedLiquidity() external;

    function getFriday(uint256 timestamp) external pure returns (uint256);

    function getNextFriday(uint256 timestamp) external pure returns (uint256);
}
