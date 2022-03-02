// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./../storage/RibbonThetaVaultStorage.sol";
import "./../libraries/Vault.sol";
import "./../libraries/VaultLifecycle.sol";
import "./../libraries/ShareMath.sol";
import "./RibbonVault.sol";

/**
 * UPGRADEABILITY: Since we use the upgradeable proxy pattern, we must observe
 * the inheritance chain closely.
 * Any changes/appends in storage variable needs to happen in RibbonThetaVaultStorage.
 * RibbonThetaVault should not inherit from any other contract aside from RibbonVault, RibbonThetaVaultStorage
 */
contract RibbonThetaVault is RibbonVault, RibbonThetaVaultStorage {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;
    using ShareMath for Vault.DepositReceipt;

    /************************************************
     *  EVENTS
     ***********************************************/

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
     * @param _tokenSymbol is the symbol of the token
     */
    struct InitParams {
        address _owner;
        address _keeper;
        address _feeRecipient;
        uint256 _managementFee;
        uint256 _performanceFee;
        string _tokenName;
        string _tokenSymbol;
    }

    /************************************************
     *  CONSTRUCTOR & INITIALIZATION
     ***********************************************/

    /**
     * @notice Initializes the contract with immutable variables
     * @param _weth is the Wrapped Ether contract
     * @param _usdc is the USDC contract
     */
    constructor(address _weth, address _usdc) RibbonVault(_weth, _usdc) {}

    // TODO: ADD BACK INITIALIZER MODIFIER

    /**
     * @notice Initializes the OptionVault contract with storage variables.
     * @param _initParams is the struct with vault initialization parameters
     * @param _vaultParams is the struct with vault general data
     */
    function initialize(
        InitParams calldata _initParams,
        Vault.VaultParams calldata _vaultParams
    ) external {
        baseInitialize(
            _initParams._owner,
            _initParams._keeper,
            _initParams._feeRecipient,
            _initParams._managementFee,
            _initParams._performanceFee,
            _initParams._tokenName,
            _initParams._tokenSymbol,
            _vaultParams
        );
    }

    /************************************************
     *  VAULT OPERATIONS
     ***********************************************/

    /**
     * @notice Withdraws the assets on the vault using the outstanding `DepositReceipt.amount`
     * @param amount is the amount to withdraw
     */
    function withdrawInstantly(uint256 amount) external nonReentrant {
        Vault.DepositReceipt storage depositReceipt = depositReceipts[
            msg.sender
        ];

        uint256 currentRound = vaultState.round;
        require(amount > 0, "!amount");
        require(depositReceipt.round == currentRound, "Invalid round");

        uint256 receiptAmount = depositReceipt.amount;
        require(receiptAmount >= amount, "Exceed amount");

        // Subtraction underflow checks already ensure it is smaller than uint104
        depositReceipt.amount = uint104(receiptAmount.sub(amount));
        vaultState.totalPending = uint128(
            uint256(vaultState.totalPending).sub(amount)
        );

        emit InstantWithdraw(msg.sender, amount, currentRound);

        transferAsset(msg.sender, amount);
    }

    /**
     * @notice Completes a scheduled withdrawal from a past round. Uses finalized pps for the round
     */
    function completeWithdraw() external nonReentrant {
        uint256 withdrawAmount = _completeWithdraw();
        lastQueuedWithdrawAmount = uint128(
            uint256(lastQueuedWithdrawAmount).sub(withdrawAmount)
        );
    }

    /**
     * @notice Rolls the vault's funds into a new short position.
     */
    function rollover() external onlyKeeper nonReentrant {
        (uint256 lockedBalance, uint256 queuedWithdrawAmount) = _rollover(
            uint256(lastQueuedWithdrawAmount)
        );

        lastQueuedWithdrawAmount = queuedWithdrawAmount;

        ShareMath.assertUint104(lockedBalance);
        vaultState.lockedAmount = uint104(lockedBalance);
    }
}
