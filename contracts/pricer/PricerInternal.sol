// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/IPremiaPool.sol";
import "../libraries/ABDKMath64x64Token.sol";
import "../vendor/IVolatilitySurfaceOracle.sol";

import "./IPricer.sol";
import "./OptionStatistics.sol";

contract PricerInternal {
    using ABDKMath64x64 for int128;
    using ABDKMath64x64 for uint256;
    using ABDKMath64x64Token for int128;
    using OptionStatistics for int128;

    address public immutable Base;
    address public immutable Underlying;
    IVolatilitySurfaceOracle public immutable IVolOracle;
    AggregatorV3Interface public immutable BaseSpotOracle;
    AggregatorV3Interface public immutable UnderlyingSpotOracle;

    constructor(address pool, address volatilityOracle) {
        require(pool != address(0), "address not provided");
        require(volatilityOracle != address(0), "address not provided");

        IVolOracle = IVolatilitySurfaceOracle(volatilityOracle);

        IPremiaPool.PoolSettings memory settings =
            IPremiaPool(pool).getPoolSettings();

        Base = settings.base;
        Underlying = settings.underlying;

        BaseSpotOracle = AggregatorV3Interface(settings.baseOracle);
        UnderlyingSpotOracle = AggregatorV3Interface(settings.underlyingOracle);

        uint8 decimals = UnderlyingSpotOracle.decimals();

        require(
            BaseSpotOracle.decimals() == decimals,
            "oracle decimals must match"
        );
    }

    /**
     * @notice gets the latest price of the underlying denominated in the base
     * @return price of underlying asset as 64x64 fixed point number
     */
    function _latestAnswer64x64() internal view returns (int128) {
        (, int256 basePrice, , , ) = BaseSpotOracle.latestRoundData();
        (, int256 underlyingPrice, , , ) =
            UnderlyingSpotOracle.latestRoundData();

        return ABDKMath64x64.divi(underlyingPrice, basePrice);
    }

    /**
     * @notice calculates the time remaining until maturity
     * @param expiry the expiry date as UNIX timestamp
     * @return time remaining until maturity
     */
    function _getTimeToMaturity64x64(uint64 expiry)
        internal
        view
        returns (int128)
    {
        return ABDKMath64x64.divu(expiry - block.timestamp, 365 days);
    }

    /**
     * @notice gets the annualized volatility of the pool pair
     * @param spot64x64 spot price of the underlying as 64x64 fixed point number
     * @param strike64x64 strike price of the option as 64x64 fixed point number
     * @param timeToMaturity64x64 time remaining until maturity as a 64x64 fixed point number
     * @return annualized volatility as 64x64 fixed point number
     */
    function _getAnnualizedVolatility64x64(
        int128 spot64x64,
        int128 strike64x64,
        int128 timeToMaturity64x64
    ) internal view returns (int128) {
        return
            IVolOracle.getAnnualizedVolatility64x64(
                Base,
                Underlying,
                spot64x64,
                strike64x64,
                timeToMaturity64x64
            );
    }

    /**
     * @notice gets the option price using the Black-Scholes model
     * @param spot64x64 spot price of the underlying as 64x64 fixed point number
     * @param strike64x64 strike price of the option as 64x64 fixed point number
     * @param timeToMaturity64x64 time remaining until maturity as a 64x64 fixed point number
     * @param isCall option type
     * @return price of the option denominated in the base as 64x64 fixed point number
     */
    function _getBlackScholesPrice64x64(
        int128 spot64x64,
        int128 strike64x64,
        int128 timeToMaturity64x64,
        bool isCall
    ) internal view returns (int128) {
        return
            IVolOracle.getBlackScholesPrice64x64(
                Base,
                Underlying,
                spot64x64,
                strike64x64,
                timeToMaturity64x64,
                isCall
            );
    }

    /**
     * @notice calculates the delta strike price
     * @param isCall option type
     * @param expiry the expiry date as UNIX timestamp
     * @param delta64x64 option delta as 64x64 fixed point number
     * @return delta strike price as 64x64 fixed point number
     */
    function _getDeltaStrikePrice64x64(
        bool isCall,
        uint64 expiry,
        int128 delta64x64
    ) internal view returns (int128) {
        int128 spot64x64 = _latestAnswer64x64();

        int128 timeToMaturity64x64 = _getTimeToMaturity64x64(expiry);
        require(timeToMaturity64x64 > 0, "tau <= 0");

        int128 iv_atm =
            _getAnnualizedVolatility64x64(
                spot64x64,
                spot64x64,
                timeToMaturity64x64
            );
        require(iv_atm > 0, "iv_atm <= 0");

        int128 v = iv_atm.mul(timeToMaturity64x64.sqrt());
        int128 w = timeToMaturity64x64.mul(iv_atm.pow(2)) >> 1;

        if (!isCall) delta64x64 = int128(0x010000000000000000).sub(delta64x64);
        int128 beta = delta64x64.invCDF64x64();

        int128 z = w.sub(beta.mul(v));
        return spot64x64.mul(z.exp());
    }

    /**
     * @notice rounds a value to the floor or ceiling depending on option type
     * @param isCall option type
     * @param n input value
     * @return rounded value as 64x64 fixed point number
     */
    function _snapToGrid64x64(bool isCall, int128 n)
        internal
        pure
        returns (int128)
    {
        return isCall ? n.ceil64x64() : n.floor64x64();
    }
}
