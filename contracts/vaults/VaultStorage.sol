// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@solidstate/contracts/token/ERC20/IERC20.sol";
import "@solidstate/contracts/token/ERC1155/IERC1155.sol";
import "@solidstate/contracts/utils/SafeERC20.sol";

import "./../interfaces/IPremiaPool.sol";

library VaultStorage {
    using SafeERC20 for IERC20;

    struct Option {
        // @notice Option type the vault is strategy
        bool isCall;
        // @notice Timestamp when the current option expires
        uint256 expiry;
        // @notice
        uint256 tokenId;
        // @notice Asset held in vault
        address asset;
    }

    struct State {
        // @notice
        uint256 epoch;
        // @notice
        uint256 totalQueuedAssets;
    }

    struct Props {
        // @notice
        uint8 decimals;
        // @notice
        uint64 minimumSupply;
        // @notice
        uint256 cap;
        // @notice
        uint256 managementFee;
        // @notice
        uint256 performanceFee;
    }

    struct Addresses {
        // @notice
        address keeper;
        // @notice
        address feeRecipient;
        // @notice
        address strategy;
    }

    struct InitParams {
        bool isCall;
        string name;
        string symbol;
        address asset;
        address pool;
    }

    struct Layout {
        mapping(uint256 => uint256) pricePerShare;
        Addresses addresses;
        Props props;
        State state;
        Option option;
        IPremiaPool Pool;
        IERC20 ERC20;
    }

    bytes32 internal constant STORAGE_SLOT =
        keccak256("knox.contracts.storage.Vault");

    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            l.slot := slot
        }
    }

    function _totalQueuedAssets() internal view returns (uint256) {
        VaultStorage.Layout storage l = VaultStorage.layout();
        return l.state.totalQueuedAssets;
    }

    function _epoch() internal view returns (uint256) {
        VaultStorage.Layout storage l = VaultStorage.layout();
        return l.state.epoch;
    }

    function _option() internal view returns (Option memory) {
        VaultStorage.Layout storage l = VaultStorage.layout();
        return l.option;
    }

    function _pricePerShare(uint256 epoch) internal view returns (uint256) {
        VaultStorage.Layout storage l = VaultStorage.layout();
        return l.pricePerShare[epoch];
    }

    function _balanceDisbursement(uint256 assetAmount, uint256 totalAssets)
        internal
        view
        returns (uint256, uint256)
    {
        IERC20 ERC20 = layout().ERC20;
        IPremiaPool Pool = layout().Pool;
        uint256 tokenId = layout().option.tokenId;

        uint256 vaultAssetRatio = ERC20.balanceOf(address(this)) / totalAssets;
        uint256 shortAssetRatio =
            Pool.balanceOf(address(this), tokenId) / totalAssets;

        uint256 vaultAssetAmount = assetAmount * vaultAssetRatio;
        uint256 shortAssetAmount = assetAmount * shortAssetRatio;

        return (vaultAssetAmount, shortAssetAmount);
    }

    function _safeTransferERC1155(address receiver, uint256 shortAssetAmount)
        internal
    {
        uint256 tokenId = layout().option.tokenId;
        IERC1155(address(this)).safeTransferFrom(
            address(this),
            receiver,
            tokenId,
            shortAssetAmount,
            ""
        );
    }
}
