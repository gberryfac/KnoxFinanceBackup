// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Knox Vault Events Interface
 */

interface IVaultEvents {
    /************************************************
     *  EVENTS
     ***********************************************/

    event AuctionPricesSet(
        uint64 indexed epoch,
        int128 strike64x64,
        int128 offsetStrike64x64,
        int128 spot64x64,
        int128 timeToMaturity64x64,
        int128 maxPrice64x64,
        int128 minPrice64x64
    );

    event AuctionProcessed(
        uint64 indexed epoch,
        uint256 totalCollateralUsed,
        uint256 totalContractsSold,
        uint256 totalPremiums
    );

    event AuctionWindowOffsetsSet(
        uint64 indexed epoch,
        uint256 oldStartOffset,
        uint256 newStartOffset,
        uint256 oldEndOffset,
        uint256 newEndOffset,
        address caller
    );

    event DeltaSet(
        uint64 indexed epoch,
        int128 oldDelta,
        int128 newDelta,
        address caller
    );

    event DistributionSent(
        uint64 indexed epoch,
        uint256 collateralAmount,
        uint256 shortContracts,
        address receiver
    );

    event FeeRecipientSet(
        uint64 indexed epoch,
        address oldFeeRecipient,
        address newFeeRecipient,
        address caller
    );

    event KeeperSet(
        uint64 indexed epoch,
        address oldKeeper,
        address newKeeper,
        address caller
    );

    event OptionParametersSet(
        uint64 indexed epoch,
        uint64 expiry,
        int128 strike64x64,
        uint256 longTokenId,
        uint256 shortTokenId
    );

    event PerformanceFeeCollected(
        uint64 indexed epoch,
        uint256 netIncome,
        uint256 feeInCollateral
    );

    event PerformanceFeeSet(
        uint64 indexed epoch,
        int128 oldPerformanceFee,
        int128 newPerformanceFee,
        address caller
    );

    event PricerSet(
        uint64 indexed epoch,
        address oldPricer,
        address newPricer,
        address caller
    );

    event ReservedLiquidityWithdrawn(uint64 indexed epoch, uint256 amount);

    event WithdrawalFeeCollected(
        uint64 indexed epoch,
        uint256 feeInCollateral,
        uint256 feeInShortContracts
    );

    event WithdrawalFeeSet(
        uint64 indexed epoch,
        int128 oldWithdrawalFee,
        int128 newWithdrawalFee,
        address caller
    );
}
