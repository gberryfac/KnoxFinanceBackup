// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./../libraries/VaultSchema.sol";

interface IVault {
    function depositETH() external payable;

    function deposit(uint256 amount) external;

    function depositFor(uint256 amount, address creditor) external;

    function withdrawInstantly(uint256 amount) external;

    function initiateWithdraw(uint256 numShares) external;

    function completeWithdraw() external;

    function redeem(uint256 numShares) external;

    function maxRedeem() external;

    function borrow(
        bytes memory signature,
        uint64 deadline,
        uint64 maturity,
        int128 strike64x64,
        int128 premium64x64,
        uint256 contractSize,
        bool isCall
    ) external returns (uint256);

    function harvest() external;

    function asset() external view returns (address);

    function expiry() external view returns (uint32);

    function isCall() external view returns (bool);

    function lockedCollateral() external view returns (uint104);

    function round() external view returns (uint16);
}
