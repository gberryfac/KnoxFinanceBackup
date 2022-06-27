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
     *  INPUT/OUTPUT
     ***********************************************/

    // TODO:
    function swapAndPreOrder() external auctionActive nonReentrant {}

    // TODO:
    function swapAndPurchase() external auctionActive nonReentrant {}

    // function preOrder(uint256 price, uint256 size)
    //     external
    //     auctionActive
    //     nonReentrant
    //     returns (uint256)
    // {
    // }

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
