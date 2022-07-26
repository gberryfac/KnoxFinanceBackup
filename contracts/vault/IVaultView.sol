// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./VaultStorage.sol";

interface IVaultView {
    function accountsByOption(uint256 id)
        external
        view
        returns (address[] memory);

    function getEpoch() external view returns (uint64);

    function getCollateralAsset() external view returns (address);

    function optionsByAccount(address account)
        external
        view
        returns (uint256[] memory);

    function optionByEpoch(uint64 _epoch)
        external
        view
        returns (VaultStorage.Option memory);

    function totalCollateral() external view returns (uint256);
}
