// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

interface IKnoxStrategy {
    /**
     * @notice underwrites a long option on behalf of the counterparty
     * @param counterparty address who will receive the long token
     * @param maturity timestamp of option maturity
     * @param strikePrice 64x64 fixed point representation of strike price
     * @param contractSize quantity of option contract tokens to exercise
     */
    function openPosition(
        address counterparty,
        uint64 maturity,
        int128 strikePrice,
        uint256 contractSize
    ) external;

    /**
     * @notice underwrites a long option on behalf of the counterparty
     * @param counterparty address who will receive the long token
     * @param maturity timestamp of option maturity
     * @param strikePrice 64x64 fixed point representation of strike price
     * @param contractSize quantity of option contract tokens to exercise
     * @param maxCost maximum acceptable cost after accounting for slippage (multi-leg strategies only)
     */
    function openPosition(
        address counterparty,
        uint64 maturity,
        int128 strikePrice,
        uint256 contractSize,
        uint256 maxCost
    ) external;

    /**
     * @notice removes all collateral from Premia following option expiration or exercise
     */
    function closePosition() external;

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
}
