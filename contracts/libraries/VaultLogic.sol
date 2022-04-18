// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "abdk-libraries-solidity/ABDKMath64x64.sol";

import "./../interfaces/IWETH.sol";

import "./Errors.sol";
import "./ShareMath.sol";
import "./VaultSchema.sol";

import "hardhat/console.sol";

library VaultLogic {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;
    using ABDKMath64x64 for int128;

    /**
     * @notice Helper function to make either an ETH transfer or ERC20 transfer
     * @param recipient is the receiving address
     * @param amount is the transfer amount
     */
    function transferAsset(
        address recipient,
        address asset,
        address WETH,
        uint256 amount
    ) external {
        if (asset == WETH) {
            IWETH(WETH).withdraw(amount);
            (bool success, ) = recipient.call{value: amount}("");
            require(success, Errors.TRANSFER_FAILED);
            return;
        }

        IERC20(asset).safeTransfer(recipient, amount);
    }

    function toBaseDecimals(
        uint256 value,
        VaultSchema.VaultParams memory vaultParams
    ) external pure returns (uint256) {
        int128 value64x64 = ABDKMath64x64.divu(
            value,
            10**vaultParams.underlyingDecimals
        );

        return value64x64.mulu(10**vaultParams.assetDecimals);
    }
}
