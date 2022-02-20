// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

interface IStrategy {
    // /**
    //  * @notice calculates the amount of capital required from the vault
    //  * @param strikePrices K1, K2, ..., Kn strike prices
    //  * @param spotPrice spot price of underlying
    //  * @param contractSizes quantity of option contract tokens to exercise
    //  */
    // function calculateAmount(
    //     uint256[] calldata strikePrices,
    //     uint256 spotPrice,
    //     uint256[] calldata contractSizes
    // ) external view;

    /**
     * @notice opens a single position
     * @param counterparty address who will receive the long token
     * @param maturity timestamp of option maturity
     * @param strikePrice K1 strike price
     * @param contractSize quantity of option contract tokens to exercise
     * @param isCall whether this is a call or a put
     */
    function openPosition(
        address counterparty,
        uint64 maturity,
        uint256 strikePrice,
        uint256 contractSize,
        bool isCall
    ) external;

    /**
     * @notice opens multiple positions depending on the strategy
     * @param counterparty address who will receive the long token
     * @param maturity timestamp of option maturity
     * @param strikePrices K1, K2, ..., Kn strike prices
     * @param contractSize quantity of option contract tokens to exercise
     * @param isCall whether this is a call or a put
     * @param maxCost maximum acceptable cost after accounting for slippage
     */
    function openPositions(
        address counterparty,
        uint64 maturity,
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
            uint64 payout, /*amount available for MM to withdraw*/
            uint64 payback /*amount that goes back to vault*/
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

    function getPositionSize(
        uint64 premiumSize,
        bytes memory strategyParameters
    ) external returns (uint64);
}
