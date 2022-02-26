// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "abdk-libraries-solidity/ABDKMath64x64.sol";

import "./interfaces/IPoolIO.sol";
import "./interfaces/IPoolWrite.sol";

contract Strategy {
    /************************************************
     *  TYPE DECLARATIONS
     ***********************************************/

    /************************************************
     *  IMMUTABLES & CONSTANTS
     ***********************************************/

    IPoolIO public immutable poolIO;
    IPoolWrite public immutable poolWrite;

    /************************************************
     *  STRUCTS
     ***********************************************/

    /************************************************
     *  EVENTS
     ***********************************************/

    /************************************************
     *  CONSTRUCTOR & INITIALIZATION
     ***********************************************/

    constructor(address _poolIO, address _poolWrite) {
        poolIO = IPoolIO(_poolIO);
        poolWrite = IPoolWrite(_poolWrite);
    }

    /************************************************
     *  OPERATIONS
     ***********************************************/

    function openPosition(
        uint256 maturity,
        uint256 strikePrice,
        uint256 size,
        bool isCall
    ) external {
        int128 strike64x64 = ABDKMath64x64.fromUInt(strikePrice);

        poolWrite.writeFrom(
            msg.sender,
            msg.sender,
            uint64(maturity),
            strike64x64,
            size,
            isCall
        );

        poolIO.setDivestmentTimestamp(1, isCall);
    }

    function closePosition() {}
}
