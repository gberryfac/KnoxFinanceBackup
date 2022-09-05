// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IQueueEvents {
    event Cancel(uint64 indexed epoch, address depositer, uint256 amount);

    event Deposit(
        uint64 indexed epoch,
        address receiver,
        address depositer,
        uint256 amount
    );

    event EpochSet(uint64 indexed epoch, address caller);

    event ExchangeHelperSet(
        address oldExchangeHelper,
        address newExchangeHelper,
        address caller
    );

    event MaxTVLSet(
        uint64 indexed epoch,
        uint256 oldMaxTVL,
        uint256 newMaxTVL,
        address caller
    );

    event Redeem(
        uint64 indexed epoch,
        address receiver,
        address depositer,
        uint256 shares
    );

    event ProcessQueuedDeposits(
        uint64 indexed epoch,
        uint256 deposits,
        uint256 pricePerShare,
        uint256 shares,
        uint256 claimTokenSupply
    );
}
