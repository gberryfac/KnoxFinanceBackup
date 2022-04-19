// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./../interfaces/IWETH.sol";

import "./Errors.sol";

import "hardhat/console.sol";

library CommonLogic {
    using SafeERC20 for IERC20;

    /**
     * @notice Helper function to make either an ETH transfer or ERC20 transfer
     * @param recipient is the receiving address
     * @param amount is the transfer amount
     */
    function transferAsset(
        address recipient,
        address asset,
        address weth,
        uint256 amount
    ) external {
        if (asset == weth) {
            IWETH(weth).withdraw(amount);
            (bool success, ) = recipient.call{value: amount}("");
            require(success, Errors.TRANSFER_FAILED);
            return;
        }

        IERC20(asset).safeTransfer(recipient, amount);
    }
}
