// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IStrategy {
    // /**
    //  * @notice opens a position
    //  * @param maturity timestamp of option maturity
    //  * @param strikePrice K1 strike price
    //  * @param size quantity of option contract tokens to exercise
    //  * @param isCall whether this is a call or a put
    //  */
    function openPosition() external;

    /**
     * @notice claims payout for position that has expired ITM.
     */
    function closePosition() external;

    function processExpired(uint256 longTokenId, uint256 contractSize) external;
}
