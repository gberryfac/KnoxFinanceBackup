// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./VaultInternal.sol";

contract VaultAdmin is IVaultAdmin, VaultInternal {
    using SafeERC20 for IERC20;
    using VaultStorage for VaultStorage.Layout;

    constructor(bool isCall, address pool) VaultInternal(isCall, pool) {}

    /************************************************
     *  INITIALIZATION
     ***********************************************/

    /**
     * @inheritdoc IVaultAdmin
     */
    function initialize(VaultStorage.InitImpl memory initImpl)
        external
        onlyOwner
    {
        require(initImpl.auction != address(0), "address not provided");
        require(initImpl.queue != address(0), "address not provided");
        require(initImpl.pricer != address(0), "address not provided");

        VaultStorage.Layout storage l = VaultStorage.layout();
        l.Auction = IAuction(initImpl.auction);
        l.Queue = IQueue(initImpl.queue);
        l.Pricer = IPricer(initImpl.pricer);
    }

    /************************************************
     *  ADMIN
     ***********************************************/

    /**
     * @inheritdoc IVaultAdmin
     */
    function setAuctionWindowOffsets(uint16 newStartOffset, uint16 newEndOffset)
        external
        onlyOwner
    {
        _setAuctionWindowOffsets(newStartOffset, newEndOffset);
    }

    /**
     * @inheritdoc IVaultAdmin
     */
    function setFeeRecipient(address newFeeRecipient) external onlyOwner {
        _setFeeRecipient(newFeeRecipient);
    }

    /**
     * @inheritdoc IVaultAdmin
     */
    function setKeeper(address newKeeper) external onlyOwner {
        _setKeeper(newKeeper);
    }

    /**
     * @inheritdoc IVaultAdmin
     */
    function setPricer(address newPricer) external onlyOwner {
        _setPricer(newPricer);
    }

    /**
     * @inheritdoc IVaultAdmin
     */
    function setPerformanceFee64x64(int128 newPerformanceFee64x64)
        external
        onlyOwner
    {
        _setPerformanceFee64x64(newPerformanceFee64x64);
    }

    /**
     * @inheritdoc IVaultAdmin
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
     * @inheritdoc IVaultAdmin
     */
    function setAndInitializeAuction() external onlyKeeper {
        _setAndInitializeAuction();
    }

    /**
     * @inheritdoc IVaultAdmin
     */
    function setOptionParameters() external onlyKeeper {
        _setOptionParameters();
    }

    /**
     * @inheritdoc IVaultAdmin
     */
    function initializeAuction() external onlyKeeper {
        _initializeAuction();
    }

    /************************************************
     *  PROCESS LAST EPOCH
     ***********************************************/

    /**
     * @inheritdoc IVaultAdmin
     */
    function processLastEpoch() external onlyKeeper {
        _processLastEpoch();
    }

    /**
     * @inheritdoc IVaultAdmin
     */
    function withdrawReservedLiquidity() external onlyKeeper {
        _withdrawReservedLiquidity();
    }

    /**
     * @inheritdoc IVaultAdmin
     */
    function collectPerformanceFee() external onlyKeeper {
        _collectPerformanceFee();
    }

    /************************************************
     *  INITIALIZE NEXT EPOCH
     ***********************************************/

    /**
     * @inheritdoc IVaultAdmin
     */
    function initializeNextEpoch() external onlyKeeper {
        _initializeNextEpoch();
    }

    /************************************************
     *  SET AUCTION PRICES
     ***********************************************/

    /**
     * @inheritdoc IVaultAdmin
     */
    function setAuctionPrices() external onlyKeeper {
        _setAuctionPrices();
    }

    /************************************************
     *  PROCESS AUCTION
     ***********************************************/

    /**
     * @inheritdoc IVaultAdmin
     */
    function processAuction() external onlyKeeper {
        _processAuction();
    }

    /************************************************
     * HELPERS
     ***********************************************/

    /**
     * @inheritdoc IVaultAdmin
     */
    function getExerciseAmount(uint64 epoch, uint256 size)
        external
        view
        returns (bool, uint256)
    {
        return _getExerciseAmount(epoch, size);
    }
}
