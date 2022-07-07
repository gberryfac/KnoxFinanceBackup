// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IVaultView {
    function totalDeposits() external view returns (uint256);

    function epoch() external view returns (uint64);

    function collateralAsset() external view returns (address);

    function pricePerShare(uint64 epoch) external view returns (uint256);

    function option()
        external
        view
        returns (
            bool,
            uint256,
            uint256
        );
}
