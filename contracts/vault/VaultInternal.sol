// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@solidstate/contracts/access/ownable/OwnableInternal.sol";
import "@solidstate/contracts/token/ERC4626/base/ERC4626BaseInternal.sol";

import "../interfaces/IPremiaPool.sol";

import "../libraries/ABDKMath64x64Token.sol";
import "../libraries/Helpers.sol";

import "./IVault.sol";
import "./IVaultEvents.sol";
import "./VaultStorage.sol";

contract VaultInternal is ERC4626BaseInternal, IVaultEvents, OwnableInternal {
    using ABDKMath64x64 for int128;
    using ABDKMath64x64 for uint256;
    using ABDKMath64x64Token for int128;
    using ABDKMath64x64Token for uint256;
    using Helpers for uint256;
    using SafeERC20 for IERC20;
    using VaultStorage for VaultStorage.Layout;

    int128 private constant ONE_64x64 = 0x10000000000000000;
    uint256 private constant UNDERLYING_RESERVED_LIQ_TOKEN_ID =
        0x0200000000000000000000000000000000000000000000000000000000000000;
    uint256 private constant BASE_RESERVED_LIQ_TOKEN_ID =
        0x0300000000000000000000000000000000000000000000000000000000000000;

    IERC20 public immutable ERC20;
    IPremiaPool public immutable Pool;

    constructor(bool isCall, address pool) {
        Pool = IPremiaPool(pool);
        IPremiaPool.PoolSettings memory settings = Pool.getPoolSettings();
        address asset = isCall ? settings.underlying : settings.base;
        ERC20 = IERC20(asset);
    }

    /************************************************
     *  ACCESS CONTROL
     ***********************************************/

    /**
     * @dev Throws if called by any account other than the keeper.
     */
    modifier onlyKeeper() {
        VaultStorage.Layout storage l = VaultStorage.layout();
        require(msg.sender == l.keeper, "!keeper");
        _;
    }

    /**
     * @dev Throws if called by any account other than the queue.
     */
    modifier onlyQueue() {
        VaultStorage.Layout storage l = VaultStorage.layout();
        require(msg.sender == address(l.Queue), "!queue");
        _;
    }

    /************************************************
     *  ADMIN
     ***********************************************/

    /**
     * @notice sets the auction window offsets
     * @param newStartOffset new start offset
     * @param newEndOffset new end offset
     */
    function _setAuctionWindowOffsets(
        uint16 newStartOffset,
        uint16 newEndOffset
    ) internal {
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
     * @notice sets the new fee recipient
     * @param newFeeRecipient address of the new fee recipient
     */
    function _setFeeRecipient(address newFeeRecipient) internal {
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
     * @notice sets the new keeper
     * @param newKeeper address of the new keeper
     */
    function _setKeeper(address newKeeper) internal {
        VaultStorage.Layout storage l = VaultStorage.layout();
        require(newKeeper != address(0), "address not provided");
        require(newKeeper != address(l.keeper), "new address equals old");

        emit KeeperSet(l.epoch, l.keeper, newKeeper, msg.sender);

        l.keeper = newKeeper;
    }

    /**
     * @notice sets the new pricer
     * @param newPricer address of the new pricer
     */
    function _setPricer(address newPricer) internal {
        VaultStorage.Layout storage l = VaultStorage.layout();
        require(newPricer != address(0), "address not provided");
        require(newPricer != address(l.Pricer), "new address equals old");

        emit PricerSet(l.epoch, address(l.Pricer), newPricer, msg.sender);

        l.Pricer = IPricer(newPricer);
    }

    /**
     * @notice sets the performance fee for the vault
     * @param newPerformanceFee64x64 performance fee as a 64x64 fixed point number
     */
    function _setPerformanceFee64x64(int128 newPerformanceFee64x64) internal {
        VaultStorage.Layout storage l = VaultStorage.layout();
        require(newPerformanceFee64x64 < ONE_64x64, "invalid fee amount");

        emit PerformanceFeeSet(
            l.epoch,
            l.performanceFee64x64,
            newPerformanceFee64x64,
            msg.sender
        );

        l.performanceFee64x64 = newPerformanceFee64x64;
    }

    /**
     * @notice sets the withdrawal fee for the vault
     * @param newWithdrawalFee64x64 withdrawal fee as a 64x64 fixed point number
     */
    function _setWithdrawalFee64x64(int128 newWithdrawalFee64x64) internal {
        VaultStorage.Layout storage l = VaultStorage.layout();
        require(newWithdrawalFee64x64 < ONE_64x64, "invalid fee amount");

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
     * @notice sets the option parameters and initializes auction
     */
    function _setAndInitializeAuction() internal {
        _setOptionParameters();
        _initializeAuction();
    }

    /**
     * @notice sets the parameters for the next option to be sold
     */
    function _setOptionParameters() internal {
        VaultStorage.Layout storage l = VaultStorage.layout();

        uint64 expiry = uint64(block.timestamp._getNextFriday());

        int128 strike64x64 =
            l.Pricer.getDeltaStrikePrice64x64(l.isCall, expiry, l.delta64x64);

        strike64x64 = l.Pricer.snapToGrid64x64(l.isCall, strike64x64);

        // Sets parameters for the next option
        VaultStorage.Option storage option = l.options[l.epoch];

        option.expiry = expiry;
        option.strike64x64 = strike64x64;

        TokenType longTokenType =
            l.isCall ? TokenType.LONG_CALL : TokenType.LONG_PUT;

        option.longTokenId = _formatTokenId(longTokenType, expiry, strike64x64);

        TokenType shortTokenType =
            l.isCall ? TokenType.SHORT_CALL : TokenType.SHORT_PUT;

        option.shortTokenId = _formatTokenId(
            shortTokenType,
            expiry,
            strike64x64
        );

        require(option.strike64x64 > 0, "invalid strike price");

        emit OptionParametersSet(
            l.epoch,
            option.expiry,
            option.strike64x64,
            option.longTokenId,
            option.shortTokenId
        );
    }

    /**
     * @notice initializes auction
     */
    function _initializeAuction() internal {
        VaultStorage.Layout storage l = VaultStorage.layout();
        VaultStorage.Option storage option = l.options[l.epoch];

        uint256 startTimestamp = Helpers._getFriday(block.timestamp);

        uint256 startTime = startTimestamp + l.startOffset;
        uint256 endTime = startTimestamp + l.endOffset;

        l.Auction.initialize(
            AuctionStorage.InitAuction(
                l.epoch,
                option.expiry,
                option.strike64x64,
                option.longTokenId,
                startTime,
                endTime
            )
        );
    }

    /************************************************
     *  PROCESS LAST EPOCH
     ***********************************************/

    /**
     * @notice withdraws reserved liquidity and collects performance fees
     */
    function _processLastEpoch() internal {
        _withdrawReservedLiquidity();
        _collectPerformanceFee();
    }

    /**
     * @notice transfers reserved liquidity from pool to vault
     */
    function _withdrawReservedLiquidity() internal {
        VaultStorage.Layout storage l = VaultStorage.layout();

        uint256 reservedLiquidity =
            Pool.balanceOf(
                address(this),
                l.isCall
                    ? UNDERLYING_RESERVED_LIQ_TOKEN_ID
                    : BASE_RESERVED_LIQ_TOKEN_ID
            );

        if (reservedLiquidity > 0) {
            Pool.withdraw(reservedLiquidity, l.isCall);
        }

        emit ReservedLiquidityWithdrawn(l.epoch, reservedLiquidity);
    }

    /**
     * @notice collects performance fees on epoch net income
     */
    function _collectPerformanceFee() internal {
        VaultStorage.Layout storage l = VaultStorage.layout();

        uint256 netIncome;
        uint256 feeInCollateral;

        uint256 totalAssets = _totalAssets() + l.totalWithdrawals;

        if (totalAssets > l.lastTotalAssets) {
            /**
             * Take performance fee ONLY if the vault returns a positive net income.
             * If the net income is negative, last week's option expired ITM past breakeven,
             * and the vault took a loss so we do not collect performance fee for last week.
             */
            netIncome = totalAssets - l.lastTotalAssets;
            feeInCollateral = l.performanceFee64x64.mulu(netIncome);
            ERC20.safeTransfer(l.feeRecipient, feeInCollateral);
        }

        l.totalWithdrawals = 0;

        emit PerformanceFeeCollected(_lastEpoch(l), netIncome, feeInCollateral);
    }

    /************************************************
     *  INITIALIZE NEXT EPOCH
     ***********************************************/

    /**
     * @notice initializes the next epoch
     */
    function _initializeNextEpoch() internal {
        VaultStorage.Layout storage l = VaultStorage.layout();
        l.Queue.processDeposits();

        l.epoch = l.epoch + 1;
        l.Queue.syncEpoch(l.epoch);
    }

    /************************************************
     *  SET AUCTION PRICES
     ***********************************************/

    /**
     * @notice calculates and sets the auction prices
     */
    function _setAuctionPrices() internal {
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
     * @notice processes the auction when it has been finalized
     */
    function _processAuction() internal {
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

    /************************************************
     *  VIEW
     ***********************************************/

    /**
     * @notice gets the total vault collateral
     * @return total vault collateral
     */
    function _totalCollateral() internal view returns (uint256) {
        return ERC20.balanceOf(address(this)) - _totalReserves();
    }

    /**
     * @notice gets the short position value denominated in the collateral asset
     * @return total short position in collateral amount
     */
    function _totalShortAsCollateral() internal view returns (uint256) {
        VaultStorage.Layout storage l = VaultStorage.layout();
        VaultStorage.Option memory lastOption = _lastOption(l);

        uint256 totalShortContracts = _totalShortAsContracts();

        return
            totalShortContracts._fromContractsToCollateral(
                l.isCall,
                l.underlyingDecimals,
                l.baseDecimals,
                lastOption.strike64x64
            );
    }

    /**
     * @notice gets the amount in short contracts underwitten by the vault in the last epoch
     * @return total short contracts
     */
    function _totalShortAsContracts() internal view returns (uint256) {
        VaultStorage.Layout storage l = VaultStorage.layout();
        uint256 shortTokenId = l.options[_lastEpoch(l)].shortTokenId;
        return Pool.balanceOf(address(this), shortTokenId);
    }

    /**
     * @notice gets the total reserved collateral
     * @return total reserved collateral
     */
    function _totalReserves() internal view returns (uint256) {
        VaultStorage.Layout storage l = VaultStorage.layout();
        return l.reserveRate64x64.mulu(ERC20.balanceOf(address(this)));
    }

    /************************************************
     *  ERC4626 OVERRIDES
     ***********************************************/

    /**
     * @notice get the total quantity of active collateral managed by the vault
     * @return total active collateral amount
     */
    function _totalAssets()
        internal
        view
        override(ERC4626BaseInternal)
        returns (uint256)
    {
        return
            _totalCollateral() + _totalShortAsCollateral() - _totalReserves();
    }

    /**
     * @notice execute a withdrawal of assets on behalf of given address
     * @dev owner must approve vault to redeem claim tokens
     * @dev this function may not be called while the auction is in progress
     * @param assetAmount quantity of assets to withdraw
     * @param receiver recipient of assets resulting from withdrawal
     * @param owner holder of shares to be redeemed
     * @return shareAmount quantity of shares to redeem
     */
    function _withdraw(
        uint256 assetAmount,
        address receiver,
        address owner
    ) internal virtual override(ERC4626BaseInternal) returns (uint256) {
        VaultStorage.Layout storage l = VaultStorage.layout();
        l.Queue.redeemMax(receiver, owner);

        require(
            assetAmount <= _maxWithdraw(owner),
            "ERC4626: maximum amount exceeded"
        );

        uint256 shareAmount = _previewWithdraw(assetAmount);

        _withdraw(msg.sender, receiver, owner, assetAmount, shareAmount);

        return shareAmount;
    }

    /**
     * @notice execute a redemption of shares on behalf of given address
     * @dev owner must approve vault to redeem claim tokens
     * @dev this function may not be called while the auction is in progress
     * @param shareAmount quantity of shares to redeem
     * @param receiver recipient of assets resulting from withdrawal
     * @param owner holder of shares to be redeemed
     * @return assetAmount quantity of assets to withdraw
     */
    function _redeem(
        uint256 shareAmount,
        address receiver,
        address owner
    ) internal virtual override(ERC4626BaseInternal) returns (uint256) {
        VaultStorage.Layout storage l = VaultStorage.layout();
        l.Queue.redeemMax(receiver, owner);

        require(
            shareAmount <= _maxRedeem(owner),
            "ERC4626: maximum amount exceeded"
        );

        uint256 assetAmount = _previewRedeem(shareAmount);

        _withdraw(msg.sender, receiver, owner, assetAmount, shareAmount);

        return assetAmount;
    }

    /**
     * @notice exchange shares for assets on behalf of given address
     * @param caller transaction operator for purposes of allowance verification
     * @param receiver recipient of assets resulting from withdrawal
     * @param owner holder of shares to be redeemed
     * @param assetAmount quantity of assets to withdraw
     * @param shareAmount quantity of shares to redeem
     */
    function _withdraw(
        address caller,
        address receiver,
        address owner,
        uint256 assetAmount,
        uint256 shareAmount
    ) private {
        VaultStorage.Layout storage l = VaultStorage.layout();

        require(l.epoch > 0, "cannot withdraw on epoch 0");

        if (caller != owner) {
            uint256 allowance = _allowance(owner, caller);

            require(
                allowance >= shareAmount,
                "ERC4626: share amount exceeds allowance"
            );

            unchecked {_approve(owner, caller, allowance - shareAmount);}
        }

        _beforeWithdraw(owner, assetAmount, shareAmount);

        _burn(owner, shareAmount);

        l.totalWithdrawals += assetAmount;

        // removes any reserved liquidty from pool in the event an option has been exercised
        _withdrawReservedLiquidity();

        (uint256 collateralAmount, uint256 shortContracts) =
            _calculateDistributions(l, assetAmount);

        (uint256 collateralAmountSansFee, uint256 shortContractsSansFee) =
            _collectWithdrawalFee(l, collateralAmount, shortContracts);

        VaultStorage.Option memory lastOption = _lastOption(l);

        _transferCollateralAndShortAssets(
            collateralAmountSansFee,
            shortContractsSansFee,
            lastOption.shortTokenId,
            receiver
        );

        emit Distributions(
            _lastEpoch(l),
            collateralAmountSansFee,
            shortContractsSansFee
        );

        emit Withdraw(caller, receiver, owner, assetAmount, shareAmount);
    }

    /************************************************
     *  HELPERS
     ***********************************************/

    function _calculateDistributions(
        VaultStorage.Layout storage l,
        uint256 distribution
    ) private view returns (uint256, uint256) {
        uint256 totalAssets = _totalAssets();

        uint256 collateralAmount =
            _calculateDistributionAmount(
                distribution,
                _totalCollateral(),
                totalAssets
            );

        VaultStorage.Option memory lastOption = _lastOption(l);

        // calculates the short position value denominated in the collateral asset
        uint256 totalShortContracts = _totalShortAsContracts();
        uint256 shortPositionValue =
            totalShortContracts._fromContractsToCollateral(
                l.isCall,
                l.underlyingDecimals,
                l.baseDecimals,
                lastOption.strike64x64
            );

        uint256 shortAsCollateral =
            _calculateDistributionAmount(
                distribution,
                shortPositionValue,
                totalAssets
            );

        // calculate the number of contracts that will be sent to the LP
        uint256 shortContracts =
            shortAsCollateral._fromCollateralToContracts(
                l.isCall,
                l.baseDecimals,
                lastOption.strike64x64
            );

        return (collateralAmount, shortContracts);
    }

    function _calculateDistributionAmount(
        uint256 distribution,
        uint256 assetAmount,
        uint256 totalAssets
    ) private pure returns (uint256) {
        int128 assetRatio64x64 =
            assetAmount > 0 ? assetAmount.divu(totalAssets) : int128(0);

        return assetRatio64x64 > 0 ? assetRatio64x64.mulu(distribution) : 0;
    }

    function _collectWithdrawalFee(
        VaultStorage.Layout storage l,
        uint256 collateralAmount,
        uint256 shortContracts
    ) private returns (uint256, uint256) {
        uint256 feeInCollateral = l.withdrawalFee64x64.mulu(collateralAmount);

        uint256 feesInShortContracts =
            l.withdrawalFee64x64.mulu(shortContracts);

        VaultStorage.Option memory lastOption = _lastOption(l);

        _transferCollateralAndShortAssets(
            feeInCollateral,
            feesInShortContracts,
            lastOption.shortTokenId,
            l.feeRecipient
        );

        emit WithdrawalFeeCollected(
            _lastEpoch(l),
            feeInCollateral,
            feesInShortContracts
        );

        return (
            collateralAmount - feeInCollateral,
            shortContracts - feesInShortContracts
        );
    }

    function _transferCollateralAndShortAssets(
        uint256 collateralAmount,
        uint256 shortContracts,
        uint256 shortTokenId,
        address receiver
    ) private {
        if (collateralAmount > 0) {
            ERC20.safeTransfer(receiver, collateralAmount);
        }

        if (shortContracts > 0) {
            Pool.safeTransferFrom(
                address(this),
                receiver,
                shortTokenId,
                shortContracts,
                ""
            );
        }
    }

    enum TokenType {
        UNDERLYING_FREE_LIQ,
        BASE_FREE_LIQ,
        UNDERLYING_RESERVED_LIQ,
        BASE_RESERVED_LIQ,
        LONG_CALL,
        SHORT_CALL,
        LONG_PUT,
        SHORT_PUT
    }

    function _formatTokenId(
        TokenType tokenType,
        uint64 maturity,
        int128 strike64x64
    ) private pure returns (uint256 tokenId) {
        tokenId =
            (uint256(tokenType) << 248) +
            (uint256(maturity) << 128) +
            uint256(int256(strike64x64));
    }

    function _lastEpoch(VaultStorage.Layout storage l)
        private
        view
        returns (uint64)
    {
        return l.epoch > 0 ? l.epoch - 1 : 0;
    }

    function _lastOption(VaultStorage.Layout storage l)
        private
        view
        returns (VaultStorage.Option memory)
    {
        return l.options[_lastEpoch(l)];
    }
}
