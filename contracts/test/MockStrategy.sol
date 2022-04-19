// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./../interfaces/IVault.sol";

contract MockStrategy {
    IVault internal Vault;

    constructor(
        address,
        address,
        address,
        address
    ) {}

    function setVault(address vault) external {
        Vault = IVault(vault);
    }

    function purchase(
        bytes memory signature,
        uint64 deadline,
        uint64 maturity,
        int128 strike64x64,
        int128 premium64x64,
        uint256 contractSize,
        bool isCall
    ) external {
        Vault.borrow(
            signature,
            deadline,
            maturity,
            strike64x64,
            premium64x64,
            contractSize,
            isCall
        );
    }

    function harvest() external {
        Vault.harvest();
    }

    function transferFundsFromVault(address to, uint256 amount) external {
        IERC20(Vault.asset()).transfer(to, amount);
    }
}
