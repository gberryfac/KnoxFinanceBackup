// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@solidstate/contracts/access/ownable/OwnableInternal.sol";
import "@solidstate/contracts/token/ERC4626/base/ERC4626BaseInternal.sol";

import "../libraries/ABDKMath64x64Token.sol";
import "../libraries/Helpers.sol";

import "../vendor/IPremiaPool.sol";

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
     *  INITIALIZE AUCTION
     ***********************************************/

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
        internal
        view
        returns (uint64)
    {
        return l.epoch > 0 ? l.epoch - 1 : 0;
    }

    function _lastOption(VaultStorage.Layout storage l)
        internal
        view
        returns (VaultStorage.Option memory)
    {
        return l.options[_lastEpoch(l)];
    }
}
