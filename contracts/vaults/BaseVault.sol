// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "abdk-libraries-solidity/ABDKMath64x64.sol";

import "./../interfaces/IKnoxToken.sol";
import "./../interfaces/IRegistry.sol";
import "./../interfaces/IWETH.sol";

import "./../libraries/Errors.sol";
import "./../libraries/ShareMath.sol";
import "./../libraries/Vault.sol";
import "./../libraries/VaultDisplay.sol";
import "./../libraries/VaultLifecycle.sol";
import "./../libraries/VaultLogic.sol";

import "../KnoxToken.sol";

import "hardhat/console.sol";

contract BaseVault is OwnableUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;
    using ShareMath for Vault.DepositReceipt;
    using ABDKMath64x64 for int128;

    /************************************************
     *  NON UPGRADEABLE STORAGE
     ***********************************************/

    /// @notice Stores the user's pending deposit for the round
    mapping(address => Vault.DepositReceipt) public depositReceipts;

    /// @notice Stores pending user withdrawals
    mapping(address => Vault.Withdrawal) public withdrawals;

    /// @notice On every round's close, the pricePerShare value of an rTHETA token is stored
    /// This is used to determine the number of shares to be returned
    /// to a user with their DepositReceipt.depositAmount
    mapping(uint256 => uint256) public lpTokenPricePerShare;

    /// @notice Vault's parameters like cap, decimals
    Vault.VaultParams public vaultParams;

    /// @notice Vault's lifecycle state like round and locked amounts
    Vault.VaultState public vaultState;

    /// @notice Fee recipient for the performance and management fees
    address public feeRecipient;

    /// @notice role in charge of weekly vault operations such as rollover and burnRemainingOTokens
    // no access to critical vault changes
    address public keeper;

    /// @notice Performance fee charged on premiums earned in rollover. Only charged when there is no loss.
    uint256 public performanceFee;

    /// @notice Management fee charged on entire AUM in rollover. Only charged when there is no loss.
    uint256 public managementFee;

    // Gap is left to avoid storage collisions. Though RibbonVault is not upgradeable, we add this as a safety measure.
    uint256[30] private ____gap;

    // *IMPORTANT* NO NEW STORAGE VARIABLES SHOULD BE ADDED HERE
    // This is to prevent storage collisions. All storage variables should be appended to VaultStorage
    // Read this documentation to learn more:
    // https://docs.openzeppelin.com/upgrades-plugins/1.x/writing-upgradeable#modifying-your-contracts

    /************************************************
     *  IMMUTABLES & CONSTANTS
     ***********************************************/

    address public immutable WETH;
    address public immutable registry;
    address public token;

    // Number of weeks per year = 52.142857 weeks * FEE_MULTIPLIER = 52142857
    // Dividing by weeks per year requires doing num.mul(FEE_MULTIPLIER).div(WEEKS_PER_YEAR)
    uint256 private constant WEEKS_PER_YEAR = 52142857;

    /************************************************
     *  EVENTS
     ***********************************************/

    event Deposit(address indexed account, uint256 amount, uint256 round);

    event InitiateWithdraw(
        address indexed account,
        uint256 shares,
        uint256 round
    );

    event Redeem(address indexed account, uint256 share, uint256 round);

    event ManagementFeeSet(uint256 managementFee, uint256 newManagementFee);

    event PerformanceFeeSet(uint256 performanceFee, uint256 newPerformanceFee);

    event CapSet(uint256 oldCap, uint256 newCap);

    event Withdraw(address indexed account, uint256 amount, uint256 shares);

    event CollectVaultFees(
        uint256 performanceFee,
        uint256 vaultFee,
        uint256 round,
        address indexed feeRecipient
    );

    event InstantWithdraw(
        address indexed account,
        uint256 amount,
        uint256 round
    );

    /************************************************
     *  STRUCTS
     ***********************************************/

    /**
     * @notice Initialization parameters for the vault.
     * @param _owner is the owner of the vault with critical permissions
     * @param _feeRecipient is the address to recieve vault performance and management fees
     * @param _managementFee is the management fee pct.
     * @param _performanceFee is the perfomance fee pct.
     * @param _tokenName is the name of the token
     */
    struct InitParams {
        address _owner;
        address _keeper;
        address _feeRecipient;
        uint256 _managementFee;
        uint256 _performanceFee;
        string _tokenName;
    }

    /************************************************
     *  CONSTRUCTOR & INITIALIZATION
     ***********************************************/

    /**
     * @notice Initializes the contract with immutable variables
     * @param _weth is the Wrapped Ether contract
     */
    constructor(address _weth, address _registry) {
        require(_weth != address(0), Errors.ADDRESS_NOT_PROVIDED);
        require(_registry != address(0), Errors.ADDRESS_NOT_PROVIDED);

        WETH = _weth;
        registry = _registry;
    }

    /**
     * @notice Initializes the OptionVault contract with storage variables.
     */
    function initialize(
        InitParams calldata _initParams,
        Vault.VaultParams calldata _vaultParams
    ) external initializer {
        VaultLifecycle.verifyInitializerParams(
            _initParams._owner,
            _initParams._keeper,
            _initParams._feeRecipient,
            _initParams._managementFee,
            _initParams._performanceFee,
            _initParams._tokenName,
            _vaultParams
        );

        __ReentrancyGuard_init();
        __Ownable_init();
        transferOwnership(_initParams._owner);

        keeper = _initParams._keeper;

        feeRecipient = _initParams._feeRecipient;
        performanceFee = _initParams._performanceFee;

        managementFee = _initParams
            ._managementFee
            .mul(Vault.FEE_MULTIPLIER)
            .div(WEEKS_PER_YEAR);

        vaultParams = _vaultParams;

        vaultState.round = 1;
        vaultState.expiry = uint32(
            VaultLifecycle.getNextFriday(block.timestamp)
        );
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

    /**
     * @notice Sets the new fee recipient
     * @param newFeeRecipient is the address of the new fee recipient
     */
    function setFeeRecipient(address newFeeRecipient) external onlyOwner {
        require(newFeeRecipient != address(0), Errors.ADDRESS_NOT_PROVIDED);
        require(newFeeRecipient != feeRecipient, Errors.NEW_ADDRESS_EQUALS_OLD);
        feeRecipient = newFeeRecipient;
    }

    /**
     * @notice Sets the management fee for the vault
     * @param newManagementFee is the management fee (6 decimals). ex: 2 * 10 ** 6 = 2%
     */
    function setManagementFee(uint256 newManagementFee) external onlyOwner {
        require(
            newManagementFee < 100 * Vault.FEE_MULTIPLIER,
            Errors.INVALID_FEE_AMOUNT
        );

        // We are dividing annualized management fee by num weeks in a year
        uint256 tmpManagementFee = newManagementFee
            .mul(Vault.FEE_MULTIPLIER)
            .div(WEEKS_PER_YEAR);

        emit ManagementFeeSet(managementFee, newManagementFee);

        managementFee = tmpManagementFee;
    }

    /**
     * @notice Sets the performance fee for the vault
     * @param newPerformanceFee is the performance fee (6 decimals). ex: 20 * 10 ** 6 = 20%
     */
    function setPerformanceFee(uint256 newPerformanceFee) external onlyOwner {
        require(
            newPerformanceFee < 100 * Vault.FEE_MULTIPLIER,
            Errors.INVALID_FEE_AMOUNT
        );

        emit PerformanceFeeSet(performanceFee, newPerformanceFee);

        performanceFee = newPerformanceFee;
    }

    /**
     * @notice Sets a new cap for deposits
     * @param newCap is the new cap for deposits
     */
    function setCap(uint256 newCap) external onlyOwner {
        require(newCap > 0, Errors.VALUE_EXCEEDS_MINIMUM);
        ShareMath.assertUint104(newCap);
        emit CapSet(vaultParams.cap, newCap);
        vaultParams.cap = uint104(newCap);
    }

    /**
     * @notice
     * @param
     */
    function setTokenAddress(address newTokenAddress) external onlyOwner {
        require(newTokenAddress != address(0), Errors.ADDRESS_NOT_PROVIDED);
        require(newTokenAddress != token, Errors.NEW_ADDRESS_EQUALS_OLD);
        token = newTokenAddress;
    }

    // function setRegistry() external onlyOwner {}
    // function setExpiry() external onlyOwner {}

    /************************************************
     *  DEPOSIT & WITHDRAWALS
     ***********************************************/

    /**
     * @notice Deposits ETH into the contract and mint vault shares. Reverts if the asset is not WETH.
     */
    function depositETH() external payable nonReentrant {
        require(vaultParams.asset == WETH, Errors.INVALID_ASSET_ADDRESS);
        require(msg.value > 0, Errors.VALUE_EXCEEDS_MINIMUM);

        _depositFor(msg.value, msg.sender);

        IWETH(WETH).deposit{value: msg.value}();
    }

    /**
     * @notice Deposits the `asset` from msg.sender.
     * @param amount is the amount of `asset` to deposit
     */
    function deposit(uint256 amount) external nonReentrant {
        require(amount > 0, Errors.VALUE_EXCEEDS_MINIMUM);

        _depositFor(amount, msg.sender);

        // An approve() by the msg.sender is required beforehand
        IERC20(vaultParams.asset).safeTransferFrom(
            msg.sender,
            address(this),
            amount
        );
    }

    /**
     * @notice Deposits the `asset` from msg.sender added to `creditor`'s deposit.
     * @notice Used for vault -> vault deposits on the user's behalf
     * @param amount is the amount of `asset` to deposit
     * @param creditor is the address that can claim/withdraw deposited amount
     */
    function depositFor(uint256 amount, address creditor)
        external
        nonReentrant
    {
        require(amount > 0, Errors.VALUE_EXCEEDS_MINIMUM);
        require(creditor != address(0), Errors.ADDRESS_NOT_PROVIDED);

        _depositFor(amount, creditor);

        // An approve() by the msg.sender is required beforehand
        IERC20(vaultParams.asset).safeTransferFrom(
            msg.sender,
            address(this),
            amount
        );
    }

    /**
     * @notice Mints the vault shares to the creditor
     * @param amount is the amount of `asset` deposited
     * @param creditor is the address to receieve the deposit
     */
    function _depositFor(uint256 amount, address creditor) private {
        uint256 currentRound = vaultState.round;
        uint256 totalWithDepositedAmount = totalBalance().add(amount);

        require(
            totalWithDepositedAmount <= vaultParams.cap,
            Errors.VAULT_CAP_EXCEEDED
        );
        require(
            totalWithDepositedAmount >= vaultParams.minimumSupply,
            Errors.DEPOSIT_MINIMUM_NOT_MET
        );

        emit Deposit(creditor, amount, currentRound);

        Vault.DepositReceipt memory depositReceipt = depositReceipts[creditor];

        // If we have an unprocessed pending deposit from the previous rounds, we have to process it.
        uint256 unredeemedShares = depositReceipt.getSharesFromReceipt(
            currentRound,
            lpTokenPricePerShare[depositReceipt.round],
            vaultParams.decimals
        );

        uint256 depositAmount = amount;

        // If we have a pending deposit in the current round, we add on to the pending deposit
        if (currentRound == depositReceipt.round) {
            uint256 newAmount = uint256(depositReceipt.amount).add(amount);
            depositAmount = newAmount;
        }

        ShareMath.assertUint104(depositAmount);

        depositReceipts[creditor] = Vault.DepositReceipt({
            round: uint16(currentRound),
            amount: uint104(depositAmount),
            unredeemedShares: uint128(unredeemedShares)
        });

        uint256 newQueuedDeposits = uint256(vaultState.queuedDeposits).add(
            amount
        );

        ShareMath.assertUint128(newQueuedDeposits);
        vaultState.queuedDeposits = uint128(newQueuedDeposits);
    }

    /**
     * @notice Withdraws the assets on the vault using the outstanding `DepositReceipt.amount`
     * @param amount is the amount to withdraw
     */
    function withdrawInstantly(uint256 amount) external nonReentrant {
        Vault.DepositReceipt storage depositReceipt = depositReceipts[
            msg.sender
        ];

        uint256 currentRound = vaultState.round;
        require(amount > 0, Errors.VALUE_EXCEEDS_MINIMUM);

        require(
            depositReceipt.round == currentRound,
            Errors.INSTANT_WITHDRAWAL_ROUND_ENDED
        );

        uint256 receiptAmount = depositReceipt.amount;
        require(
            receiptAmount >= amount,
            Errors.WITHDRAWAL_AMOUNT_EXCEEDS_BALANCE
        );

        // Subtraction underflow checks already ensure it is smaller than uint104
        depositReceipt.amount = uint104(receiptAmount.sub(amount));
        vaultState.queuedDeposits = uint128(
            uint256(vaultState.queuedDeposits).sub(amount)
        );

        emit InstantWithdraw(msg.sender, amount, currentRound);

        VaultLogic.transferAsset(msg.sender, vaultParams.asset, WETH, amount);
    }

    /**
     * @notice Initiates a withdrawal that can be processed once the round completes
     * @param numShares is the number of shares to withdraw
     */
    function initiateWithdraw(uint256 numShares) external nonReentrant {
        require(numShares > 0, Errors.VALUE_EXCEEDS_MINIMUM);

        /* We do a max redeem before initiating a withdrawal. But we check if they must first have unredeemed shares */
        if (
            depositReceipts[msg.sender].amount > 0 ||
            depositReceipts[msg.sender].unredeemedShares > 0
        ) {
            _redeem(0, true);
        }

        // This caches the `round` variable used in lpShareBalances
        uint256 currentRound = vaultState.round;
        Vault.Withdrawal storage withdrawal = withdrawals[msg.sender];

        emit InitiateWithdraw(msg.sender, numShares, currentRound);

        uint256 existingShares = uint256(withdrawal.shares);

        uint256 withdrawalShares;
        if (withdrawal.round == currentRound) {
            withdrawalShares = existingShares.add(numShares);
        } else {
            require(
                existingShares == 0,
                Errors.INITIATED_WITHDRAWAL_INCOMPLETE
            );

            withdrawalShares = numShares;
            withdrawals[msg.sender].round = uint16(currentRound);
        }

        ShareMath.assertUint128(withdrawalShares);
        withdrawals[msg.sender].shares = uint128(withdrawalShares);

        uint256 newQueuedWithdrawShares = uint256(
            vaultState.queuedWithdrawShares
        ).add(numShares);

        ShareMath.assertUint128(newQueuedWithdrawShares);
        vaultState.queuedWithdrawShares = uint128(newQueuedWithdrawShares);

        // an setApprovalForAll() by the msg.sender is required beforehand
        IKnoxToken(token).safeTransferFrom(
            msg.sender,
            address(this),
            Vault.LP_TOKEN_ID,
            numShares,
            ""
        );
    }

    /**
     * @notice Completes a scheduled withdrawal from a past round. Uses finalized pps for the round
     */
    function completeWithdraw() external nonReentrant {
        Vault.Withdrawal storage withdrawal = withdrawals[msg.sender];

        uint256 withdrawalShares = withdrawal.shares;
        uint256 withdrawalRound = withdrawal.round;

        // This checks if there is a withdrawal
        require(withdrawalShares > 0, Errors.WITHDRAWAL_NOT_INITIATED);

        require(
            withdrawalRound < vaultState.round,
            Errors.VAULT_ROUND_NOT_CLOSED
        );

        // We leave the round number as non-zero to save on gas for subsequent writes
        withdrawals[msg.sender].shares = 0;
        vaultState.queuedWithdrawShares = uint128(
            uint256(vaultState.queuedWithdrawShares).sub(withdrawalShares)
        );

        uint256 withdrawAmount = ShareMath.sharesToAsset(
            withdrawalShares,
            lpTokenPricePerShare[withdrawalRound],
            vaultParams.decimals
        );

        emit Withdraw(msg.sender, withdrawAmount, withdrawalShares);

        IKnoxToken(token).burn(
            address(this),
            Vault.LP_TOKEN_ID,
            withdrawalShares
        );

        require(withdrawAmount > 0, Errors.WITHDRAWAL_AMOUNT_EXCEEDS_MINIMUM);

        VaultLogic.transferAsset(
            msg.sender,
            vaultParams.asset,
            WETH,
            withdrawAmount
        );

        vaultState.queuedWithdrawals = uint128(
            uint256(vaultState.queuedWithdrawals).sub(withdrawAmount)
        );
    }

    /**
     * @notice Redeems shares that are owed to the account
     * @param numShares is the number of shares to redeem
     */
    function redeem(uint256 numShares) external nonReentrant {
        require(numShares > 0, Errors.REDEEMED_SHARES_EXCEEDS_MINIMUM);
        _redeem(numShares, false);
    }

    /**
     * @notice Redeems the entire unredeemedShares balance that is owed to the account
     */
    function maxRedeem() external nonReentrant {
        _redeem(0, true);
    }

    /**
     * @notice Redeems shares that are owed to the account
     * @param numShares is the number of shares to redeem, could be 0 when isMax=true
     * @param isMax is flag for when callers do a max redemption
     */
    function _redeem(uint256 numShares, bool isMax) internal {
        Vault.DepositReceipt memory depositReceipt = depositReceipts[
            msg.sender
        ];

        /* This handles the null case when depositReceipt.round = 0 Because we start with round = 1 at `initialize` */
        uint256 currentRound = vaultState.round;

        uint256 unredeemedShares = depositReceipt.getSharesFromReceipt(
            currentRound,
            lpTokenPricePerShare[depositReceipt.round],
            vaultParams.decimals
        );

        numShares = isMax ? unredeemedShares : numShares;

        if (numShares == 0) {
            return;
        }

        require(
            numShares <= unredeemedShares,
            Errors.REDEEMED_SHARES_EXCEEDS_BALANCE
        );

        /* If we have a depositReceipt on the same round, BUT we have some unredeemed shares we debit from the unredeemedShares, but leave the amount field intact If the round has past, with no new deposits, we just zero it out for new deposits. */
        if (depositReceipt.round < currentRound) {
            depositReceipts[msg.sender].amount = 0;
        }

        ShareMath.assertUint128(numShares);
        depositReceipts[msg.sender].unredeemedShares = uint128(
            unredeemedShares.sub(numShares)
        );

        emit Redeem(msg.sender, numShares, depositReceipt.round);

        IKnoxToken(token).safeTransferFrom(
            address(this),
            msg.sender,
            Vault.LP_TOKEN_ID,
            numShares,
            ""
        );
    }

    /************************************************
     *  PURCHASE & CLAIM
     ***********************************************/

    // TODO: `purchaseETH`
    // function purchaseETH() public {}

    function _openPosition(
        bytes memory signature,
        uint64 deadline,
        uint64 maturity,
        int128 strike64x64,
        int128 premium64x64,
        uint256 contractSize,
        bool isCall
    ) internal returns (uint256 liquidityRequired) {
        {
            require(
                contractSize >= vaultParams.minimumContractSize,
                Errors.CONTRACT_SIZE_EXCEEDS_MINIMUM
            );

            uint256 value = strike64x64.mulu(contractSize);

            liquidityRequired = vaultParams.isCall
                ? contractSize
                : VaultLogic.toBaseDecimals(value, vaultParams);

            uint256 totalFreeLiquidity = IERC20(vaultParams.asset)
                .balanceOf(address(this))
                .sub(vaultState.queuedPayouts)
                .sub(vaultState.queuedDeposits)
                .sub(vaultState.queuedWithdrawals);

            require(
                totalFreeLiquidity >= liquidityRequired,
                Errors.FREE_LIQUIDTY_EXCEEDED
            );
        }

        require(
            IRegistry(registry).authenticate(
                signature,
                deadline,
                maturity,
                strike64x64,
                premium64x64,
                isCall
            ),
            Errors.INVALID_SIGNATURE
        );

        uint256 premiumAmount = premium64x64.mulu(contractSize);

        IERC20(vaultParams.asset).safeTransferFrom(
            msg.sender,
            address(this),
            premiumAmount
        );
    }

    /************************************************
     *  VAULT OPERATIONS
     ***********************************************/

    /*
     * @notice Performs most administrative tasks such as setting next option,
     * minting new shares, getting vault fees, etc.
     */
    function _rollover() internal {
        /* After the vaults strategy harvests, the "lockedCollateral" will be returned to the vault. Therefore everything in the vault minus payouts and withdrawal amount is the free liquidity of the next round. */

        address recipient = feeRecipient;
        uint256 queuedWithdrawals;
        uint256 newPricePerShare;
        uint256 mintShares;
        uint256 performanceFeeInAsset;
        uint256 totalVaultFee;

        {
            /* Vault fees are calculated with queued withdrawals prior to calculating lockedAmount for current round. */
            uint256 currentBalance = IERC20(vaultParams.asset).balanceOf(
                address(this)
            ) - vaultState.queuedPayouts;

            uint256 tokenSupply = IKnoxToken(token).totalSupply(
                Vault.LP_TOKEN_ID
            );

            uint256 balanceForVaultFees = VaultLifecycle.getBalanceForVaultFees(
                currentBalance,
                tokenSupply,
                vaultParams.decimals,
                vaultState.queuedDeposits,
                vaultState.queuedWithdrawShares,
                vaultState.queuedWithdrawals
            );

            (performanceFeeInAsset, , totalVaultFee) = VaultLifecycle
                .getVaultFees(
                    balanceForVaultFees,
                    vaultState.lockedCollateral,
                    vaultState.queuedDeposits,
                    performanceFee,
                    managementFee
                );

            // Take into account the fee so we can calculate the newPricePerShare
            currentBalance = currentBalance - totalVaultFee;

            (queuedWithdrawals, newPricePerShare, mintShares) = VaultLifecycle
                .rollover(
                    currentBalance,
                    tokenSupply,
                    vaultParams.decimals,
                    vaultState.queuedDeposits,
                    vaultState.queuedWithdrawShares
                );

            // Finalize the pricePerShare at the end of the round
            uint256 currentRound = vaultState.round;
            lpTokenPricePerShare[currentRound] = newPricePerShare;

            emit CollectVaultFees(
                performanceFeeInAsset,
                totalVaultFee,
                currentRound,
                recipient
            );

            uint256 nextRound = currentRound + 1;

            /* Writing `1` into the map makes subsequent writes warm, reducing the gas from 20k to 5k. Having 1 initialized beforehand will not be an issue as long as we round down share calculations to 0. */
            if (lpTokenPricePerShare[nextRound] == 0) {
                lpTokenPricePerShare[nextRound] = ShareMath.PLACEHOLDER_UINT;
            }

            vaultState.round = uint16(nextRound);

            vaultState.expiry = uint32(
                VaultLifecycle.getNextFriday(block.timestamp)
            );

            vaultState.lockedCollateral = 0;
            vaultState.queuedDeposits = 0;
            vaultState.queuedWithdrawals = uint128(queuedWithdrawals);
        }

        IKnoxToken(token).mint(
            address(this),
            Vault.LP_TOKEN_ID,
            mintShares,
            ""
        );

        if (totalVaultFee > 0) {
            VaultLogic.transferAsset(
                payable(recipient),
                vaultParams.asset,
                WETH,
                totalVaultFee
            );
        }
    }

    /************************************************
     *  GETTERS
     ***********************************************/

    /**
     * @notice Returns the vault's total balance, including the amounts locked into a short position
     * @return total balance of the vault, including the amounts locked in third party protocols
     */
    function totalBalance() public view returns (uint256) {
        /* The total balance should include new deposits, premiums paid, free/locked liquidity. It should not include the payout, and withdrawal amounts. */
        return
            IERC20(vaultParams.asset)
                .balanceOf(address(this))
                .add(vaultState.lockedCollateral)
                .sub(vaultState.queuedPayouts)
                .sub(vaultState.queuedWithdrawals);
    }

    /************************************************
     *  HELPERS
     ***********************************************/

    function accountVaultBalance(address account)
        external
        view
        returns (uint256)
    {
        return
            VaultDisplay.accountVaultBalance(
                vaultState.round,
                vaultParams.decimals,
                vaultState.queuedDeposits,
                totalBalance(),
                account,
                token,
                depositReceipts[account],
                lpTokenPricePerShare
            );
    }

    /**
     * @notice Getter for returning the account's share balance including unredeemed shares
     * @param account is the account to lookup share balance for
     * @return the share balance
     */
    function lpShares(address account) external view returns (uint256) {
        return
            VaultDisplay.lpShares(
                vaultState.round,
                vaultParams.decimals,
                account,
                token,
                depositReceipts[account],
                lpTokenPricePerShare
            );
    }

    /**
     * @notice Getter for returning the account's share balance split between account and vault holdings
     * @param account is the account to lookup share balance for
     * @return heldByAccount is the shares held by account
     * @return heldByVault is the shares held on the vault (unredeemedShares)
     */
    function lpShareBalances(address account)
        external
        view
        returns (uint256 heldByAccount, uint256 heldByVault)
    {
        (heldByAccount, heldByVault) = VaultDisplay.lpShareBalances(
            vaultState.round,
            vaultParams.decimals,
            account,
            token,
            depositReceipts[account],
            lpTokenPricePerShare
        );
    }

    /**
     * @notice The price of a unit of share denominated in the `asset`
     */
    function lpPricePerShare() external view returns (uint256) {
        return
            VaultDisplay.lpPricePerShare(
                vaultParams.decimals,
                vaultState.queuedDeposits,
                totalBalance(),
                token
            );
    }

    /**
     * @dev See {IERC1155Receiver-onERC1155Received}.
     */
    function onERC1155Received(
        address,
        address,
        uint256,
        uint256,
        bytes memory
    ) public virtual returns (bytes4) {
        return this.onERC1155Received.selector;
    }

    /**
     * @dev See {IERC1155Receiver-onERC1155BatchReceived}.
     */
    function onERC1155BatchReceived(
        address,
        address,
        uint256[] memory,
        uint256[] memory,
        bytes memory
    ) public virtual returns (bytes4) {
        return this.onERC1155BatchReceived.selector;
    }
}
