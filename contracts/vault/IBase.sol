// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@solidstate/contracts/token/ERC4626/IERC4626.sol";

interface IBase is IERC4626 {
    function totalCollateral() external view returns (uint256);
}
