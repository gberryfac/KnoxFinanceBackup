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
     * @notice sets a new max TVL for deposits
     * @param newMaxTVL is the new TVL limit for deposits
     */
    function setMaxTVL(uint256 newMaxTVL) external;

    /************************************************
     *  DEPOSIT
     ***********************************************/

    /**
     * @notice deposits collateral asset
     * @dev sender must approve contract
     * @param amount total collateral deposited
     */
    function deposit(uint256 amount) external;

    /**
     * @notice deposits collateral asset
     * @dev sender must approve contract
     * @param amount total collateral deposited
     * @param receiver claim token recipient
     */
    function deposit(uint256 amount, address receiver) external;

    /************************************************
     *  CANCEL
     ***********************************************/

    /**
     * @notice cancels deposit, refunds collateral asset
     * @dev cancellation must be made within the same epoch as the deposit
     * @param amount total collateral which will be withdrawn
     */
    function cancel(uint256 amount) external;

    /************************************************
     *  REDEEM
     ***********************************************/

    /**
     * @notice exchanges claim token for vault shares
     * @param tokenId claim token id
     */
    function redeem(uint256 tokenId) external;

    /**
     * @notice exchanges claim token for vault shares
     * @param tokenId claim token id
     * @param receiver vault share recipient
     */
    function redeem(uint256 tokenId, address receiver) external;

    /**
     * @notice exchanges claim token for vault shares
     * @param tokenId claim token id
     * @param receiver vault share recipient
     * @param owner claim token holder
     */
    function redeem(
        uint256 tokenId,
        address receiver,
        address owner
    ) external;

    /**
     * @notice exchanges all claim tokens for vault shares
     */
    function redeemMax() external;

    /**
     * @notice exchanges all claim tokens for vault shares
     * @param receiver vault share recipient
     */
    function redeemMax(address receiver) external;

    /**
     * @notice exchanges all claim tokens for vault shares
     * @param receiver vault share recipient
     * @param owner claim token holder
     */
    function redeemMax(address receiver, address owner) external;

    /************************************************
     *  INITIALIZE NEXT EPOCH
     ***********************************************/

    /**
     * @notice syncs queue epoch with vault epoch
     * @param epoch current epoch of vault
     */
    function syncEpoch(uint64 epoch) external;

    /**
     * @notice transfers deposited collateral to vault, calculates the price per share
     */
    function processDeposits() external;

    /************************************************
     *  VIEW
     ***********************************************/

    /**
     * @notice gets current claim token id
     * @return claim token id
     */
    function getCurrentTokenId() external view returns (uint256);

    /**
     * @notice gets current epoch of the queue
     * @return epoch id
     */
    function getEpoch() external view returns (uint64);

    /**
     * @notice gets max total value locked of the vault
     * @return max total value
     */
    function getMaxTVL() external view returns (uint256);

    /**
     * @notice gets price per share for a given claim token id
     * @param tokenId claim token id
     * @return price per share
     */
    function getPricePerShare(uint256 tokenId) external view returns (uint256);

    /**
     * @notice calculates unredeemed vault shares available
     * @param tokenId claim token id
     * @return total unredeemed vault shares
     */
    function previewUnredeemed(uint256 tokenId) external view returns (uint256);

    /**
     * @notice calculates unredeemed vault shares available
     * @param tokenId claim token id
     * @param account claim token holder
     * @return total unredeemed vault shares
     */
    function previewUnredeemed(uint256 tokenId, address account)
        external
        view
        returns (uint256);

    /************************************************
     * HELPERS
     ***********************************************/

    /**
     * @notice calculates claim token id for a given epoch
     * @param epoch weekly interval id
     * @return claim token id
     */
    function formatClaimTokenId(uint64 epoch) external view returns (uint256);

    /**
     * @notice derives queue address and epoch from claim token id
     * @param tokenId claim token id
     * @return address of queue
     * @return epoch id
     */
    function parseClaimTokenId(uint256 tokenId)
        external
        pure
        returns (address, uint64);
}
