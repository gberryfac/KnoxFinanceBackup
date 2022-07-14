// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@solidstate/contracts/introspection/IERC165.sol";
import "@solidstate/contracts/token/ERC1155/IERC1155.sol";
import "@solidstate/contracts/token/ERC1155/enumerable/IERC1155Enumerable.sol";

interface IQueue is IERC165, IERC1155, IERC1155Enumerable {
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

    function redeemMaxShares() external;

    function redeemMaxShares(address receiver) external;

    function redeemShares(uint256 claimTokenId) external;

    function redeemShares(uint256 claimTokenId, address receiver) external;

    /************************************************
     *  PROCESS EPOCH
     ***********************************************/

    function syncEpoch(uint64 epoch) external;

    function depositToVault() external;

    /************************************************
     *  VIEW
     ***********************************************/

    function previewUnredeemedShares(address account)
        external
        view
        returns (uint256);

    function previewUnredeemedShares(uint256 claimTokenId, address account)
        external
        view
        returns (uint256);

    function epoch() external view returns (uint64);

    function maxTVL() external view returns (uint256);

    function pricePerShare(uint64 _epoch) external view returns (uint256);

    /************************************************
     * HELPERS
     ***********************************************/

    function formatClaimTokenId(uint64 _epoch) external view returns (uint256);

    function parseClaimTokenId(uint256 claimTokenId)
        external
        pure
        returns (address, uint64);
}
