// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@solidstate/contracts/token/ERC4626/base/ERC4626Base.sol";

import "./internal/BaseInternal.sol";

contract Base is BaseInternal, ERC4626Base {
    using SafeERC20 for IERC20;
    using Storage for Storage.Layout;

    constructor(bool isCall, address pool) BaseInternal(isCall, pool) {}

    /************************************************
     *  ERC4626 OVERRIDES
     ***********************************************/

    function _deposit(uint256 assetAmount, address receiver)
        internal
        override(BaseInternal, ERC4626BaseInternal)
        returns (uint256)
    {
        return super._deposit(assetAmount, receiver);
    }

    function _mint(uint256 shareAmount, address receiver)
        internal
        override(BaseInternal, ERC4626BaseInternal)
        returns (uint256)
    {
        return super._mint(shareAmount, receiver);
    }

    function _withdraw(
        uint256 assetAmount,
        address receiver,
        address owner
    ) internal override(BaseInternal, ERC4626BaseInternal) returns (uint256) {
        return super._withdraw(assetAmount, receiver, owner);
    }

    function _redeem(
        uint256 shareAmount,
        address receiver,
        address owner
    ) internal override(BaseInternal, ERC4626BaseInternal) returns (uint256) {
        return super._redeem(shareAmount, receiver, owner);
    }
}

// TODO: Restructure files
