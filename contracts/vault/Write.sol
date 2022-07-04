// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@solidstate/contracts/utils/ReentrancyGuard.sol";

import "./internal/WriteInternal.sol";

contract Write is WriteInternal, ReentrancyGuard {
    using ABDKMath64x64 for int128;
    using ABDKMath64x64 for uint256;
    using SafeERC20 for IERC20;
    using Storage for Storage.Layout;

    constructor(bool isCall, address pool) WriteInternal(isCall, pool) {}

    /************************************************
     * PURCHASE
     ***********************************************/

    /**
     * @notice Initiates the option sale
     */
    // TODO: auctionActive
    function purchase(uint256 contractSize, uint256 maxCost)
        external
        nonReentrant
    {
        _purchase(contractSize);
    }
}
