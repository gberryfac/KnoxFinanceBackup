// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@solidstate/contracts/introspection/ERC165Storage.sol";
import "@solidstate/contracts/introspection/IERC165.sol";
import "@solidstate/contracts/token/ERC20/IERC20.sol";
import "@solidstate/contracts/token/ERC1155/IERC1155.sol";
import "@solidstate/contracts/utils/SafeERC20.sol";

import "./../libraries/Errors.sol";

import "./QueueInternal.sol";

abstract contract Queue is QueueInternal {
    using ERC165Storage for ERC165Storage.Layout;
    using SafeERC20 for IERC20;
    using VaultStorage for VaultStorage.Layout;

    constructor() {
        ERC165Storage.layout().setSupportedInterface(
            type(IERC165).interfaceId,
            true
        );
        ERC165Storage.layout().setSupportedInterface(
            type(IERC1155).interfaceId,
            true
        );
    }

    function depositToQueue(uint256 amount) external {
        VaultStorage.Layout storage l = VaultStorage.layout();

        require(amount > 0, Errors.VALUE_EXCEEDS_MINIMUM);

        _depositToQueue(amount, msg.sender);

        // An approve() by the msg.sender is required beforehand
        l.ERC20.safeTransferFrom(msg.sender, address(this), amount);
    }

    function depositToQueue(uint256 amount, address receiver) external {
        VaultStorage.Layout storage l = VaultStorage.layout();

        require(amount > 0, Errors.VALUE_EXCEEDS_MINIMUM);

        _depositToQueue(amount, receiver);

        // An approve() by the msg.sender is required beforehand
        l.ERC20.safeTransferFrom(msg.sender, address(this), amount);
    }

    function withdrawFromQueue() external {
        _withdrawFromQueue();
    }

    function maxRedeemShares() external {
        _maxRedeemShares();
    }

    function previewUnredeemedSharesFromEpoch(uint256 epoch, uint256 balance)
        external
        view
        returns (uint256)
    {
        return _previewUnredeemedSharesFromEpoch(epoch, balance);
    }

    function previewUnredeemedShares(address account)
        external
        view
        returns (uint256)
    {
        uint256[] memory epochs = tokensByAccount(account);

        uint256 unredeemedShares;
        for (uint256 i; i < epochs.length; i++) {
            uint256 epoch = epochs[i];
            uint256 balance = _balanceOf(account, epoch);

            unredeemedShares += _previewUnredeemedSharesFromEpoch(
                epoch,
                balance
            );
        }

        return unredeemedShares;
    }
}
