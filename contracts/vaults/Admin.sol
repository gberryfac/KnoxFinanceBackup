// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./../libraries/Constants.sol";

import "./internal/AdminInternal.sol";

contract Admin is AdminInternal {
    using SafeERC20 for IERC20;
    using Storage for Storage.Layout;

    /************************************************
     *  SAFETY
     ***********************************************/

    /**
     * @notice Pauses the vault during an emergency preventing deposits and borrowing.
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpauses the vault during following an emergency allowing deposits and borrowing.
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /************************************************
     *  ADMIN
     ***********************************************/

    /**
     * @notice Sets the new fee recipient
     * @param newFeeRecipient is the address of the new fee recipient
     */
    function setFeeRecipient(address newFeeRecipient) external onlyOwner {
        Storage._setFeeRecipient(newFeeRecipient);
    }

    /**
     * @notice Sets the new keeper
     * @param newKeeper is the address of the new keeper
     */
    function setKeeper(address newKeeper) external onlyOwner {
        Storage._setKeeper(newKeeper);
    }

    /**
     * @notice Sets the new strategy
     * @param newStrategy is the address of the new strategy
     */
    function setStrategy(address newStrategy) external onlyOwner {
        Storage._setStrategy(newStrategy);
    }

    /**
     * @notice Sets the management fee for the vault
     * @param newManagementFee is the management fee (6 decimals). ex: 2 * 10 ** 6 = 2%
     */
    function setManagementFee(uint256 newManagementFee) external onlyOwner {
        Storage._setManagementFee(newManagementFee);
    }

    /**
     * @notice Sets the performance fee for the vault
     * @param newPerformanceFee is the performance fee (6 decimals). ex: 20 * 10 ** 6 = 20%
     */
    function setPerformanceFee(uint256 newPerformanceFee) external onlyOwner {
        Storage._setPerformanceFee(newPerformanceFee);
    }

    /**
     * @notice Sets a new cap for deposits
     * @param newCap is the new cap for deposits
     */
    function setCap(uint256 newCap) external onlyOwner {
        Storage._setCap(newCap);
    }

    // /**
    //  * @notice
    //  * @param
    //  * @param
    //  */
    function setAuctionWindowOffsets(uint16 start, uint16 end)
        external
        isExpired
        onlyOwner
    {
        Storage._setAuctionWindowOffsets(start, end);
    }

    /************************************************
     *  OPERATIONS
     ***********************************************/

    /**
     * @notice Prepares the strategy and initiates the next round of option sales
     */
    function processEpoch(bool processExpired) external isExpired onlyKeeper {
        _processEpoch(processExpired);
    }

    /**
     * @notice Processes expired options
     */
    function processExpired() external isExpired onlyKeeper {
        _processExpired();
    }

    /**
     * @notice Transfers reserved liquidity from Premia pool to Vault.
     */
    function withdrawReservedLiquidity() external isExpired onlyKeeper {
        _withdrawReservedLiquidity();
    }

    function depositQueuedToVault() external isExpired onlyKeeper {
        _depositQueuedToVault();
    }

    function collectVaultFees() external isExpired onlyKeeper {
        _collectVaultFees();
    }

    /**
     * @notice Sets the parameters for the next option to be sold
     */
    function setOptionParameters() external isExpired onlyKeeper {
        _setOptionParameters();
    }

    /**
     * @notice Sets the start and end time of the auction.
     */
    function setAuctionPrices() external isExpired onlyKeeper {
        _setAuctionPrices();
    }

    /**
     * @notice Sets the start and end time of the auction.
     */
    function setAuctionWindow() external isExpired onlyKeeper {
        _setAuctionWindow();
    }
}
