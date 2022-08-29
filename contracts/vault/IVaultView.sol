// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./VaultStorage.sol";

interface IVaultView {
    /**
     * @notice gets the current epoch
     * @return current epoch id
     */
    function getEpoch() external view returns (uint64);

    /**
     * @notice gets the option by epoch id
     * @return option parameters
     */
    function getOption(uint64 epoch)
        external
        view
        returns (VaultStorage.Option memory);

    /**
     * @notice gets the total vault collateral
     * @return total vault collateral
     */
    function totalCollateral() external view returns (uint256);

    /**
     * @notice gets the short position value denominated in the collateral asset
     * @return total short position in collateral amount
     */
    function totalShortAsCollateral() external view returns (uint256);

    /**
     * @notice gets the amount in short contracts underwitten by the vault in the last epoch
     * @return total short contracts
     */
    function totalShortAsContracts() external view returns (uint256);

    /**
     * @notice gets the total reserved collateral
     * @return total reserved collateral
     */
    function totalReserves() external view returns (uint256);
}
