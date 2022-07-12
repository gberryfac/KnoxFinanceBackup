// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@solidstate/contracts/utils/ReentrancyGuard.sol";

import "./VaultInternal.sol";

contract VaultWrite is VaultInternal, ReentrancyGuard {
    constructor(bool isCall, address pool) VaultInternal(isCall, pool) {}

    /************************************************
     * PURCHASE
     ***********************************************/

    /**
     * @notice Initiates the option sale
     */
    // TODO:
    // TODO: auctionActive
    function purchase(uint256 contractSize, uint256 maxCost)
        external
        nonReentrant
    {
        _purchase(contractSize);
    }
}
