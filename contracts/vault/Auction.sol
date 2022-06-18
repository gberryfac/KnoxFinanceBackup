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

    /**
     * @notice Initiates the option sale
     */
    function purchase(uint256 contractSize, uint256 maxCost)
        external
        AuctionActive
        nonReentrant
    {
        _purchase(contractSize);
    }

    /**
     * @notice Exercises In-The-Money options
     */
    function exercise(
        address holder,
        uint256 longTokenId,
        uint256 contractSize
    ) external nonReentrant {
        _exercise(holder, longTokenId, contractSize);
    }

    /************************************************
     * VIEW
     ***********************************************/

    function accountsByOption(uint256 id)
        external
        view
        returns (address[] memory)
    {
        Storage.Layout storage l = Storage.layout();
        return Pool.accountsByToken(id);
    }

    function optionsByAccount(address account)
        external
        view
        returns (uint256[] memory)
    {
        Storage.Layout storage l = Storage.layout();
        return Pool.tokensByAccount(account);
    }
}
