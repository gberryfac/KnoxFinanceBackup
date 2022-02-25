// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IVault {
    struct Epoch {
        uint256 index;
        uint256 expiry;
        uint256 withholding;
    }

    function baseToken() external returns (IERC20);

    function borrow(uint256 amount) external;

    function repay(uint256 amount) external;

    function epoch() external returns (Epoch);

    function rollover() external;
}
