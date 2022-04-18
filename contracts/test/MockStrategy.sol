// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../vaults/Vault.sol";

contract MockStrategy is Vault {
    constructor(
        address,
        address _weth,
        address _registry
    ) Vault(_weth, _registry) {}

    function purchase(
        bytes memory signature,
        uint64 deadline,
        uint64 maturity,
        int128 strike64x64,
        int128 premium64x64,
        uint256 contractSize,
        bool isCall
    ) external {
        _openPosition(
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
        _rollover();
    }

    function transferFundsFromVault(address to, uint256 amount) external {
        IERC20(vaultParams.asset).transfer(to, amount);
    }
}
