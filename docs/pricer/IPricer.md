# IPricer









## Methods

### getAnnualizedVolatility64x64

```solidity
function getAnnualizedVolatility64x64(int128 spot64x64, int128 strike64x64, int128 timeToMaturity64x64) external view returns (int128)
```

gets the annualized volatility of the pool pair



#### Parameters

| Name | Type | Description |
|---|---|---|
| spot64x64 | int128 | spot price of the underlying as 64x64 fixed point number |
| strike64x64 | int128 | strike price of the option as 64x64 fixed point number |
| timeToMaturity64x64 | int128 | time remaining until maturity as a 64x64 fixed point number |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | int128 | annualized volatility as 64x64 fixed point number |

### getBlackScholesPrice64x64

```solidity
function getBlackScholesPrice64x64(int128 spot64x64, int128 strike64x64, int128 timeToMaturity64x64, bool isCall) external view returns (int128)
```

gets the option price using the Black-Scholes model



#### Parameters

| Name | Type | Description |
|---|---|---|
| spot64x64 | int128 | spot price of the underlying as 64x64 fixed point number |
| strike64x64 | int128 | strike price of the option as 64x64 fixed point number |
| timeToMaturity64x64 | int128 | time remaining until maturity as a 64x64 fixed point number |
| isCall | bool | option type |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | int128 | price of the option denominated in the base as 64x64 fixed point number |

### getDeltaStrikePrice64x64

```solidity
function getDeltaStrikePrice64x64(bool isCall, uint64 expiry, int128 delta64x64) external view returns (int128)
```

calculates the delta strike price



#### Parameters

| Name | Type | Description |
|---|---|---|
| isCall | bool | option type |
| expiry | uint64 | the expiry date as UNIX timestamp |
| delta64x64 | int128 | option delta as 64x64 fixed point number |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | int128 | delta strike price as 64x64 fixed point number |

### getTimeToMaturity64x64

```solidity
function getTimeToMaturity64x64(uint64 expiry) external view returns (int128)
```

calculates the time remaining until maturity



#### Parameters

| Name | Type | Description |
|---|---|---|
| expiry | uint64 | the expiry date as UNIX timestamp |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | int128 | time remaining until maturity |

### latestAnswer64x64

```solidity
function latestAnswer64x64() external view returns (int128)
```

gets the latest price of the underlying denominated in the base




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | int128 | price of underlying asset as 64x64 fixed point number |

### snapToGrid64x64

```solidity
function snapToGrid64x64(bool isCall, int128 n) external view returns (int128)
```

rounds a value to the floor or ceiling depending on option type



#### Parameters

| Name | Type | Description |
|---|---|---|
| isCall | bool | option type |
| n | int128 | input value |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | int128 | rounded value as 64x64 fixed point number |




