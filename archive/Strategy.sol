// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "abdk-libraries-solidity/ABDKMath64x64.sol";

import "./../interfaces/IPoolIO.sol";
import "./../interfaces/IPoolWrite.sol";

library Strategy {
    function underwrite(
        address poolIO,
        address poolWrite,
        uint256 maturity,
        uint256 strikePrice,
        uint256 size,
        bool isCall
    ) external {
        int128 strike64x64 = ABDKMath64x64.fromUInt(strikePrice);

        IPoolWrite(poolWrite).writeFrom(
            msg.sender,
            msg.sender,
            uint64(maturity),
            strike64x64,
            size,
            isCall
        );

        IPoolIO(poolIO).setDivestmentTimestamp(1, isCall);
    }

    function withdraw() {}

    function purchase() {}

    function quote() {}
}
