// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./VaultInternal.sol";

contract VaultView is VaultInternal {
    using VaultStorage for VaultStorage.Layout;

    constructor(bool isCall, address pool) VaultInternal(isCall, pool) {}

    function accountsByOption(uint256 id)
        external
        view
        returns (address[] memory)
    {
        return Pool.accountsByToken(id);
    }

    function getEpoch() external view returns (uint64) {
        return VaultStorage.layout()._getEpoch();
    }

    function getCollateralAsset() external view returns (address) {
        return address(ERC20);
    }

    function totalCollateral() external view returns (uint256) {
        return _totalCollateral();
    }

    function optionsByAccount(address account)
        external
        view
        returns (uint256[] memory)
    {
        return Pool.tokensByAccount(account);
    }

    function optionByEpoch(uint64 _epoch)
        external
        view
        returns (VaultStorage.Option memory)
    {
        return VaultStorage.layout()._optionByEpoch(_epoch);
    }
}
