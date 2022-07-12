// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@solidstate/contracts/utils/ReentrancyGuard.sol";

import "abdk-libraries-solidity/ABDKMath64x64.sol";

import "./internal/AuctionInternal.sol";

contract Auction is AuctionInternal, ReentrancyGuard {
    using ABDKMath64x64 for int128;
    using ABDKMath64x64 for uint256;
    using SafeERC20 for IERC20;
    using Storage for Storage.Layout;

    constructor(bool isCall, address pool) AuctionInternal(isCall, pool) {}

    /************************************************
     *  INPUT/OUTPUT
     ***********************************************/

    // TODO:
    function swapAndPurchase() external auctionActive nonReentrant {}

    /**
     * @notice Initiates the option sale
     */
    function purchase(uint256 contractSize, uint256 maxCost)
        external
        auctionActive
        nonReentrant
    {
        _purchase(contractSize);
    }
}
