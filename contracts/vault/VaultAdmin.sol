// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./VaultInternal.sol";

contract VaultAdmin is IVaultAdmin, VaultInternal {
    using ABDKMath64x64 for int128;
    using Helpers for uint256;
    using SafeERC20 for IERC20;
    using VaultStorage for VaultStorage.Layout;

    int128 private constant ONE_64x64 = 0x10000000000000000;

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
        VaultStorage.Layout storage l = VaultStorage.layout();

        emit AuctionWindowOffsetsSet(
            l.epoch,
            l.startOffset,
            newStartOffset,
            l.endOffset,
            newEndOffset,
            msg.sender
        );

        l.startOffset = newStartOffset;
        l.endOffset = newEndOffset;
    }

    /**
     * @inheritdoc IVaultAdmin
     */
    function setDelta64x64(int128 newDelta64x64) external onlyOwner {
        VaultStorage.Layout storage l = VaultStorage.layout();

        // new option delta must be greater than 0
        require(newDelta64x64 > 0, "delta <= 0");
        // new option delta must be less than or equal to 1
        require(newDelta64x64 < ONE_64x64, "delta > 1");

        emit DeltaSet(l.epoch, l.delta64x64, newDelta64x64, msg.sender);

        // updates the storage
        l.delta64x64 = newDelta64x64;
    }

    /**
     * @inheritdoc IVaultAdmin
     */
    function setFeeRecipient(address newFeeRecipient) external onlyOwner {
        VaultStorage.Layout storage l = VaultStorage.layout();
        require(newFeeRecipient != address(0), "address not provided");
        require(newFeeRecipient != l.feeRecipient, "new address equals old");

        emit FeeRecipientSet(
            l.epoch,
            l.feeRecipient,
            newFeeRecipient,
            msg.sender
        );

        l.feeRecipient = newFeeRecipient;
    }

    /**
     * @inheritdoc IVaultAdmin
     */
    function setKeeper(address newKeeper) external onlyOwner {
        VaultStorage.Layout storage l = VaultStorage.layout();
        require(newKeeper != address(0), "address not provided");
        require(newKeeper != address(l.keeper), "new address equals old");

        emit KeeperSet(l.epoch, l.keeper, newKeeper, msg.sender);

        l.keeper = newKeeper;
    }

    /**
     * @inheritdoc IVaultAdmin
     */
    function setPricer(address newPricer) external onlyOwner {
        VaultStorage.Layout storage l = VaultStorage.layout();
        require(newPricer != address(0), "address not provided");
        require(newPricer != address(l.Pricer), "new address equals old");

        emit PricerSet(l.epoch, address(l.Pricer), newPricer, msg.sender);

        l.Pricer = IPricer(newPricer);
    }

    /**
     * @inheritdoc IVaultAdmin
     */
    function setPerformanceFee64x64(int128 newPerformanceFee64x64)
        external
        onlyOwner
    {
        VaultStorage.Layout storage l = VaultStorage.layout();
        require(newPerformanceFee64x64 < ONE_64x64, "fee > 1");

        emit PerformanceFeeSet(
            l.epoch,
            l.performanceFee64x64,
            newPerformanceFee64x64,
            msg.sender
        );

        l.performanceFee64x64 = newPerformanceFee64x64;
    }

    /**
     * @inheritdoc IVaultAdmin
     */
    function setWithdrawalFee64x64(int128 newWithdrawalFee64x64)
        external
        onlyOwner
    {
        VaultStorage.Layout storage l = VaultStorage.layout();
        require(newWithdrawalFee64x64 < ONE_64x64, "fee > 1");

        emit WithdrawalFeeSet(
            l.epoch,
            l.withdrawalFee64x64,
            newWithdrawalFee64x64,
            msg.sender
        );

        l.withdrawalFee64x64 = newWithdrawalFee64x64;
    }

    /************************************************
     *  INITIALIZE AUCTION
     ***********************************************/

    /**
     * @inheritdoc IVaultAdmin
     */
    function setAndInitializeAuction() external onlyKeeper {
        _setOptionParameters();
        _initializeAuction();
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
        _withdrawReservedLiquidity();
        _collectPerformanceFee();
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
        VaultStorage.Layout storage l = VaultStorage.layout();
        l.Queue.processDeposits();

        l.epoch = l.epoch + 1;
        l.Queue.syncEpoch(l.epoch);
    }

    /************************************************
     *  SET AUCTION PRICES
     ***********************************************/

    /**
     * @inheritdoc IVaultAdmin
     */
    function setAuctionPrices() external onlyKeeper {
        VaultStorage.Layout storage l = VaultStorage.layout();
        VaultStorage.Option storage option = l.options[l.epoch];

        // reverts if the strike price has not been set
        require(option.strike64x64 > 0, "delta strike unset");

        // calculates the delta strike price using the offset delta
        int128 offsetStrike64x64 =
            l.Pricer.getDeltaStrikePrice64x64(
                l.isCall,
                option.expiry,
                l.delta64x64.sub(l.deltaOffset64x64)
            );

        offsetStrike64x64 = l.Pricer.snapToGrid64x64(
            l.isCall,
            offsetStrike64x64
        );

        int128 spot64x64 = l.Pricer.latestAnswer64x64();
        int128 timeToMaturity64x64 =
            l.Pricer.getTimeToMaturity64x64(option.expiry);

        // calculates the auction max price
        int128 maxPrice64x64 =
            l.Pricer.getBlackScholesPrice64x64(
                spot64x64,
                option.strike64x64,
                timeToMaturity64x64,
                l.isCall
            );

        // calculates the auction min price
        int128 minPrice64x64 =
            l.Pricer.getBlackScholesPrice64x64(
                spot64x64,
                offsetStrike64x64,
                timeToMaturity64x64,
                l.isCall
            );

        if (l.isCall) {
            // denominates price in collateral asset
            maxPrice64x64 = maxPrice64x64.div(spot64x64);
            minPrice64x64 = minPrice64x64.div(spot64x64);
        }

        if (minPrice64x64 >= maxPrice64x64) {
            // cancels auction if the min price >= max price
            maxPrice64x64 = int128(0);
            minPrice64x64 = int128(0);
        }

        l.Auction.setAuctionPrices(l.epoch, maxPrice64x64, minPrice64x64);
    }

    /************************************************
     *  PROCESS AUCTION
     ***********************************************/

    /**
     * @inheritdoc IVaultAdmin
     */
    function processAuction() external onlyKeeper {
        VaultStorage.Layout storage l = VaultStorage.layout();

        l.lastTotalAssets = _totalAssets();

        uint64 lastEpoch = _lastEpoch(l);
        VaultStorage.Option memory lastOption = _lastOption(l);

        if (!l.Auction.isFinalized(lastEpoch)) {
            l.Auction.finalizeAuction(lastEpoch);
        }

        uint256 totalPremiums = l.Auction.transferPremium(lastEpoch);
        uint256 totalContractsSold = l.Auction.getTotalContractsSold(lastEpoch);

        uint256 totalCollateralUsed =
            totalContractsSold._fromContractsToCollateral(
                l.isCall,
                l.underlyingDecimals,
                l.baseDecimals,
                lastOption.strike64x64
            );

        ERC20.approve(address(Pool), totalCollateralUsed + _totalReserves());

        Pool.writeFrom(
            address(this),
            address(l.Auction),
            lastOption.expiry,
            lastOption.strike64x64,
            totalContractsSold,
            l.isCall
        );

        uint64 divestmentTimestamp = uint64(block.timestamp + 24 hours);
        Pool.setDivestmentTimestamp(divestmentTimestamp, l.isCall);

        l.Auction.processAuction(lastEpoch);

        emit AuctionProcessed(
            lastEpoch,
            totalCollateralUsed,
            _totalShortAsContracts(),
            totalPremiums
        );
    }
}
