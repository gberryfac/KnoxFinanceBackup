// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

interface IStrategy {
    /**
     * @notice opens a single position
     * @param maturity timestamp of option maturity
     * @param strikePrice K1 strike price
     * @param size quantity of option contract tokens to exercise
     * @param isCall whether this is a call or a put
     */
    function openPosition(
        uint256 maturity,
        uint256 strikePrice,
        uint256 size,
        bool isCall
    ) external;

    /**
     * @notice opens multiple positions depending on the strategy
     * @param maturity timestamp of option maturity
     * @param strikePrices K1, K2, ..., Kn strike prices
     * @param contractSize quantity of option contract tokens to exercise
     * @param isCall whether this is a call or a put
     * @param maxCost maximum acceptable cost after accounting for slippage
     */
    function openPositions(
        uint256 maturity,
        uint256[] calldata strikePrices,
        uint256 contractSize,
        bool isCall,
        uint256 maxCost
    ) external;

    /**
     * @notice removes all collateral from Premia following option expiration or exercise
     */
    function closePosition()
        external
        returns (
            uint256 payout, /*amount available for MM to withdraw*/
            uint256 payback /*amount that goes back to vault*/
        );

    /**
     * @notice exercises long option
     * @param account of long option tokens to exercise
     * @param longTokenId long option token id
     * @param contractSize quantity of tokens to exercise
     */
    function exercise(
        address account,
        uint256 longTokenId,
        uint256 contractSize
    ) external;

    function getPositionSize() external returns (uint256);
}
