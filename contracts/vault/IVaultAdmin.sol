// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./VaultStorage.sol";

/**
 * @title Knox Vault Admin Interface
 */

interface IVaultAdmin {
    /************************************************
     *  INITIALIZATION
     ***********************************************/

    /**
     * @notice initializes vault with queue, auction, and pricer addresses
     * @param initImpl initialization parameters
     */
    function initialize(VaultStorage.InitImpl memory initImpl) external;

    /************************************************
     *  ADMIN
     ***********************************************/

    /**
     * @notice sets the start and end offsets for the auction
     * @param newStartOffset new start offset
     * @param newEndOffset new end offset
     */
    function setAuctionWindowOffsets(
        uint256 newStartOffset,
        uint256 newEndOffset
    ) external;

    /**
     * @notice sets the option delta value
     * @param newDelta64x64 new option delta value as a 64x64 fixed point number
     */
    function setDelta64x64(int128 newDelta64x64) external;

    /**
     * @notice sets the new fee recipient
     * @param newFeeRecipient address of the new fee recipient
     */
    function setFeeRecipient(address newFeeRecipient) external;

    /**
     * @notice sets the new keeper
     * @param newKeeper address of the new keeper
     */
    function setKeeper(address newKeeper) external;

    /**
     * @notice sets the new pricer
     * @param newPricer address of the new pricer
     */
    function setPricer(address newPricer) external;

    /**
     * @notice sets the performance fee for the vault
     * @param newPerformanceFee64x64 performance fee as a 64x64 fixed point number
     */
    function setPerformanceFee64x64(int128 newPerformanceFee64x64) external;

    /**
     * @notice sets the withdrawal fee for the vault
     * @param newWithdrawalFee64x64 withdrawal fee as a 64x64 fixed point number
     */
    function setWithdrawalFee64x64(int128 newWithdrawalFee64x64) external;

    /************************************************
     *  INITIALIZE AUCTION
     ***********************************************/

    /**
     * @notice sets the option parameters and initializes auction
     */
    function setAndInitializeAuction() external;

    /**
     * @notice sets the parameters for the next option to be sold
     */
    function setOptionParameters() external;

    /**
     * @notice initializes the auction
     */
    function initializeAuction() external;

    /************************************************
     *  PROCESS LAST EPOCH
     ***********************************************/

    /**
     * @notice withdraws reserved liquidity and collects performance fees
     */
    function processLastEpoch() external;

    /**
     * @notice removes reserved liquidity from Premia pool
     */
    function withdrawReservedLiquidity() external;

    /**
     * @notice collects performance fees on epoch net income
     * @dev reserved liquidity must be returned to vault prior to being called
     */
    function collectPerformanceFee() external;

    /************************************************
     *  INITIALIZE NEXT EPOCH
     ***********************************************/

    /**
     * @notice initializes the next epoch
     */
    function initializeNextEpoch() external;

    /************************************************
     *  SET AUCTION PRICES
     ***********************************************/

    /**
     * @notice calculates and sets the auction prices
     */
    function setAuctionPrices() external;

    /************************************************
     *  PROCESS AUCTION
     ***********************************************/

    /**
     * @notice processes the auction when it has been finalized
     * @dev divestment timestamp must be set in Premia pool, otherwise exercised options
     * will be moved to free liquidity queue
     */
    function processAuction() external;
}
