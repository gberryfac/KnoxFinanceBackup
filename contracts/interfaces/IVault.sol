// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IVault {
    function baseToken() external returns (IERC20);

    function trustedBorrow(uint256 amount) external;

    function trustedRepay(uint256 amount) external;

    function currentEpoch() external returns (int32);

    function createNewEpoch() external;
}
