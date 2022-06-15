// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@solidstate/contracts/token/ERC4626/IERC4626.sol";

import "./IQueue.sol";
import "./../vaults/Storage.sol";

interface IVault is IERC4626, IQueue {
    function initializeVault(
        Storage.InitParams memory _initParams,
        Storage.InitProps memory _initProps,
        address _keeper,
        address _feeRecipient,
        address _strategy
    ) external;

    function processEpoch() external;

    function withdrawReservedLiquidity() external;

    function collectVaultFees() external;

    function depositQueuedToVault() external;

    function borrow() external;

    function totalQueuedAssets() external view returns (uint256);

    function epoch() external view returns (uint256);

    function pricePerShare(uint256 epoch) external view returns (uint256);

    function option()
        external
        view
        returns (
            bool,
            uint256,
            uint256,
            address
        );
}
