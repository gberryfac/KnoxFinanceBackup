# IVolatilitySurfaceOracle









## Methods

### getAnnualizedVolatility64x64

```solidity
function getAnnualizedVolatility64x64(address base, address underlying, int128 spot64x64, int128 strike64x64, int128 timeToMaturity64x64) external view returns (int128)
```

calculate the annualized volatility for given set of parameters



#### Parameters

| Name | Type | Description |
|---|---|---|
| base | address | The base token of the pair |
| underlying | address | The underlying token of the pair |
| spot64x64 | int128 | 64x64 fixed point representation of spot price |
| strike64x64 | int128 | 64x64 fixed point representation of strike price |
| timeToMaturity64x64 | int128 | 64x64 fixed point representation of time to maturity (denominated in years) |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | int128 | 64x64 fixed point representation of annualized implied volatility, where 1 is defined as 100% |

### getBlackScholesPrice64x64

```solidity
function getBlackScholesPrice64x64(address base, address underlying, int128 spot64x64, int128 strike64x64, int128 timeToMaturity64x64, bool isCall) external view returns (int128)
```

calculate the price of an option using the Black-Scholes model



#### Parameters

| Name | Type | Description |
|---|---|---|
| base | address | The base token of the pair |
| underlying | address | The underlying token of the pair |
| spot64x64 | int128 | Spot price, as a 64x64 fixed point representation |
| strike64x64 | int128 | Strike, as a64x64 fixed point representation |
| timeToMaturity64x64 | int128 | 64x64 fixed point representation of time to maturity (denominated in years) |
| isCall | bool | Whether it is for call or put |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | int128 | 64x64 fixed point representation of the Black Scholes price |




