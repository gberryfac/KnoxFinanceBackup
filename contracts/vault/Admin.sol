// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@solidstate/contracts/token/ERC20/metadata/ERC20MetadataStorage.sol";
import "@solidstate/contracts/token/ERC20/metadata/IERC20Metadata.sol";
import "@solidstate/contracts/token/ERC4626/base/ERC4626BaseStorage.sol";

import "./internal/AdminInternal.sol";

contract Admin is AdminInternal {
    using ERC20MetadataStorage for ERC20MetadataStorage.Layout;
    using ERC4626BaseStorage for ERC4626BaseStorage.Layout;
    using SafeERC20 for IERC20;
    using Storage for Storage.Layout;

    constructor(bool isCall, address pool) AdminInternal(isCall, pool) {}

    /************************************************
     *  INITIALIZATION
     ***********************************************/

    /**
     * @notice
     */
    // TODO: Rename initialize()
    function init(
        Storage.InitParams memory _initParams,
        Storage.InitProps memory _initProps
    ) external onlyOwner {
        // // TODO: Validation
        // require(_initProps.pricer != address(0), "address not provided");

        // require(
        //     _initParams.delta64x64 >= 0x00000000000000000,
        //     "Exceeds minimum allowable value"
        // );

        // require(
        //     _initParams.delta64x64 <= 0x010000000000000000,
        //     "Exceeds maximum allowable value"
        // );

        address asset;

        {
            Storage.Layout storage l = Storage.layout();
            PoolStorage.PoolSettings memory settings = Pool.getPoolSettings();

            l.isCall = _initParams.isCall;
            asset = l.isCall ? settings.underlying : settings.base;

            l.baseDecimals = IERC20Metadata(settings.base).decimals();
            l.underlyingDecimals = IERC20Metadata(settings.underlying)
                .decimals();

            l.minimumContractSize = _initParams.minimumContractSize;
            l.minimumSupply = _initProps.minimumSupply;

            l.delta64x64 = _initParams.delta64x64;
            l.cap = _initProps.cap;

            l.performanceFee = _initProps.performanceFee;
            l.withdrawalFee =
                (_initProps.withdrawalFee * Constants.FEE_MULTIPLIER) /
                Constants.WEEKS_PER_YEAR;

            l.keeper = _initProps.keeper;
            l.feeRecipient = _initProps.feeRecipient;

            l.Auction = IDutchAuction(_initProps.auction);
            l.Pricer = IPricer(_initProps.pricer);

            l.startOffset = 2 hours;
            l.endOffset = 4 hours;
        }

        {
            ERC20MetadataStorage.Layout storage l =
                ERC20MetadataStorage.layout();
            l.setName(_initProps.name);
            l.setSymbol(_initProps.symbol);
            l.setDecimals(18);
        }

        {
            ERC4626BaseStorage.Layout storage l = ERC4626BaseStorage.layout();
            l.asset = asset;
        }
    }

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

    // TODO:
    function setPricer(address newPricer) external onlyOwner {}

    /**
     * @notice Sets the performance fee for the vault
     * @param newPerformanceFee is the performance fee (6 decimals). ex: 20 * 10 ** 6 = 20%
     */
    function setPerformanceFee(uint256 newPerformanceFee) external onlyOwner {
        Storage._setPerformanceFee(newPerformanceFee);
    }

    /**
     * @notice Sets the withdrawal fee for the vault
     * @param newWithdrawalFee is the withdrawal fee (6 decimals). ex: 2 * 10 ** 6 = 2%
     */
    function setWithdrawalFee(uint256 newWithdrawalFee) external onlyOwner {
        Storage._setWithdrawalFee(newWithdrawalFee);
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
        onlyOwner
    {
        Storage._setAuctionWindowOffsets(start, end);
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
     * @notice
     */
    function setAuctionPrices() external onlyKeeper {
        _setAuctionPrices();
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
    function processEpoch(bool processExpired) external {
        _processEpoch(processExpired);
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

    function formatClaimTokenId(uint64 epoch) external view returns (uint256) {
        return _formatClaimTokenId(epoch);
    }

    // TODO:
    function parseClaimTokenId(uint256 claimTokenId)
        external
        view
        returns (uint64)
    {
        return _parseClaimTokenId(claimTokenId);
    }

    function getIntrinsicValue(uint64 epoch, uint256 size)
        external
        view
        returns (bool, uint256)
    {
        return _getIntrinsicValue(epoch, size);
    }
}
