// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@solidstate/contracts/token/ERC1155/base/ERC1155Base.sol";
import "@solidstate/contracts/token/ERC1155/enumerable/ERC1155Enumerable.sol";

import "./BaseInternal.sol";

abstract contract QueueInternal is
    ERC1155Base,
    ERC1155Enumerable,
    BaseInternal
{
    using SafeERC20 for IERC20;
    using Storage for Storage.Layout;

    /************************************************
     *  INPUT/OUTPUT
     ***********************************************/

    function _depositToQueue(
        Storage.Layout storage l,
        uint256 amount,
        address receiver
    ) internal whenNotPaused {
        require(amount > 0, "value exceeds minimum");

        uint256 totalWithDepositedAmount =
            _totalAssets() + l.totalQueuedAssets + amount;

        require(totalWithDepositedAmount <= l.cap, "vault cap exceeded");

        require(
            totalWithDepositedAmount >= l.minimumSupply,
            "deposit minimum not met"
        );

        l.totalQueuedAssets += amount;

        // redeems shares from previous epochs
        _maxRedeemShares(l, receiver);
        _mint(receiver, l.epoch, amount, "");

        // An approve() by the msg.sender is required beforehand
        l.ERC20.safeTransferFrom(msg.sender, address(this), amount);

        // Note: Index receiver
        // emit DepositedToQueue(receiver, amount, l.epoch);
    }

    function _withdrawFromQueue(Storage.Layout storage l, uint256 amount)
        internal
    {
        require(l.totalQueuedAssets - amount >= 0, "overdraft");
        l.totalQueuedAssets -= amount;

        _burn(msg.sender, l.epoch, amount);
        l.ERC20.safeTransfer(msg.sender, amount);
    }

    function _maxRedeemShares(Storage.Layout storage l, address receiver)
        internal
    {
        require(
            receiver == msg.sender || isApprovedForAll(receiver, msg.sender),
            "ERC1155: caller is not owner nor approved"
        );

        uint256[] memory epochs = _tokensByAccount(receiver);

        uint256 unredeemedShares;

        for (uint256 i; i < epochs.length; i++) {
            uint256 epoch = epochs[i];
            unredeemedShares += _redeemSharesFromEpoch(l, epoch, receiver);
        }

        IERC20(address(this)).safeTransfer(receiver, unredeemedShares);

        // Note: Index receiver
        // emit RedeemedShares(receiver, unredeemedShares, epoch);
    }

    function _redeemSharesFromEpoch(
        Storage.Layout storage l,
        uint256 epoch,
        address receiver
    ) internal returns (uint256) {
        require(
            receiver == msg.sender || isApprovedForAll(receiver, msg.sender),
            "ERC1155: caller is not owner nor approved"
        );

        if (epoch < l.epoch) {
            uint256 balance = _balanceOf(receiver, epoch);
            _burn(receiver, epoch, balance);

            return
                _previewUnredeemedSharesFromEpoch(l, uint256(epoch), balance);
        }

        return 0;
    }

    /************************************************
     *  VIEW
     ***********************************************/

    function _previewUnredeemedShares(Storage.Layout storage l, address account)
        internal
        view
        returns (uint256)
    {
        uint256[] memory epochs = _tokensByAccount(account);

        uint256 unredeemedShares;
        for (uint256 i; i < epochs.length; i++) {
            uint256 epoch = epochs[i];
            uint256 balance = _balanceOf(account, epoch);

            unredeemedShares += _previewUnredeemedSharesFromEpoch(
                l,
                epoch,
                balance
            );
        }

        return unredeemedShares;
    }

    function _previewUnredeemedSharesFromEpoch(
        Storage.Layout storage l,
        uint256 epoch,
        uint256 balance
    ) internal view returns (uint256) {
        if (epoch < l.epoch) {
            return (balance * l.pricePerShare[epoch]) / 10**18;
        }

        return 0;
    }

    /************************************************
     *  ERC1155 OVERRIDES
     ***********************************************/

    function _beforeTokenTransfer(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    )
        internal
        virtual
        override(ERC1155BaseInternal, ERC1155EnumerableInternal)
    {
        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
    }
}
