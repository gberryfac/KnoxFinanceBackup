// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "abdk-libraries-solidity/ABDKMath64x64.sol";

import "./Errors.sol";
import "./ShareMath.sol";
import "./VaultSchema.sol";

import "hardhat/console.sol";

library VaultLogic {
    using SafeMath for uint256;
    using ABDKMath64x64 for int128;

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
