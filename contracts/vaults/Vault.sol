// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@solidstate/contracts/token/ERC20/metadata/ERC20MetadataStorage.sol";
import "@solidstate/contracts/token/ERC20/IERC20.sol";
import "@solidstate/contracts/token/ERC4626/base/ERC4626BaseStorage.sol";
import "@solidstate/contracts/utils/SafeERC20.sol";

import "./../libraries/Errors.sol";

import "./VaultInternal.sol";
import "./VaultStorage.sol";

import "hardhat/console.sol";

contract Vault is VaultInternal {
    using ERC20MetadataStorage for ERC20MetadataStorage.Layout;
    using ERC4626BaseStorage for ERC4626BaseStorage.Layout;
    using SafeERC20 for IERC20;
    using VaultStorage for VaultStorage.Layout;

    constructor(
        VaultStorage.InitParams memory _initParams,
        VaultStorage.Props memory _props,
        VaultStorage.Addresses memory _addresses
    ) ERC4626(_initParams.name, _initParams.symbol, _initParams.asset) {
        // TODO: Validate inputs

        VaultStorage.Layout storage l = VaultStorage.layout();

        // TODO: Remove l.props.decimals
        l.props.decimals = _props.decimals;
        l.props.minimumSupply = _props.minimumSupply;
        l.props.cap = _props.cap;

        l.props.managementFee = _props.managementFee;
        l.props.performanceFee = _props.performanceFee;

        l.state.epoch = 1;

        l.option.asset = _initParams.asset;
        l.option.isCall = _initParams.isCall;

        l.addresses.keeper = _addresses.keeper;
        l.addresses.feeRecipient = _addresses.feeRecipient;
        l.addresses.strategy = _addresses.strategy;

        l.Pool = IPremiaPool(_initParams.pool);
        l.ERC20 = IERC20(_initParams.asset);
    }

    // TODO: Inherit Timelock, Ownable, Reentrancy, Pausable protection
    // TODO: Add setters for addresses (strategy, feeRecipient, etc.)
    // NOTE: Setters should call to internal functions in VaultStorage

    function setNextRound(uint64 expiry, uint256 tokenId)
        external
        onlyAuthorized
    {
        VaultStorage.Layout storage l = VaultStorage.layout();

        require(expiry > l.option.expiry, "Previous expiry > new expiry");

        require(
            block.timestamp >= l.option.expiry,
            Errors.VAULT_ROUND_NOT_CLOSED
        );

        _setNextRound(expiry, tokenId);
    }

    function withdrawLiquidityFromPool() external onlyAuthorized {
        VaultStorage.Layout storage l = VaultStorage.layout();

        require(
            block.timestamp >= l.option.expiry,
            Errors.VAULT_ROUND_NOT_CLOSED
        );

        _withdrawLiquidityFromPool();
    }

    function depositQueuedToVault() external onlyAuthorized {
        VaultStorage.Layout storage l = VaultStorage.layout();

        require(
            block.timestamp >= l.option.expiry,
            Errors.VAULT_ROUND_NOT_CLOSED
        );

        _depositQueuedToVault();
    }

    // TODO:
    function borrow() external {}

    function totalQueuedAssets() external view returns (uint256) {
        return VaultStorage._totalQueuedAssets();
    }

    function epoch() external view returns (uint256) {
        return VaultStorage._epoch();
    }

    function option() external view returns (VaultStorage.Option memory) {
        return VaultStorage._option();
    }

    function pricePerShare(uint256 epoch) external view returns (uint256) {
        return VaultStorage._pricePerShare(epoch);
    }
}
