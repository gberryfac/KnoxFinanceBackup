// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.4;

import "abdk-libraries-solidity/ABDKMath64x64.sol";

library OptionStatistics {
    using ABDKMath64x64 for int128;
    using ABDKMath64x64 for uint256;

    // Inspired by Primitive Finance's Cumulative Normal Distribution Math Library
    // https://github.com/primitivefinance/rmm-core

    /// @notice Thrown on passing an arg that is out of the input range for these math functions
    error InverseOutOfBounds(int128 value);

    // 64x64 fixed point integer constants
    int128 private constant ONE_64x64 = 0x10000000000000000;
    int128 private constant HALF_64x64 = 0x8000000000000000;

    int128 private constant INVERSE0 = 0x26A8F3C1F21B336E;
    int128 private constant INVERSE1 = -0x87C57E5DA70D3C90;
    int128 private constant INVERSE2 = 0x15D71F5721242C787;
    int128 private constant INVERSE3 = 0x21D0A04B0E9B94F1;
    int128 private constant INVERSE4 = -0xC2BF5D74C724E53F;

    int128 private constant LOW_TAIL = 0x666666666666666; // 0.025
    int128 private constant HIGH_TAIL = 0xF999999999999999; // 0.975

    /// @notice  Returns the inverse CDF, or quantile function of `p`.
    /// @dev     Source: https://arxiv.org/pdf/1002.0567.pdf
    ///          Maximum error of central region is 1.16x10−4
    /// @return  fcentral(p) = q * (a2 + (a1r + a0) / (r^2 + b1r +b0)), as a 64x64 fixed point number
    function invCDF64x64(int128 p) internal pure returns (int128) {
        if (p >= ONE_64x64 || p <= 0) revert InverseOutOfBounds(p);
        // Short circuit for the central region, central region inclusive of tails
        if (p <= HIGH_TAIL && p >= LOW_TAIL) {
            return central64x64(p);
        } else if (p < LOW_TAIL) {
            return tail64x64(p);
        } else {
            int128 negativeTail = -tail64x64(ONE_64x64.sub(p));
            return negativeTail;
        }
    }

    /// @dev    Maximum error: 1.16x10−4
    /// @return Inverse CDF around the central area of 0.025 <= p <= 0.975, as a 64x64 fixed point number
    function central64x64(int128 p) internal pure returns (int128) {
        int128 q = p.sub(HALF_64x64);
        int128 r = q.mul(q);
        int128 result = q.mul(
            INVERSE2.add(
                (INVERSE1.mul(r).add(INVERSE0)).div(
                    (r.mul(r).add(INVERSE4.mul(r)).add(INVERSE3))
                )
            )
        );
        return result;
    }

    // 64x64 fixed point integer constants
    int128 private constant C0 = 0x10E56D75CE8BCE9FAE;
    int128 private constant C1 = -0x2CB2447D36D513DAE;
    int128 private constant C2 = -0x8BB4226952BD69EDF;
    int128 private constant C3 = -0x1000BF627FA188411;
    int128 private constant C0_D = 0x10AEAC93F55267A9A5;
    int128 private constant C1_D = 0x41ED34A2561490236;
    int128 private constant C2_D = 0x7A1E70F720ECA43;
    int128 private constant D0 = 0x72C7D592D021FB1DB;
    int128 private constant D1 = 0x8C27B4617F5F800EA;

    /// @dev    Maximum error: 2.458x10-5
    /// @return Inverse CDF of the tail, defined for p < 0.0465, used with p < 0.025, as a 64x64 fixed point number
    function tail64x64(int128 p) internal pure returns (int128) {
        int128 r = ONE_64x64.div(p.mul(p)).ln().sqrt();
        int128 step0 = C3.mul(r).add(C2_D);
        int128 numerator = C1_D.mul(r).add(C0_D);
        int128 denominator = r.mul(r).add(D1.mul(r)).add(D0);
        int128 result = step0.add(numerator.div(denominator));
        return result;
    }
}
