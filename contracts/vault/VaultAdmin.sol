// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../access/Access.sol";

import "./VaultInternal.sol";

contract VaultAdmin is Access, VaultInternal {
    using SafeERC20 for IERC20;
    using VaultStorage for VaultStorage.Layout;

    constructor(bool isCall, address pool) VaultInternal(isCall, pool) {}

    /************************************************
     *  INITIALIZATION
     ***********************************************/

    /**
     * @notice
     */
    function initialize(VaultStorage.InitImpl memory initImpl)
        external
        onlyOwner
    {
        // TODO: Validation
        VaultStorage.Layout storage l = VaultStorage.layout();
        l.Auction = IAuction(initImpl.auction);
        l.Queue = IQueue(initImpl.queue);
        l.Pricer = IPricer(initImpl.pricer);

        AccessStorage.layout().queue = initImpl.queue;
    }

    /************************************************
     *  ADMIN
     ***********************************************/

    // /**
    //  * @notice
    //  * @param
    //  * @param
    //  */
    function setAuctionWindowOffsets(uint16 start, uint16 end)
        external
        onlyOwner
    {
        _setAuctionWindowOffsets(start, end);
    }

    /**
     * @notice Sets the new fee recipient
     * @param newFeeRecipient is the address of the new fee recipient
     */
    function setFeeRecipient(address newFeeRecipient) external onlyOwner {
        _setFeeRecipient(newFeeRecipient);
    }

    function setPricer(address newPricer) external onlyOwner {
        _setPricer(newPricer);
    }

    /**
     * @notice Sets the performance fee for the vault
     * @param newPerformanceFee64x64 is the performance fee as a 64x64 fixed point number
     */
    function setPerformanceFee64x64(int128 newPerformanceFee64x64)
        external
        onlyOwner
    {
        _setPerformanceFee64x64(newPerformanceFee64x64);
    }

    /**
     * @notice Sets the withdrawal fee for the vault
     * @param newWithdrawalFee64x64 is the withdrawal fee as a 64x64 fixed point number
     * @dev withdrawal fee must be annualized by dividing by the number of weeks in the year. i.e. 2% / 52.142857
     */
    function setWithdrawalFee64x64(int128 newWithdrawalFee64x64)
        external
        onlyOwner
    {
        _setWithdrawalFee64x64(newWithdrawalFee64x64);
    }

    /************************************************
     *  INITIALIZE AUCTION
     ***********************************************/

    /**
     * @notice
     */
    function setAndInitializeAuction() external {
        _setAndInitializeAuction();
    }

    /**
     * @notice Sets the parameters for the next option to be sold
     */
    function setOptionParameters() external onlyKeeper {
        _setOptionParameters();
    }

    /**
     * @notice Sets the start and end time of the auction.
     */
    function setAuctionWindow() external onlyKeeper {
        _setAuctionWindow();
    }

    /**
     * @notice
     */
    function initializeAuction() external onlyKeeper {
        _initializeAuction();
    }

    /************************************************
     *  PROCESS EPOCH
     ***********************************************/

    /**
     * @notice Prepares the strategy and initiates the next round of option sales
     */
    function processEpoch(bool _processExpired) external {
        _processEpoch(_processExpired);
    }

    /**
     * @notice Processes expired options
     */
    function processExpired() external onlyKeeper {
        _processExpired();
    }

    /**
     * @notice Transfers reserved liquidity from Premia pool to Vault.
     */
    function withdrawReservedLiquidity() external onlyKeeper {
        _withdrawReservedLiquidity();
    }

    /**
     * @notice
     */
    function collectPerformanceFee() external onlyKeeper {
        _collectPerformanceFee();
    }

    /**
     * @notice
     */
    function depositQueuedToVault() external onlyKeeper {
        _depositQueuedToVault();
    }

    /**
     * @notice
     */
    function setNextEpoch() external onlyKeeper {
        _setNextEpoch();
    }

    /**
     * @notice
     */
    function setAuctionPrices() external onlyKeeper {
        _setAuctionPrices();
    }

    /************************************************
     *  PROCESS AUCTION
     ***********************************************/

    /**
     * @notice
     */
    function processAuction() external {
        _processAuction();
    }

    /************************************************
     * HELPERS
     ***********************************************/

    function getExerciseAmount(uint64 epoch, uint256 size)
        external
        view
        returns (bool, uint256)
    {
        return _getExerciseAmount(epoch, size);
    }
}
