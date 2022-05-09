// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "abdk-libraries-solidity/ABDKMath64x64.sol";

import "./../interfaces/IPremiaPool.sol";
import "./../interfaces/IStandardDelta.sol";

import "./../libraries/Common.sol";
import "./../libraries/Constants.sol";
import "./../libraries/Errors.sol";

import "./StandardDelta/Storage.sol";

import "hardhat/console.sol";

contract StandardDelta is IStandardDelta, Ownable, Storage, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using ABDKMath64x64 for int128;

    /************************************************
     *  CONSTRUCTOR
     ***********************************************/

    constructor(
        bool _isCall,
        uint8 _baseDecimals,
        uint8 _underlyingDecimals,
        uint64 _minimumContractSize,
        address _asset,
        address _pool
    ) {
        require(_asset != address(0), Errors.ADDRESS_NOT_PROVIDED);
        require(_pool != address(0), Errors.ADDRESS_NOT_PROVIDED);

        option.isCall = _isCall;
        option.minimumContractSize = _minimumContractSize;

        assetProperties.baseDecimals = _baseDecimals;
        assetProperties.underlyingDecimals = _underlyingDecimals;

        Asset = IERC20(_asset);
        Pool = IPremiaPool(_pool);
    }

    /************************************************
     *  INITIALIZATION
     ***********************************************/

    function initialize(address _keeper, address _vault)
        external
        isInitialized
        onlyOwner
    {
        require(_keeper != address(0), Errors.ADDRESS_NOT_PROVIDED);
        require(_vault != address(0), Errors.ADDRESS_NOT_PROVIDED);

        startOffset = 2 hours;
        endOffset = 4 hours;

        _setSaleWindow();
        _setNextOption();

        keeper = _keeper;
        Vault = IVault(_vault);

        initialized = true;
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

    function purchase(uint256 contractSize) external isActive nonReentrant {
        require(
            contractSize >= option.minimumContractSize,
            Errors.CONTRACT_SIZE_EXCEEDS_MINIMUM
        );

        _purchase(contractSize);

        // TODO: query price curve to get Premium

        // Asset.safeTransferFrom(
        //     msg.sender,
        //     address(Vault),
        //     premium64x64.mulu(contractSize)
        // );
    }

    function _purchase(uint256 contractSize) internal {
        uint256 liquidityRequired = option.isCall
            ? contractSize
            : _fromUnderlyingtoBaseDecimals(
                option.strike64x64.mulu(contractSize),
                assetProperties
            );

        Vault.borrow(address(Asset), liquidityRequired);
        Asset.approve(address(Pool), liquidityRequired);

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

    function setNextSale() external isExpired nonReentrant onlyKeeper {
        _withdrawAndRepay();
        _setSaleWindow();
        _setNextOption();
    }

    function withdrawAndRepay() external isExpired nonReentrant onlyKeeper {
        _withdrawAndRepay();
    }

    function setSaleWindow(uint16 start, uint16 end)
        external
        isExpired
        onlyKeeper
    {
        startOffset = start;
        endOffset = end;

        _setSaleWindow();
    }

    function _withdrawAndRepay() internal {
        // TODO: Check that options have been processed

        uint256 reservedLiquidity = Pool.balanceOf(
            address(this),
            option.isCall
                ? Constants.UNDERLYING_RESERVED_LIQ_TOKEN_ID
                : Constants.BASE_RESERVED_LIQ_TOKEN_ID
        );

        Pool.withdraw(reservedLiquidity, option.isCall);

        uint256 balance = Asset.balanceOf(address(this));
        Asset.safeTransferFrom(address(this), address(Vault), balance);

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

        // TODO: Set next option strike price

        emit OptionSet(option.isCall, option.expiry, option.strike64x64);
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
        Schema.AssetProperties memory assetProperties
    ) internal pure returns (uint256) {
        int128 value64x64 = ABDKMath64x64.divu(
            value,
            10**assetProperties.underlyingDecimals
        );

        return value64x64.mulu(10**assetProperties.baseDecimals);
    }
}
