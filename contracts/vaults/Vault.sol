// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@solidstate/contracts/token/ERC20/metadata/ERC20MetadataStorage.sol";
import "@solidstate/contracts/token/ERC20/IERC20.sol";
import "@solidstate/contracts/token/ERC4626/base/ERC4626BaseStorage.sol";
import "@solidstate/contracts/utils/SafeERC20.sol";

import "./../libraries/Constants.sol";
import "./../libraries/Errors.sol";

import "./internal/VaultInternal.sol";

import "hardhat/console.sol";

contract Vault is VaultInternal {
    using ERC20MetadataStorage for ERC20MetadataStorage.Layout;
    using ERC4626BaseStorage for ERC4626BaseStorage.Layout;
    using SafeERC20 for IERC20;

    /************************************************
     *  INITIALIZATION
     ***********************************************/

    function initializeVault(
        Storage.InitParams memory _initParams,
        Storage.InitProps memory _initProps,
        address _keeper,
        address _feeRecipient,
        address _strategy
    ) external onlyOwner {
        {
            Storage.Layout storage l = Storage.layout();

            l.minimumSupply = _initProps.minimumSupply;
            l.cap = _initProps.cap;

            l.performanceFee = _initProps.performanceFee;
            l.managementFee =
                (_initProps.managementFee * Constants.FEE_MULTIPLIER) /
                Constants.WEEKS_PER_YEAR;

            l.asset = _initParams.asset;
            l.isCall = _initParams.isCall;

            l.keeper = _keeper;
            l.feeRecipient = _feeRecipient;
            l.strategy = _strategy;

            l.Pool = IPremiaPool(_initParams.pool);
            l.ERC20 = IERC20(_initParams.asset);
        }

        {
            ERC20MetadataStorage.Layout storage l =
                ERC20MetadataStorage.layout();

            l.setName(_initParams.name);
            l.setSymbol(_initParams.symbol);
            l.setDecimals(18);
        }

        {
            ERC4626BaseStorage.Layout storage l = ERC4626BaseStorage.layout();
            l.asset = _initParams.asset;
        }
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

    /**
     * @notice Sets the new strategy
     * @param newStrategy is the address of the new strategy
     */
    function setStrategy(address newStrategy) external onlyOwner {
        Storage._setStrategy(newStrategy);
    }

    /**
     * @notice Sets the management fee for the vault
     * @param newManagementFee is the management fee (6 decimals). ex: 2 * 10 ** 6 = 2%
     */
    function setManagementFee(uint256 newManagementFee) external onlyOwner {
        Storage._setManagementFee(newManagementFee);
    }

    /**
     * @notice Sets the performance fee for the vault
     * @param newPerformanceFee is the performance fee (6 decimals). ex: 20 * 10 ** 6 = 20%
     */
    function setPerformanceFee(uint256 newPerformanceFee) external onlyOwner {
        Storage._setPerformanceFee(newPerformanceFee);
    }

    /**
     * @notice Sets a new cap for deposits
     * @param newCap is the new cap for deposits
     */
    function setCap(uint256 newCap) external onlyOwner {
        Storage._setCap(newCap);
    }

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
     *  OPERATIONS
     ***********************************************/

    function processEpoch(uint64 expiry, uint256 tokenId)
        external
        isExpired
        onlyAuthorized
    {
        Storage.Layout storage l = Storage.layout();
        _processEpoch(l, expiry, tokenId);
    }

    function withdrawReservedLiquidity() external isExpired onlyAuthorized {
        Storage.Layout storage l = Storage.layout();
        _withdrawReservedLiquidity(l);
    }

    function depositQueuedToVault() external isExpired onlyAuthorized {
        Storage.Layout storage l = Storage.layout();
        _depositQueuedToVault(l);
    }

    function collectVaultFees() external isExpired onlyAuthorized {
        Storage.Layout storage l = Storage.layout();
        _collectVaultFees(l);
    }

    function borrow(uint256 amount) external onlyStrategy {
        Storage.Layout storage l = Storage.layout();
        _borrow(l, amount);
    }

    /************************************************
     *  VIEW
     ***********************************************/

    function totalQueuedAssets() external view returns (uint256) {
        return Storage._totalQueuedAssets();
    }

    function epoch() external view returns (uint256) {
        return Storage._epoch();
    }

    function pricePerShare(uint256 epoch) external view returns (uint256) {
        return Storage._pricePerShare(epoch);
    }

    function option()
        external
        view
        returns (
            bool,
            uint256,
            uint256,
            address
        )
    {
        return Storage._option();
    }
}
