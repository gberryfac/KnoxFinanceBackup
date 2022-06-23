// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@solidstate/contracts/token/ERC1155/IERC1155.sol";
import "@solidstate/contracts/token/ERC1155/enumerable/IERC1155Enumerable.sol";

interface IQueue is IERC1155, IERC1155Enumerable {
    function depositToQueue(uint256 amount) external;

    function depositToQueue(uint256 amount, address receiver) external;

    function withdrawFromQueue(uint256 amount) external;

    function maxRedeemShares(address receiver) external;

    function previewUnredeemedSharesFromEpoch(uint64 epoch, uint256 balance)
        external
        view
        returns (uint256);

    function previewUnredeemedShares(address account)
        external
        view
        returns (uint256);

    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}
