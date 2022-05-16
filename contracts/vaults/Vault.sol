// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";

import "abdk-libraries-solidity/ABDKMath64x64.sol";

import "./../interfaces/IVault.sol";
import "./../interfaces/IWETH.sol";

import "./../libraries/Common.sol";
import "./../libraries/Constants.sol";
import "./../libraries/Errors.sol";
import "./../libraries/ShareMath.sol";
import "./../libraries/VaultDisplay.sol";
import "./../libraries/VaultLifecycle.sol";
import "./../libraries/VaultSchema.sol";

import "./VaultStorage.sol";

import "hardhat/console.sol";

contract Vault is
    ERC20Upgradeable,
    IVault,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    VaultStorage
{
    using SafeERC20 for IERC20;
    using SafeMath for uint256;
    using ShareMath for VaultSchema.DepositReceipt;
    using ABDKMath64x64 for int128;

    /************************************************
     *  IMMUTABLES
     ***********************************************/

    address public immutable weth;

    /************************************************
     *  CONSTRUCTOR
     ***********************************************/

    /**
     * @notice Initializes the contract with immutable variables
     * @param _weth is the Wrapped Ether contract
     */
    constructor(address _weth) {
        require(_weth != address(0), Errors.ADDRESS_NOT_PROVIDED);
        weth = _weth;
    }

    /************************************************
     *  INITIALIZATION
     ***********************************************/

    /**
     * @notice Initializes the vault contract with storage variables.
     */
    function initialize(
        VaultSchema.InitParams calldata _initParams,
        VaultSchema.VaultParams calldata _vaultParams
    ) external initializer {
        VaultLifecycle.verifyInitializerParams(
            _initParams._owner,
            _initParams._feeRecipient,
            _initParams._keeper,
            _initParams._strategy,
            _initParams._managementFee,
            _initParams._performanceFee,
            _initParams._tokenName,
            _initParams._tokenSymbol,
            _vaultParams
        );

        __ERC20_init(_initParams._tokenName, _initParams._tokenSymbol);
        __ReentrancyGuard_init();
        __Ownable_init();

        transferOwnership(_initParams._owner);

        keeper = _initParams._keeper;
        strategy = _initParams._strategy;

        feeRecipient = _initParams._feeRecipient;
        performanceFee = _initParams._performanceFee;

        managementFee = _initParams
            ._managementFee
            .mul(Constants.FEE_MULTIPLIER)
            .div(Constants.WEEKS_PER_YEAR);

        vaultParams = _vaultParams;
        vaultState.round = 1;
    }

    function sync(uint256 expiry) external onlyStrategy returns (address) {
        vaultState.expiry = expiry;
        return vaultParams.asset;
    }

    /************************************************
     *  MODIFIERS
     ***********************************************/

    /**
     * @dev Throws if called by any account other than the stratgey.
     */
    modifier onlyStrategy() {
        require(msg.sender == strategy, "unauthorized");
        _;
    }

    // function _sync() internal onlyStrategy {
    //     // return asset from Vault
    //     // Set Vault expiry
    //     // Sync other shared state variables
    // }

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
     *  SETTERS
     ***********************************************/

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
     * @notice Sets the new keeper
     * @param newKeeper is the address of the new keeper
     */
    function setKeeper(address newKeeper) external onlyOwner {
        require(newKeeper != address(0), Errors.ADDRESS_NOT_PROVIDED);
        require(newKeeper != keeper, Errors.NEW_ADDRESS_EQUALS_OLD);
        keeper = newKeeper;
    }

    /**
     * @notice Sets the new strategy
     * @param newStrategy is the address of the new strategy
     */
    function setStrategy(address newStrategy) external onlyOwner {
        require(newStrategy != address(0), Errors.ADDRESS_NOT_PROVIDED);
        require(newStrategy != strategy, Errors.NEW_ADDRESS_EQUALS_OLD);
        strategy = newStrategy;
    }

    /**
     * @notice Sets the management fee for the vault
     * @param newManagementFee is the management fee (6 decimals). ex: 2 * 10 ** 6 = 2%
     */
    function setManagementFee(uint256 newManagementFee) external onlyOwner {
        require(
            newManagementFee < 100 * Constants.FEE_MULTIPLIER,
            Errors.INVALID_FEE_AMOUNT
        );

        // We are dividing annualized management fee by num weeks in a year
        uint256 tmpManagementFee =
            newManagementFee.mul(Constants.FEE_MULTIPLIER).div(
                Constants.WEEKS_PER_YEAR
            );

        emit ManagementFeeSet(managementFee, newManagementFee);

        managementFee = tmpManagementFee;
    }

    /**
     * @notice Sets the performance fee for the vault
     * @param newPerformanceFee is the performance fee (6 decimals). ex: 20 * 10 ** 6 = 20%
     */
    function setPerformanceFee(uint256 newPerformanceFee) external onlyOwner {
        require(
            newPerformanceFee < 100 * Constants.FEE_MULTIPLIER,
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

    /************************************************
     *  DEPOSIT
     ***********************************************/

    /**
     * @notice Deposits ETH into the contract and mint vault shares. Reverts if the asset is not weth.
     */
    function depositETH() external payable nonReentrant whenNotPaused {
        require(vaultParams.asset == weth, Errors.INVALID_ASSET_ADDRESS);
        require(msg.value > 0, Errors.VALUE_EXCEEDS_MINIMUM);

        _depositFor(msg.value, msg.sender);

        IWETH(weth).deposit{value: msg.value}();
    }

    /**
     * @notice Deposits the `asset` from msg.sender.
     * @param amount is the amount of `asset` to deposit
     */
    function deposit(uint256 amount) external nonReentrant whenNotPaused {
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
        whenNotPaused
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
    function _depositFor(uint256 amount, address creditor)
        private
        whenNotPaused
    {
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

        VaultSchema.DepositReceipt memory depositReceipt =
            depositReceipts[creditor];

        // If we have an unprocessed pending deposit from the previous rounds, we have to process it.
        uint256 unredeemedShares =
            depositReceipt.getSharesFromReceipt(
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

        depositReceipts[creditor] = VaultSchema.DepositReceipt({
            round: uint16(currentRound),
            amount: uint104(depositAmount),
            unredeemedShares: uint128(unredeemedShares)
        });

        uint256 newQueuedDeposits =
            uint256(vaultState.queuedDeposits).add(amount);

        ShareMath.assertUint128(newQueuedDeposits);
        vaultState.queuedDeposits = uint128(newQueuedDeposits);
    }

    /************************************************
     *  WITHDRAWALS
     ***********************************************/

    /**
     * @notice Withdraws the assets on the vault using the outstanding `DepositReceipt.amount`
     * @param amount is the amount to withdraw
     */
    function withdrawInstantly(uint256 amount) external nonReentrant {
        VaultSchema.DepositReceipt storage depositReceipt =
            depositReceipts[msg.sender];

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

        Common.transferAsset(msg.sender, vaultParams.asset, weth, amount);
    }

    /**
     * @notice Initiates a withdrawal that can be processed once the round completes
     * @param numShares is the number of shares to withdraw
     */
    function initiateWithdraw(uint256 numShares) external nonReentrant {
        require(numShares > 0, Errors.VALUE_EXCEEDS_MINIMUM);

        // We do a max redeem before initiating a withdrawal. But we check if they must first have unredeemed shares.
        if (
            depositReceipts[msg.sender].amount > 0 ||
            depositReceipts[msg.sender].unredeemedShares > 0
        ) {
            _redeem(0, true);
        }

        // This caches the `round` variable used in lpShareBalances
        uint256 currentRound = vaultState.round;
        VaultSchema.Withdrawal storage withdrawal = withdrawals[msg.sender];

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

        uint256 newQueuedWithdrawShares =
            uint256(vaultState.queuedWithdrawShares).add(numShares);

        ShareMath.assertUint128(newQueuedWithdrawShares);
        vaultState.queuedWithdrawShares = uint128(newQueuedWithdrawShares);

        _transfer(msg.sender, address(this), numShares);
    }

    /**
     * @notice Completes a scheduled withdrawal from a past round. Uses finalized pps for the round
     */
    function completeWithdraw() external nonReentrant {
        VaultSchema.Withdrawal storage withdrawal = withdrawals[msg.sender];

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

        uint256 withdrawAmount =
            ShareMath.sharesToAsset(
                withdrawalShares,
                lpTokenPricePerShare[withdrawalRound],
                vaultParams.decimals
            );

        emit Withdraw(msg.sender, withdrawAmount, withdrawalShares);

        _burn(address(this), withdrawalShares);

        require(withdrawAmount > 0, Errors.WITHDRAWAL_AMOUNT_EXCEEDS_MINIMUM);

        Common.transferAsset(
            msg.sender,
            vaultParams.asset,
            weth,
            withdrawAmount
        );

        vaultState.queuedWithdrawals = uint128(
            uint256(vaultState.queuedWithdrawals).sub(withdrawAmount)
        );
    }

    /************************************************
     *  REDEMPTION
     ***********************************************/

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
        VaultSchema.DepositReceipt memory depositReceipt =
            depositReceipts[msg.sender];

        // This handles the null case when depositReceipt.round = 0 Because we start with round = 1 at `initialize`.
        uint256 currentRound = vaultState.round;

        uint256 unredeemedShares =
            depositReceipt.getSharesFromReceipt(
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

        // If we have a depositReceipt on the same round, BUT we have some
        // unredeemed shares we debit from the unredeemedShares, but leave
        // the amount field intact If the round has past, with no new
        // deposits, we just zero it out for new deposits.
        if (depositReceipt.round < currentRound) {
            depositReceipts[msg.sender].amount = 0;
        }

        ShareMath.assertUint128(numShares);
        depositReceipts[msg.sender].unredeemedShares = uint128(
            unredeemedShares.sub(numShares)
        );

        emit Redeem(msg.sender, numShares, depositReceipt.round);

        _transfer(address(this), msg.sender, numShares);
    }

    /************************************************
     *  BORROW
     ***********************************************/

    /*
     * @notice Transfers liquidity to strategy
     */
    function borrow(uint256 amount)
        external
        nonReentrant
        onlyStrategy
        whenNotPaused
    {
        uint256 totalFreeLiquidity =
            IERC20(vaultParams.asset)
                .balanceOf(address(this))
                .sub(vaultState.queuedDeposits)
                .sub(vaultState.queuedWithdrawals);

        require(totalFreeLiquidity >= amount, Errors.FREE_LIQUIDTY_EXCEEDED);

        IERC20(vaultParams.asset).safeTransferFrom(
            address(this),
            msg.sender,
            amount
        );

        vaultState.lockedCollateral += uint104(amount);
    }

    /************************************************
     *  OPERATIONS
     ***********************************************/

    /*
     * @notice Performs most administrative tasks such as setting minting new shares, calculating vault fees, etc.
     */
    function harvest(uint256 expiry) external {
        require(msg.sender == strategy || msg.sender == keeper, "unauthorized");

        require(expiry > vaultState.expiry, "Previous expiry > new expiry");

        require(
            block.timestamp >= vaultState.expiry,
            Errors.VAULT_ROUND_NOT_CLOSED
        );

        // After the vaults strategy harvests, the "lockedCollateral" will
        // be returned to the vault. Everything in the vault minus claims
        // and withdrawal amount is the free liquidity of the next round.

        address recipient = feeRecipient;
        uint256 queuedWithdrawals;
        uint256 newPricePerShare;
        uint256 mintShares;
        uint256 performanceFeeInAsset;
        uint256 managementFeeInAsset;
        uint256 totalVaultFee;

        {
            // Vault fees are calculated with queued withdrawals prior to calculating lockedAmount for current round.
            uint256 currentBalance =
                IERC20(vaultParams.asset).balanceOf(address(this));

            uint256 totalSupply = totalSupply();

            uint256 balanceForVaultFees =
                VaultLifecycle.getBalanceForVaultFees(
                    currentBalance,
                    totalSupply,
                    vaultParams.decimals,
                    vaultState.queuedDeposits,
                    vaultState.queuedWithdrawShares,
                    vaultState.queuedWithdrawals
                );

            (
                performanceFeeInAsset,
                managementFeeInAsset,
                totalVaultFee
            ) = VaultLifecycle.getVaultFees(
                balanceForVaultFees,
                vaultState.lastTotalCapital,
                vaultState.queuedDeposits,
                performanceFee,
                managementFee
            );

            // Take into account the fee so we can calculate the newPricePerShare
            currentBalance = currentBalance.sub(totalVaultFee);

            (queuedWithdrawals, newPricePerShare, mintShares) = VaultLifecycle
                .rollover(
                currentBalance,
                totalSupply,
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

            vaultState.round = uint16(nextRound);
            vaultState.expiry = expiry;

            vaultState.lockedCollateral = 0;
            vaultState.queuedDeposits = 0;
            vaultState.queuedWithdrawals = uint128(queuedWithdrawals);

            vaultState.lastTotalCapital = currentBalance.sub(queuedWithdrawals);
        }

        _mint(address(this), mintShares);

        if (totalVaultFee > 0) {
            Common.transferAsset(
                payable(recipient),
                vaultParams.asset,
                weth,
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
        // The total balance should include new deposits, premiums paid, free/locked liquidity, and withdrawals.
        return
            IERC20(vaultParams.asset).balanceOf(address(this)).add(
                vaultState.lockedCollateral
            );
    }

    function accountVaultBalance(address account)
        external
        view
        returns (uint256)
    {
        return
            VaultDisplay.accountVaultBalance(
                vaultState.round,
                vaultParams.decimals,
                balanceOf(account),
                vaultState.queuedDeposits,
                totalSupply(),
                totalBalance(),
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
                balanceOf(account),
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
            balanceOf(account),
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
                totalSupply(),
                totalBalance()
            );
    }

    // TODO: CALCULATE CORRECT STORAGE GAP SIZE

    // Gap is left to avoid storage collisions. Though Vault is not upgradeable, we add this as a safety measure.
    uint256[30] private ____gap;
}
