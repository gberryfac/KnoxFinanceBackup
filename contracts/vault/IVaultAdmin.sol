// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./VaultStorage.sol";

interface IVaultAdmin {
    /************************************************
     *  INITIALIZATION
     ***********************************************/

    // /**
    //  * @notice
    //  * @param
    //  * @param
    //  */
    function initialize(VaultStorage.InitImpl memory initImpl) external;

    /************************************************
     *  ADMIN
     ***********************************************/

    // /**
    //  * @notice
    //  * @param
    //  * @param
    //  */
    function setAuctionWindowOffsets(uint16 start, uint16 end) external;

    /**
     * @notice Sets the new fee recipient
     * @param newFeeRecipient is the address of the new fee recipient
     */
    function setFeeRecipient(address newFeeRecipient) external;

    /**
     * @notice Sets the new keeper
     * @param newKeeper is the address of the new keeper
     */
    function setKeeper(address newKeeper) external;

    // /**
    //  * @notice
    //  * @param
    //  */
    function setPricer(address newPricer) external;

    /**
     * @notice Sets the performance fee for the vault
     * @param newPerformanceFee64x64 is the performance fee as a 64x64 fixed point number
     */
    function setPerformanceFee64x64(int128 newPerformanceFee64x64) external;

    /**
     * @notice Sets the withdrawal fee for the vault
     * @param newWithdrawalFee64x64 is the withdrawal fee as a 64x64 fixed point number
     */
    function setWithdrawalFee64x64(int128 newWithdrawalFee64x64) external;

    /************************************************
     *  INITIALIZE AUCTION
     ***********************************************/

    /**
     * @notice
     */
    function setAndInitializeAuction() external;

    /**
     * @notice Sets the parameters for the next option to be sold
     */
    function setOptionParameters() external;

    /**
     * @notice
     */
    function initializeAuction() external;

    /************************************************
     *  PROCESS LAST EPOCH
     ***********************************************/

    // /**
    //  * @notice
    //  */
    function initializeAndProcessEpochs() external;

    /**
     * @notice Prepares the strategy and initiates the next round of option sales
     */
    function processLastEpoch() external;

    /**
     * @notice Transfers reserved liquidity from Premia pool to Vault.
     */
    function withdrawReservedLiquidity() external;

    // /**
    //  * @notice
    //  */
    function collectPerformanceFee() external;

    /************************************************
     *  SET AUCTION PRICES
     ***********************************************/

    /**
     * @notice Sets the start and end time of the auction.
     */
    function setAuctionPrices() external;

    /************************************************
     *  INITIALIZE NEXT EPOCH
     ***********************************************/

    // /**
    //  * @notice
    //  */
    function initalizeNextEpoch() external;

    // /**
    //  * @notice
    //  */
    function setNextEpoch() external;

    /************************************************
     *  PROCESS AUCTION
     ***********************************************/

    /**
     * @notice
     */
    function processAuction() external;

    /************************************************
     * HELPERS
     ***********************************************/

    /**
     * @notice
     */
    function getExerciseAmount(uint64 epoch, uint256 size)
        external
        view
        returns (bool, uint256);
}
