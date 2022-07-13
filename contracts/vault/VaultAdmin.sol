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
     *  SETTERS
     ***********************************************/

    /**
     * @notice Sets the new fee recipient
     * @param newFeeRecipient is the address of the new fee recipient
     */
    function setFeeRecipient(address newFeeRecipient) external onlyOwner {
        VaultStorage.layout()._setFeeRecipient(newFeeRecipient);
    }

    function setPricer(address newPricer) external onlyOwner {
        VaultStorage.layout()._setPricer(newPricer);
    }

    /**
     * @notice Sets the performance fee for the vault
     * @param newPerformanceFee is the performance fee (6 decimals). ex: 20 * 10 ** 6 = 20%
     */
    function setPerformanceFee(uint256 newPerformanceFee) external onlyOwner {
        VaultStorage.layout()._setPerformanceFee(newPerformanceFee);
    }

    /**
     * @notice Sets the withdrawal fee for the vault
     * @param newWithdrawalFee is the withdrawal fee (6 decimals). ex: 2 * 10 ** 6 = 2%
     */
    function setWithdrawalFee(uint256 newWithdrawalFee) external onlyOwner {
        VaultStorage.layout()._setWithdrawalFee(newWithdrawalFee);
    }

    // /**
    //  * @notice
    //  * @param
    //  * @param
    //  */
    function setAuctionWindowOffsets(uint16 start, uint16 end)
        external
        onlyOwner
    {
        VaultStorage.layout()._setAuctionWindowOffsets(start, end);
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
    function collectVaultFees() external onlyKeeper {
        _collectVaultFees();
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
