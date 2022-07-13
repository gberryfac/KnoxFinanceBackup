// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./VaultStorage.sol";

interface IVaultView {
    function epoch() external view returns (uint64);

    function optionByEpoch(uint64 _epoch)
        external
        view
        returns (VaultStorage.Option memory);

    function collateralAsset() external view returns (address);

    function totalCollateral() external view returns (uint256);

    function accountsByOption(uint256 id)
        external
        view
        returns (address[] memory);

    function optionsByAccount(address account)
        external
        view
        returns (uint256[] memory);
}
