// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {ABDKMath64x64} from "abdk-libraries-solidity/ABDKMath64x64.sol";

/**
 * @title ABDK 64x64 Token Math Helper Library
 * @dev extension of ABDKMath64x64Token SolidState Solidity library
 */

library ABDKMath64x64Token {
    using ABDKMath64x64 for int128;
    using ABDKMath64x64 for uint256;

    struct Value {
        int256 value;
        int256 ruler;
    }

    function _getPositivePlaceValues(int128 x)
        private
        pure
        returns (int256, Value[3] memory)
    {
        // move the decimal part to integer by multiplying 10...0
        int256 integer = (int256(x) * 10000000000000000000) >> 64;

        // scan and identify the highest position
        int256 ruler = 100000000000000000000000000000000000000; // 10^38
        while (integer < ruler) {
            ruler = ruler / 10;
        }

        Value[3] memory values;

        // find the first/second/third largest places and there value
        values[0] = Value(0, 0);
        values[1] = Value(0, 0);
        values[2] = Value(0, 0);

        // setup the first place value
        values[0].ruler = ruler;
        values[0].value = (integer / values[0].ruler) % 10;

        // setup the second place value
        values[1].ruler = ruler / 10;
        values[1].value = (integer / values[1].ruler) % 10;

        // setup the third place value
        values[2].ruler = ruler / 100;
        values[2].value = (integer / values[2].ruler) % 10;

        return (integer, values);
    }

    /**
     * @custom:author Yaojin Sun
     * @notice applies ceiling to the second highest place value of a positive 64x64 fixed point number
     * @param x 64x64 fixed point number
     * @return rounded 64x64 fixed point number
     */
    function ceil64x64(int128 x) internal pure returns (int128) {
        require(x > 0);

        (int256 integer, Value[3] memory values) = _getPositivePlaceValues(x);

        // if the summation of first and second values is equal to integer, the integer has already been rounded
        if (
            values[0].ruler *
                values[0].value +
                values[1].ruler *
                values[1].value ==
            integer
        ) {
            return int128((integer << 64) / 10000000000000000000);
        }

        return
            int128(
                (((values[0].ruler * values[0].value) +
                    (values[1].ruler * (values[1].value + 1))) << 64) /
                    10000000000000000000
            );
    }

    /**
     * @custom:author Yaojin Sun
     * @notice applies floor to the second highest place value of a positive 64x64 fixed point number
     * @param x 64x64 fixed point number
     * @return rounded 64x64 fixed point number
     */
    function floor64x64(int128 x) internal pure returns (int128) {
        require(x > 0);

        (, Value[3] memory values) = _getPositivePlaceValues(x);

        // No matter whether third value is non-zero or not, we ONLY need to keep the first and second places.
        int256 res =
            (values[0].ruler * values[0].value) +
                (values[1].ruler * values[1].value);
        return int128((res << 64) / 10000000000000000000);
    }

    /**
     * @custom:author Yaojin Sun
     * @notice applies bankers rounding to the second highest place value of a positive 64x64 fixed
     * point number
     * @param x 64x64 fixed point number
     * @return rounded 64x64 fixed point number
     */
    function roundHalfToEven64x64(int128 x) internal pure returns (int128) {
        require(x > 0);

        (int256 integer, Value[3] memory values) = _getPositivePlaceValues(x);

        // if the summation of first and second values is equal to integer, the integer has already been rounded
        if (
            values[0].ruler *
                values[0].value +
                values[1].ruler *
                values[1].value ==
            integer
        ) {
            return int128((integer << 64) / 10000000000000000000);
        }

        // if third value is less than 5
        if (values[2].value < 5) {
            return
                int128(
                    (((values[0].ruler * values[0].value) +
                        (values[1].ruler * (values[1].value))) << 64) /
                        10000000000000000000
                );
        }

        // if third value is larger than 5
        if (values[2].value > 5) {
            return
                int128(
                    (((values[0].ruler * values[0].value) +
                        (values[1].ruler * (values[1].value + 1))) << 64) /
                        10000000000000000000
                );
        }

        // if third value is equal to 5
        int256 sum_of_first_second_third =
            (values[0].ruler * values[0].value) +
                (values[1].ruler * values[1].value) +
                (values[2].ruler * values[2].value);
        if (sum_of_first_second_third == integer) {
            if (values[1].value % 2 == 0) {
                return
                    int128(
                        (((values[0].ruler * values[0].value) +
                            (values[1].ruler * (values[1].value))) << 64) /
                            10000000000000000000
                    );
            }
        }

        return
            int128(
                (((values[0].ruler * values[0].value) +
                    (values[1].ruler * (values[1].value + 1))) << 64) /
                    10000000000000000000
            );
    }

    /**
     * @notice convert 64x64 fixed point representation of token amount to decimal
     * @param value64x64 64x64 fixed point representation of token amount
     * @param decimals token display decimals
     * @return value decimal representation of token amount
     */
    function toDecimals(int128 value64x64, uint8 decimals)
        internal
        pure
        returns (uint256 value)
    {
        value = value64x64.mulu(10**decimals);
    }

    /**
     * @notice convert decimal representation of token amount to 64x64 fixed point
     * @param value decimal representation of token amount
     * @param decimals token display decimals
     * @return value64x64 64x64 fixed point representation of token amount
     */
    function fromDecimals(uint256 value, uint8 decimals)
        internal
        pure
        returns (int128 value64x64)
    {
        value64x64 = ABDKMath64x64.divu(value, 10**decimals);
    }

    /**
     * @notice convert 64x64 fixed point representation of token amount to wei (18 decimals)
     * @param value64x64 64x64 fixed point representation of token amount
     * @return value wei representation of token amount
     */
    function toWei(int128 value64x64) internal pure returns (uint256 value) {
        value = toDecimals(value64x64, 18);
    }

    /**
     * @notice convert wei representation (18 decimals) of token amount to 64x64 fixed point
     * @param value wei representation of token amount
     * @return value64x64 64x64 fixed point representation of token amount
     */
    function fromWei(uint256 value) internal pure returns (int128 value64x64) {
        value64x64 = fromDecimals(value, 18);
    }

    /**
     * @notice converts the value to the base token amount
     * @param underlyingDecimals decimal precision of the underlying asset
     * @param baseDecimals decimal precision of the base asset
     * @param value amount to convert
     * @return decimal representation of base token amount
     */
    function toBaseTokenAmount(
        uint8 underlyingDecimals,
        uint8 baseDecimals,
        uint256 value
    ) internal pure returns (uint256) {
        int128 value64x64 = fromDecimals(value, underlyingDecimals);
        return toDecimals(value64x64, baseDecimals);
    }
}
