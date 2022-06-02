// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@solidstate/contracts/token/ERC20/IERC20.sol";
import "@solidstate/contracts/token/ERC1155/ERC1155.sol";
import "@solidstate/contracts/utils/SafeERC20.sol";

import "./../libraries/Errors.sol";

import "./ERC4626.sol";
import "./VaultStorage.sol";

abstract contract QueueInternal is ERC1155, ERC4626 {
    using SafeERC20 for IERC20;
    using VaultStorage for VaultStorage.Layout;

    function _depositToQueue(uint256 amount, address receiver) internal {
        VaultStorage.Layout storage l = VaultStorage.layout();

        uint256 totalWithDepositedAmount =
            _totalAssets() + l.state.totalQueuedAssets + amount;

        require(
            totalWithDepositedAmount <= l.props.cap,
            Errors.VAULT_CAP_EXCEEDED
        );

        require(
            totalWithDepositedAmount >= l.props.minimumSupply,
            Errors.DEPOSIT_MINIMUM_NOT_MET
        );

        l.state.totalQueuedAssets += amount;

        // redeems shares from previous epochs
        _maxRedeemShares();

        _mint(receiver, l.state.epoch, amount, "");

        // Note: Index receiver
        // emit DepositedToQueue(receiver, amount, l.state.epoch);
    }

    // TODO:
    function _withdrawFromQueue() internal {}

    function _maxRedeemShares() internal {
        uint256[] memory epochs = tokensByAccount(msg.sender);

        uint256 unredeemedShares;
        for (uint256 i; i < epochs.length; i++) {
            uint256 epoch = epochs[i];
            unredeemedShares += _redeemSharesFromEpoch(epoch, msg.sender);
        }

        IERC20(address(this)).safeTransfer(msg.sender, unredeemedShares);

        // Note: Index msg.sender
        // emit RedeemedShares(msg.sender, unredeemedShares, epoch);
    }

    function _redeemSharesFromEpoch(uint256 epoch, address receiver)
        internal
        returns (uint256)
    {
        VaultStorage.Layout storage l = VaultStorage.layout();

        if (0 < epoch && epoch < l.state.epoch) {
            uint256 balance = _balanceOf(receiver, epoch);
            _burn(receiver, epoch, balance);
            return _previewUnredeemedSharesFromEpoch(uint256(epoch), balance);
        }

        return 0;
    }

    function _previewUnredeemedSharesFromEpoch(uint256 epoch, uint256 balance)
        internal
        view
        returns (uint256)
    {
        VaultStorage.Layout storage l = VaultStorage.layout();

        if (0 < epoch && epoch < l.state.epoch) {
            return (balance * l.pricePerShare[epoch]) / 10**18;
        }

        return 0;
    }
}
