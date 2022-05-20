// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "abdk-libraries-solidity/ABDKMath64x64.sol";

import {IPremiaPool, PoolStorage} from "./../interfaces/IPremiaPool.sol";
import "./../interfaces/IStandardDelta.sol";
import "./../interfaces/IStandardDeltaPricer.sol";

import "./../libraries/Common.sol";
import "./../libraries/Constants.sol";
import "./../libraries/Errors.sol";

import "./StandardDelta/StandardDeltaStorage.sol";

import "hardhat/console.sol";

contract StandardDelta is
    IStandardDelta,
    Ownable,
    StandardDeltaStorage,
    ReentrancyGuard
{
    using SafeERC20 for IERC20;
    using ABDKMath64x64 for int128;
    using ABDKMath64x64 for uint256;

    /************************************************
     *  INITIALIZATION
     ***********************************************/

    /**
     * @notice Initializes the vault contract with storage variables.
     * @dev Vault contracts must be deployed and initialized.
     */
    function initialize(
        bool _isCall,
        uint8 _baseDecimals,
        uint8 _underlyingDecimals,
        uint64 _minimumContractSize,
        int128 _delta64x64,
        address _keeper,
        address _pool,
        address _pricer,
        address _vault
    ) external isInitialized onlyOwner {
        require(_keeper != address(0), Errors.ADDRESS_NOT_PROVIDED);
        require(_pool != address(0), Errors.ADDRESS_NOT_PROVIDED);

        require(_pricer != address(0), Errors.ADDRESS_NOT_PROVIDED);
        require(_vault != address(0), Errors.ADDRESS_NOT_PROVIDED);

        require(
            _delta64x64 >= 0x00000000000000000,
            "Exceeds minimum allowable value"
        );

        require(
            _delta64x64 <= 0x010000000000000000,
            "Exceeds maximum allowable value"
        );

        option.isCall = _isCall;
        option.minimumContractSize = _minimumContractSize;
        option.delta64x64 = _delta64x64;

        assetProperties.baseDecimals = _baseDecimals;
        assetProperties.underlyingDecimals = _underlyingDecimals;

        keeper = _keeper;
        Vault = IVault(_vault);

        Pool = IPremiaPool(_pool);
        Pricer = IStandardDeltaPricer(_pricer);

        _sync();

        startOffset = 2 hours;
        endOffset = 4 hours;

        _setSaleWindow();
        _setNextOption();

        initialized = true;
    }

    function sync() external onlyKeeper {
        _sync();
    }

    function _sync() internal {
        address asset = Vault.sync(option.expiry);
        Asset = IERC20(asset);
    }

    /************************************************
     *  MODIFIERS
     ***********************************************/

    /**
     * @dev Throws if contract has been initialized.
     */
    modifier isInitialized() {
        require(initialized == false, "initialized");
        _;
    }

    /**
     * @dev Throws if called prior to option expiration.
     */
    modifier isExpired() {
        require(block.timestamp >= option.expiry, "Option has not expired!");
        _;
    }

    /**
     * @dev Throws if purchase window is not active.
     */
    modifier isActive() {
        require(saleWindow[0] <= block.timestamp, "Sale has not started!");
        require(saleWindow[1] >= block.timestamp, "Sale has ended!");
        _;
    }

    /**
     * @dev Throws if called by any account other than the keeper.
     */
    modifier onlyKeeper() {
        require(msg.sender == keeper, Errors.ADDRESS_NOT_KEEPER);
        _;
    }

    /************************************************
     *  SETTERS
     ***********************************************/

    /**
     * @notice Sets the new keeper
     * @param newKeeper is the address of the new keeper
     */
    function setNewKeeper(address newKeeper) external onlyOwner {
        require(newKeeper != address(0), Errors.ADDRESS_NOT_PROVIDED);
        keeper = newKeeper;
    }

    /************************************************
     *  QUOTE
     ***********************************************/

    // TODO: function quote() external {}

    /************************************************
     *  PURCHASE
     ***********************************************/

    /**
     * @notice Initiates the option sale
     */
    function purchase(uint256 contractSize, uint256 maxCost)
        external
        isActive
        nonReentrant
    {
        require(
            contractSize >= option.minimumContractSize,
            Errors.CONTRACT_SIZE_EXCEEDS_MINIMUM
        );

        // TODO: query price curve to get premium

        // TODO: require(premium <= maxCost, "slippage too high!");

        // TODO: Asset.safeTransferFrom(
        //     msg.sender,
        //     address(Vault),
        //     premium.mulu(contractSize)
        // );

        _purchase(contractSize);
    }

    function _purchase(uint256 contractSize) internal {
        uint256 amount =
            option.isCall
                ? contractSize
                : _fromUnderlyingtoBaseDecimals(
                    option.strike64x64.mulu(contractSize),
                    assetProperties
                );

        Vault.borrow(amount);
        Asset.approve(address(Pool), amount);

        Pool.writeFrom(
            address(this),
            msg.sender,
            option.expiry,
            option.strike64x64,
            contractSize,
            option.isCall
        );

        Pool.setDivestmentTimestamp(option.expiry, option.isCall);

        emit Purchased(msg.sender, contractSize);
    }

    /************************************************
     *  EXERCISE
     ***********************************************/

    /**
     * @notice Exercises In-The-Money options
     */
    function exercise(
        address holder,
        uint256 longTokenId,
        uint256 contractSize
    ) external nonReentrant {
        _exercise(holder, longTokenId, contractSize);
    }

    function _exercise(
        address holder,
        uint256 longTokenId,
        uint256 contractSize
    ) internal {
        Pool.exerciseFrom(holder, longTokenId, contractSize);
    }

    /************************************************
     *  OPERATIONS
     ***********************************************/

    /**
     * @notice Prepares the strategy and initiates the next round of option sales
     */
    function setNextSale(bool process)
        external
        isExpired
        nonReentrant
        onlyKeeper
    {
        if (process) _processExpired();
        _withdrawAndRepay();
        _setSaleWindow();
        _setNextOption();
    }

    /**
     * @notice Processes expired options
     */
    function processExpired() external isExpired nonReentrant onlyKeeper {
        _processExpired();
    }

    /**
     * @notice Removes liquidity from option pool, returns borrowed funds to vault
     */
    function withdrawAndRepay() external isExpired nonReentrant onlyKeeper {
        _withdrawAndRepay();
    }

    /**
     * @notice Sets a range of times in which a purchase can be completed
     */
    function setSaleWindow(uint16 start, uint16 end)
        external
        isExpired
        onlyKeeper
    {
        startOffset = start;
        endOffset = end;

        _setSaleWindow();
    }

    /**
     * @notice Sets the parameters for the next option to be sold
     */
    function setNextOption() external isExpired onlyKeeper {
        _setNextOption();
    }

    function _processExpired() internal {
        uint256[] memory tokenIds = Pool.tokensByAccount(address(this));

        for (uint256 i; i < tokenIds.length; i++) {
            if (
                tokenIds[i] != Constants.UNDERLYING_RESERVED_LIQ_TOKEN_ID &&
                tokenIds[i] != Constants.BASE_RESERVED_LIQ_TOKEN_ID
            ) {
                uint256 tokenBalance =
                    Pool.balanceOf(address(this), tokenIds[i]);

                if (tokenBalance >= option.minimumContractSize) {
                    Pool.processExpired(tokenIds[i], tokenBalance);
                }
            }
        }
    }

    function _withdrawAndRepay() internal {
        uint256 reservedLiquidity =
            Pool.balanceOf(
                address(this),
                option.isCall
                    ? Constants.UNDERLYING_RESERVED_LIQ_TOKEN_ID
                    : Constants.BASE_RESERVED_LIQ_TOKEN_ID
            );

        Pool.withdraw(reservedLiquidity, option.isCall);

        uint256 balance = Asset.balanceOf(address(this));
        Asset.safeTransfer(address(Vault), balance);

        emit Repaid(address(Vault), balance);
    }

    function _setSaleWindow() internal {
        uint256 startTimestamp = block.timestamp;

        saleWindow[0] = startTimestamp + startOffset;
        saleWindow[1] = startTimestamp + endOffset;

        emit SaleWindowSet(startTimestamp, saleWindow[0], saleWindow[1]);
    }

    function _setNextOption() internal {
        option.expiry = _getNextFriday();

        option.strike64x64 = Pricer.getDeltaStrikePrice64x64(
            option.isCall,
            option.expiry,
            option.delta64x64
        );

        option.strike64x64 = Pricer.snapToGrid(option.strike64x64);
        require(option.strike64x64 > 0, "invalid strike price");

        emit NextOptionSet(option.isCall, option.expiry, option.strike64x64);
    }

    /************************************************
     * GETTERS
     ***********************************************/

    function accountsByToken(uint256 id)
        external
        view
        returns (address[] memory)
    {
        return Pool.accountsByToken(id);
    }

    function tokensByAccount(address account)
        external
        view
        returns (uint256[] memory)
    {
        return Pool.tokensByAccount(account);
    }

    /************************************************
     * HELPERS
     ***********************************************/

    function _getNextFriday() internal view returns (uint64) {
        return uint64(Common.getNextFriday(block.timestamp));
    }

    /**
     * @notice adjusts precision of value to base decimals
     * @param value is the amount denominated in the underlying asset decimals
     * @param assetProperties is a struct containing the underlying and asset decimals
     */
    function _fromUnderlyingtoBaseDecimals(
        uint256 value,
        StandardDeltaSchema.AssetProperties memory assetProperties
    ) internal pure returns (uint256) {
        int128 value64x64 = value.divu(10**assetProperties.underlyingDecimals);
        return value64x64.mulu(10**assetProperties.baseDecimals);
    }
}
