# StandardDelta









## Methods

### Asset

```solidity
function Asset() external view returns (contract IERC20)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IERC20 | undefined |

### Pool

```solidity
function Pool() external view returns (contract IPremiaPool)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IPremiaPool | undefined |

### Pricer

```solidity
function Pricer() external view returns (contract IStandardDeltaPricer)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IStandardDeltaPricer | undefined |

### Vault

```solidity
function Vault() external view returns (contract IVault)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IVault | undefined |

### accountsByToken

```solidity
function accountsByToken(uint256 id) external view returns (address[])
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| id | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address[] | undefined |

### assetProperties

```solidity
function assetProperties() external view returns (uint8 baseDecimals, uint8 underlyingDecimals)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| baseDecimals | uint8 | undefined |
| underlyingDecimals | uint8 | undefined |

### endOffset

```solidity
function endOffset() external view returns (uint16)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint16 | undefined |

### exercise

```solidity
function exercise(address holder, uint256 longTokenId, uint256 contractSize) external nonpayable
```

Exercises In-The-Money options



#### Parameters

| Name | Type | Description |
|---|---|---|
| holder | address | undefined |
| longTokenId | uint256 | undefined |
| contractSize | uint256 | undefined |

### initialize

```solidity
function initialize(bool _isCall, uint8 _baseDecimals, uint8 _underlyingDecimals, uint64 _minimumContractSize, int128 _delta64x64, address _keeper, address _pool, address _pricer, address _vault) external nonpayable
```

Initializes the vault contract with storage variables.

*Vault contracts must be deployed and initialized.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _isCall | bool | undefined |
| _baseDecimals | uint8 | undefined |
| _underlyingDecimals | uint8 | undefined |
| _minimumContractSize | uint64 | undefined |
| _delta64x64 | int128 | undefined |
| _keeper | address | undefined |
| _pool | address | undefined |
| _pricer | address | undefined |
| _vault | address | undefined |

### keeper

```solidity
function keeper() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### option

```solidity
function option() external view returns (bool isCall, uint64 minimumContractSize, uint64 expiry, int128 delta64x64, int128 strike64x64)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| isCall | bool | undefined |
| minimumContractSize | uint64 | undefined |
| expiry | uint64 | undefined |
| delta64x64 | int128 | undefined |
| strike64x64 | int128 | undefined |

### owner

```solidity
function owner() external view returns (address)
```



*Returns the address of the current owner.*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### processExpired

```solidity
function processExpired() external nonpayable
```

Processes expired options




### purchase

```solidity
function purchase(uint256 contractSize, uint256 maxCost) external nonpayable
```

Initiates the option sale



#### Parameters

| Name | Type | Description |
|---|---|---|
| contractSize | uint256 | undefined |
| maxCost | uint256 | undefined |

### renounceOwnership

```solidity
function renounceOwnership() external nonpayable
```



*Leaves the contract without owner. It will not be possible to call `onlyOwner` functions anymore. Can only be called by the current owner. NOTE: Renouncing ownership will leave the contract without an owner, thereby removing any functionality that is only available to the owner.*


### saleWindow

```solidity
function saleWindow(uint256) external view returns (uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### setNewKeeper

```solidity
function setNewKeeper(address newKeeper) external nonpayable
```

Sets the new keeper



#### Parameters

| Name | Type | Description |
|---|---|---|
| newKeeper | address | is the address of the new keeper |

### setNextOption

```solidity
function setNextOption() external nonpayable
```

Sets the parameters for the next option to be sold




### setNextSale

```solidity
function setNextSale(bool process) external nonpayable
```

Prepares the strategy and initiates the next round of option sales



#### Parameters

| Name | Type | Description |
|---|---|---|
| process | bool | undefined |

### setSaleWindow

```solidity
function setSaleWindow(uint16 start, uint16 end) external nonpayable
```

Sets a range of times in which a purchase can be completed



#### Parameters

| Name | Type | Description |
|---|---|---|
| start | uint16 | undefined |
| end | uint16 | undefined |

### startOffset

```solidity
function startOffset() external view returns (uint16)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint16 | undefined |

### sync

```solidity
function sync() external nonpayable
```






### tokensByAccount

```solidity
function tokensByAccount(address account) external view returns (uint256[])
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| account | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256[] | undefined |

### transferOwnership

```solidity
function transferOwnership(address newOwner) external nonpayable
```



*Transfers ownership of the contract to a new account (`newOwner`). Can only be called by the current owner.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| newOwner | address | undefined |

### withdrawAndRepay

```solidity
function withdrawAndRepay() external nonpayable
```

Removes liquidity from option pool, returns borrowed funds to vault






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

### OwnershipTransferred

```solidity
event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| previousOwner `indexed` | address | undefined |
| newOwner `indexed` | address | undefined |

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



