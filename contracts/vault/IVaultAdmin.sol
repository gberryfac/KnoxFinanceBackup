// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./VaultStorage.sol";

interface IVaultAdmin {
    event OptionParametersSet(bool isCall, uint64 expiry, int128 strike64x64);

    event SaleWindowSet(
        uint256 blockTimestamp,
        uint256 startTime,
        uint256 endTime
    );

    // /**
    //  * @notice
    //  * @param
    //  * @param
    //  */
    function initialize(VaultStorage.InitImpl memory initImpl) external;

    /**
     * @notice Pauses the vault during an emergency preventing deposits and borrowing.
     */
    function pause() external;

    /**
     * @notice Unpauses the vault during following an emergency allowing deposits and borrowing.
     */
    function unpause() external;

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
     * @notice Sets the withdrawal fee for the vault
     * @param newWithdrawalFee is the withdrawal fee (6 decimals). ex: 2 * 10 ** 6 = 2%
     */
    function setWithdrawalFee(uint256 newWithdrawalFee) external;

    /**
     * @notice Sets the performance fee for the vault
     * @param newPerformanceFee is the performance fee (6 decimals). ex: 20 * 10 ** 6 = 20%
     */
    function setPerformanceFee(uint256 newPerformanceFee) external;

    // /**
    //  * @notice
    //  * @param
    //  * @param
    //  */
    function setAuctionWindowOffsets(uint16 start, uint16 end) external;

    /**
     * @notice Prepares the strategy and initiates the next round of option sales
     */
    function processEpoch(bool processExpired) external;

    /**
     * @notice Processes expired options
     */
    function processExpired() external;

    /**
     * @notice Transfers reserved liquidity from Premia pool to Vault.
     */
    function withdrawReservedLiquidity() external;

    // /**
    //  * @notice
    //  */
    function depositQueuedToVault() external;

    // /**
    //  * @notice
    //  */
    function collectVaultFees() external;

    /**
     * @notice Sets the parameters for the next option to be sold
     */
    function setOptionParameters() external;

    /**
     * @notice Sets the start and end time of the auction.
     */
    function setAuctionPrices() external;

    /**
     * @notice Sets the start and end time of the auction.
     */
    function setAuctionWindow() external;

    /**
     * @notice
     */
    function getIntrinsicValue(uint64 epoch, uint256 size)
        external
        view
        returns (bool, uint256);
}
