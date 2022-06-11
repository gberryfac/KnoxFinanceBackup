# StandardDeltaPricer









## Methods

### BaseSpotOracle

```solidity
function BaseSpotOracle() external view returns (contract AggregatorInterface)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract AggregatorInterface | undefined |

### IVolOracle

```solidity
function IVolOracle() external view returns (contract IVolatilitySurfaceOracle)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IVolatilitySurfaceOracle | undefined |

### UnderlyingSpotOracle

```solidity
function UnderlyingSpotOracle() external view returns (contract AggregatorInterface)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract AggregatorInterface | undefined |

### assetProperties

```solidity
function assetProperties() external view returns (address base, address underlying)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| base | address | undefined |
| underlying | address | undefined |

### getAnnualizedVolatilityATM64x64

```solidity
function getAnnualizedVolatilityATM64x64(int128 tau64x64, int128 spot64x64, int128 strike64x64) external view returns (int128)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| tau64x64 | int128 | undefined |
| spot64x64 | int128 | undefined |
| strike64x64 | int128 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | int128 | undefined |

### getDeltaStrikePrice64x64

```solidity
function getDeltaStrikePrice64x64(bool isCall, uint64 expiry, int128 delta64x64) external view returns (int128)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| isCall | bool | undefined |
| expiry | uint64 | undefined |
| delta64x64 | int128 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | int128 | undefined |

### getTimeToMaturity64x64

```solidity
function getTimeToMaturity64x64(uint64 expiry) external view returns (int128)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| expiry | uint64 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | int128 | undefined |

### latestAnswer64x64

```solidity
function latestAnswer64x64() external view returns (int128)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | int128 | undefined |

### snapToGrid

```solidity
function snapToGrid(bool isCall, int128 n) external pure returns (int128)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| isCall | bool | undefined |
| n | int128 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | int128 | undefined |




## Errors

### InverseOutOfBounds

```solidity
error InverseOutOfBounds(int128 value)
```

Thrown on passing an arg that is out of the input range for these math functions



#### Parameters

| Name | Type | Description |
|---|---|---|
| value | int128 | undefined |


