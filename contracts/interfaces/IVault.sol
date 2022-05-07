// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./../libraries/VaultSchema.sol";

interface IVault {
    event Deposit(address indexed account, uint256 amount, uint256 round);

    event InitiateWithdraw(
        address indexed account,
        uint256 shares,
        uint256 round
    );

    event Redeem(address indexed account, uint256 share, uint256 round);

    event ManagementFeeSet(uint256 managementFee, uint256 newManagementFee);

    event PerformanceFeeSet(uint256 performanceFee, uint256 newPerformanceFee);

    event CapSet(uint256 oldCap, uint256 newCap);

    event Withdraw(address indexed account, uint256 amount, uint256 shares);

    event CollectVaultFees(
        uint256 performanceFee,
        uint256 vaultFee,
        uint256 round,
        address indexed feeRecipient
    );

    event InstantWithdraw(
        address indexed account,
        uint256 amount,
        uint256 round
    );

    function depositETH() external payable;

    function deposit(uint256 amount) external;

    function depositFor(uint256 amount, address creditor) external;

    function withdrawInstantly(uint256 amount) external;

    function initiateWithdraw(uint256 numShares) external;

    function completeWithdraw() external;

    function redeem(uint256 numShares) external;

    function maxRedeem() external;

    function borrow(int128 strike64x64, uint256 contractSize)
        external
        returns (uint256);

    function harvest() external;

    function expiry() external view returns (uint32);

    function isCall() external view returns (bool);

    function lockedCollateral() external view returns (uint104);

    function round() external view returns (uint16);
}
