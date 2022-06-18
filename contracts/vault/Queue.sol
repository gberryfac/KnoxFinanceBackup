// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@solidstate/contracts/token/ERC1155/base/ERC1155Base.sol";
import "@solidstate/contracts/token/ERC1155/enumerable/ERC1155Enumerable.sol";

import "@solidstate/contracts/introspection/ERC165Storage.sol";
import "@solidstate/contracts/introspection/IERC165.sol";
import "@solidstate/contracts/utils/ReentrancyGuard.sol";

import "./internal/QueueInternal.sol";

contract Queue is
    ERC1155Base,
    ERC1155Enumerable,
    QueueInternal,
    ReentrancyGuard
{
    using ERC165Storage for ERC165Storage.Layout;
    using SafeERC20 for IERC20;
    using Storage for Storage.Layout;

    constructor(bool isCall, address pool) QueueInternal(isCall, pool) {
        ERC165Storage.Layout storage l = ERC165Storage.layout();
        l.setSupportedInterface(type(IERC165).interfaceId, true);
        l.setSupportedInterface(type(IERC1155).interfaceId, true);
    }

    /************************************************
     *  INPUT/OUTPUT
     ***********************************************/

    function depositToQueue(uint256 amount) external nonReentrant {
        Storage.Layout storage l = Storage.layout();
        _depositToQueue(l, amount, msg.sender);
    }

    function depositToQueue(uint256 amount, address receiver)
        external
        nonReentrant
    {
        Storage.Layout storage l = Storage.layout();
        _depositToQueue(l, amount, receiver);
    }

    function withdrawFromQueue(uint256 amount) external nonReentrant {
        Storage.Layout storage l = Storage.layout();
        _withdrawFromQueue(l, amount);
    }

    function redeemSharesFromEpoch(uint256 epoch, address receiver)
        external
        nonReentrant
    {
        require(
            receiver == msg.sender || isApprovedForAll(receiver, msg.sender),
            "ERC1155: caller is not owner nor approved"
        );

        Storage.Layout storage l = Storage.layout();
        _redeemSharesFromEpoch(l, epoch, receiver);
    }

    function maxRedeemShares(address receiver) external nonReentrant {
        require(
            receiver == msg.sender || isApprovedForAll(receiver, msg.sender),
            "ERC1155: caller is not owner nor approved"
        );

        Storage.Layout storage l = Storage.layout();
        _maxRedeemShares(l, receiver);
    }

    /************************************************
     *  VIEW
     ***********************************************/

    function previewUnredeemedShares(address account)
        external
        view
        returns (uint256)
    {
        Storage.Layout storage l = Storage.layout();
        return _previewUnredeemedShares(l, account);
    }

    function previewUnredeemedSharesFromEpoch(uint256 epoch, uint256 balance)
        external
        view
        returns (uint256)
    {
        Storage.Layout storage l = Storage.layout();
        return _previewUnredeemedSharesFromEpoch(l, epoch, balance);
    }

    /************************************************
     *  ERC165 IMPLEMENTATIONS
     ***********************************************/

    function supportsInterface(bytes4 interfaceId)
        external
        view
        returns (bool)
    {
        return ERC165Storage.layout().isSupportedInterface(interfaceId);
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
        override(QueueInternal, ERC1155BaseInternal, ERC1155EnumerableInternal)
    {
        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
    }
}
