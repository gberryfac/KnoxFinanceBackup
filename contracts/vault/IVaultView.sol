// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./VaultStorage.sol";

interface IVaultView {
    function accountsByOption(uint256 id)
        external
        view
        returns (address[] memory);

    function getEpoch() external view returns (uint64);

    function getOption(uint64 epoch)
        external
        view
        returns (VaultStorage.Option memory);

    function optionsByAccount(address account)
        external
        view
        returns (uint256[] memory);

    function totalCollateral() external view returns (uint256);

    function totalPremiums() external view returns (uint256);

    function totalShortAsCollateral() external view returns (uint256);

    function totalShortAsContracts() external view returns (uint256);

    function totalReserves() external view returns (uint256);
}
