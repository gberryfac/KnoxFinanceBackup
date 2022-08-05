// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@solidstate/contracts/introspection/IERC165.sol";
import "@solidstate/contracts/token/ERC1155/IERC1155.sol";
import "@solidstate/contracts/token/ERC1155/enumerable/IERC1155Enumerable.sol";

import "./IQueueEvents.sol";

interface IQueue is IERC165, IERC1155, IERC1155Enumerable, IQueueEvents {
    /************************************************
     *  ADMIN
     ***********************************************/

    /**
     * @notice Sets a new max TVL for deposits
     * @param maxTVL is the new TVL limit for deposits
     */
    function setMaxTVL(uint256 maxTVL) external;

    /************************************************
     *  DEPOSIT
     ***********************************************/

    function deposit(uint256 amount) external;

    function deposit(uint256 amount, address receiver) external;

    /************************************************
     *  WITHDRAW
     ***********************************************/

    function withdraw(uint256 amount) external;

    /************************************************
     *  REDEEM
     ***********************************************/

    function redeem(uint256 tokenId) external;

    function redeem(uint256 tokenId, address receiver) external;

    function redeem(
        uint256 tokenId,
        address receiver,
        address owner
    ) external;

    function redeemMax() external;

    function redeemMax(address receiver) external;

    function redeemMax(address receiver, address owner) external;

    /************************************************
     *  PROCESS LAST EPOCH
     ***********************************************/

    function syncEpoch(uint64 epoch) external;

    function depositToVault() external;

    /************************************************
     *  VIEW
     ***********************************************/

    function previewUnredeemed(uint256 tokenId) external view returns (uint256);

    function previewUnredeemed(uint256 tokenId, address account)
        external
        view
        returns (uint256);

    function getCurrentTokenId() external view returns (uint256);

    function getEpoch() external view returns (uint64);

    function getMaxTVL() external view returns (uint256);

    function getPricePerShare(uint256 tokenId) external view returns (uint256);

    /************************************************
     * HELPERS
     ***********************************************/

    function formatClaimTokenId(uint64 epoch) external view returns (uint256);

    function parseClaimTokenId(uint256 tokenId)
        external
        pure
        returns (address, uint64);
}
