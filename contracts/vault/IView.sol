// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IView {
    function totalQueuedAssets() external view returns (uint256);

    function epoch() external view returns (uint256);

    function pricePerShare(uint256 epoch) external view returns (uint256);

    function option()
        external
        view
        returns (
            bool,
            uint256,
            uint256
        );
}
