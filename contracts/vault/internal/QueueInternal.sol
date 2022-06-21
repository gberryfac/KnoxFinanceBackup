// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@solidstate/contracts/token/ERC1155/base/ERC1155BaseInternal.sol";
import "@solidstate/contracts/token/ERC1155/enumerable/ERC1155EnumerableInternal.sol";

import "./BaseInternal.sol";

abstract contract QueueInternal is
    BaseInternal,
    ERC1155BaseInternal,
    ERC1155EnumerableInternal
{
    using SafeERC20 for IERC20;
    using Storage for Storage.Layout;

    constructor(bool isCall, address pool) BaseInternal(isCall, pool) {}

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
            _totalAssets() + l.totalDeposits + amount;

        require(totalWithDepositedAmount <= l.cap, "vault cap exceeded");

        require(
            totalWithDepositedAmount >= l.minimumSupply,
            "deposit minimum not met"
        );

        l.totalDeposits += amount;

        // redeems shares from previous epochs
        _maxRedeemShares(l, receiver);
        _mint(receiver, l.claimTokenId, amount, "");

        // An approve() by the msg.sender is required beforehand
        ERC20.safeTransferFrom(msg.sender, address(this), amount);

        // Note: Index receiver
        // emit DepositedToQueue(receiver, amount, l.claimTokenId);
    }

    function _withdrawFromQueue(Storage.Layout storage l, uint256 amount)
        internal
    {
        require(l.totalDeposits - amount >= 0, "overdraft");
        l.totalDeposits -= amount;

        _burn(msg.sender, l.claimTokenId, amount);
        ERC20.safeTransfer(msg.sender, amount);
    }

    function _maxRedeemShares(Storage.Layout storage l, address receiver)
        internal
    {
        uint256[] memory claimTokenIds = _tokensByAccount(receiver);

        uint256 unredeemedShares;

        for (uint256 i; i < claimTokenIds.length; i++) {
            uint256 claimTokenId = claimTokenIds[i];

            unredeemedShares += _redeemSharesFromEpoch(
                l,
                claimTokenId,
                receiver
            );
        }

        IERC20(address(this)).safeTransfer(receiver, unredeemedShares);

        // Note: Index receiver
        // emit RedeemedShares(receiver, unredeemedShares, claimTokenId);
    }

    function _redeemSharesFromEpoch(
        Storage.Layout storage l,
        uint256 claimTokenId,
        address receiver
    ) internal returns (uint256) {
        if (claimTokenId < l.claimTokenId) {
            uint256 claimTokenBalance = _balanceOf(receiver, claimTokenId);
            _burn(receiver, claimTokenId, claimTokenBalance);

            return
                _previewUnredeemedSharesFromEpoch(
                    l,
                    uint256(claimTokenId),
                    claimTokenBalance
                );
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
        uint256[] memory claimTokenIds = _tokensByAccount(account);

        uint256 unredeemedShares;
        for (uint256 i; i < claimTokenIds.length; i++) {
            uint256 claimTokenId = claimTokenIds[i];
            uint256 claimTokenBalance = _balanceOf(account, claimTokenId);

            unredeemedShares += _previewUnredeemedSharesFromEpoch(
                l,
                claimTokenId,
                claimTokenBalance
            );
        }

        return unredeemedShares;
    }

    function _previewUnredeemedSharesFromEpoch(
        Storage.Layout storage l,
        uint256 claimTokenId,
        uint256 claimTokenBalance
    ) internal view returns (uint256) {
        if (claimTokenId < l.claimTokenId) {
            return (claimTokenBalance * l.pricePerShare[claimTokenId]) / 10**18;
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
