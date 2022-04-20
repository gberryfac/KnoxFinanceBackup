// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./../interfaces/IVault.sol";

contract MockStrategy {
    IVault private Vault;

    constructor(
        address,
        address,
        address
    ) {}

    function transferFundsFromVault(address to, uint256 amount) external {
        IERC20(Vault.asset()).transfer(to, amount);
    }
}
