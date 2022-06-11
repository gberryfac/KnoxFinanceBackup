# IStandardDelta









## Methods

### purchase

```solidity
function purchase(uint256 contractSize, uint256 maxCost) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| contractSize | uint256 | undefined |
| maxCost | uint256 | undefined |



## Events

### NextOptionSet

```solidity
event NextOptionSet(bool isCall, uint64 expiry, int128 strike64x64)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| isCall  | bool | undefined |
| expiry  | uint64 | undefined |
| strike64x64  | int128 | undefined |

### Repaid

```solidity
event Repaid(address indexed account, uint256 amount)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| account `indexed` | address | undefined |
| amount  | uint256 | undefined |

### SaleWindowSet

```solidity
event SaleWindowSet(uint256 blockTimestamp, uint256 startTimestamp, uint256 endTimestamp)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| blockTimestamp  | uint256 | undefined |
| startTimestamp  | uint256 | undefined |
| endTimestamp  | uint256 | undefined |

### Sold

```solidity
event Sold(address account, uint256 amount, uint256 indexed tokenId)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| account  | address | undefined |
| amount  | uint256 | undefined |
| tokenId `indexed` | uint256 | undefined |



