# IAuction









## Methods

### addLimitOrder

```solidity
function addLimitOrder(uint64 epoch, int128 price64x64, uint256 size) external nonpayable
```

adds an order specified by the price and size

*sender must approve contract*

#### Parameters

| Name | Type | Description |
|---|---|---|
| epoch | uint64 | epoch id |
| price64x64 | int128 | max price as 64x64 fixed point number |
| size | uint256 | amount of contracts |

### addMarketOrder

```solidity
function addMarketOrder(uint64 epoch, uint256 size) external nonpayable
```

adds an order specified by size only

*sender must approve contract*

#### Parameters

| Name | Type | Description |
|---|---|---|
| epoch | uint64 | epoch id |
| size | uint256 | amount of contracts |

### cancelLimitOrder

```solidity
function cancelLimitOrder(uint64 epoch, uint256 id) external nonpayable
```

cancels an order

*sender must approve contract*

#### Parameters

| Name | Type | Description |
|---|---|---|
| epoch | uint64 | epoch id |
| id | uint256 | order id |

### clearingPrice64x64

```solidity
function clearingPrice64x64(uint64 epoch) external view returns (int128)
```

clearing price of the auction



#### Parameters

| Name | Type | Description |
|---|---|---|
| epoch | uint64 | epoch id |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | int128 | price as 64x64 fixed point number |

### epochsByBuyer

```solidity
function epochsByBuyer(address buyer) external view returns (uint64[])
```

displays the epochs the buyer has a fill and/or refund



#### Parameters

| Name | Type | Description |
|---|---|---|
| buyer | address | address of buyer |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint64[] | array of epoch ids |

### finalizeAuction

```solidity
function finalizeAuction(uint64 epoch) external nonpayable
```

checks various conditions to determine if auction is finalized



#### Parameters

| Name | Type | Description |
|---|---|---|
| epoch | uint64 | epoch id |

### getAuction

```solidity
function getAuction(uint64 epoch) external view returns (struct AuctionStorage.Auction)
```

gets the auction parameters



#### Parameters

| Name | Type | Description |
|---|---|---|
| epoch | uint64 | epoch id |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | AuctionStorage.Auction | auction parameters |

### getMinSize

```solidity
function getMinSize() external view returns (uint256)
```

gets the minimum order size




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | minimum order size |

### getOrderById

```solidity
function getOrderById(uint64 epoch, uint256 id) external view returns (struct OrderBook.Data)
```

gets the order from the auction orderbook



#### Parameters

| Name | Type | Description |
|---|---|---|
| epoch | uint64 | epoch id |
| id | uint256 | order id |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | OrderBook.Data | order from auction orderbook |

### getStatus

```solidity
function getStatus(uint64 epoch) external view returns (enum AuctionStorage.Status)
```

gets the status of the auction



#### Parameters

| Name | Type | Description |
|---|---|---|
| epoch | uint64 | epoch id |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | enum AuctionStorage.Status | auction status |

### getTotalContracts

```solidity
function getTotalContracts(uint64 epoch) external view returns (uint256)
```

gets the total number of contracts



#### Parameters

| Name | Type | Description |
|---|---|---|
| epoch | uint64 | epoch id |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | total number of contracts |

### getTotalContractsSold

```solidity
function getTotalContractsSold(uint64 epoch) external view returns (uint256)
```

gets the total number of contracts sold during auction



#### Parameters

| Name | Type | Description |
|---|---|---|
| epoch | uint64 | epoch id |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | total number of contracts sold |

### initialize

```solidity
function initialize(AuctionStorage.InitAuction initAuction) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| initAuction | AuctionStorage.InitAuction | undefined |

### isFinalized

```solidity
function isFinalized(uint64 epoch) external view returns (bool)
```

checks if the auction is finalized



#### Parameters

| Name | Type | Description |
|---|---|---|
| epoch | uint64 | epoch id |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | true == finalized, false == not finalized |

### lastPrice64x64

```solidity
function lastPrice64x64(uint64 epoch) external view returns (int128)
```

last price paid during the auction



#### Parameters

| Name | Type | Description |
|---|---|---|
| epoch | uint64 | epoch id |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | int128 | price as 64x64 fixed point number |

### onERC1155BatchReceived

```solidity
function onERC1155BatchReceived(address operator, address from, uint256[] ids, uint256[] values, bytes data) external nonpayable returns (bytes4)
```

validate receipt of ERC1155 batch transfer



#### Parameters

| Name | Type | Description |
|---|---|---|
| operator | address | executor of transfer |
| from | address | sender of tokens |
| ids | uint256[] | token IDs received |
| values | uint256[] | quantities of tokens received |
| data | bytes | data payload |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bytes4 | function&#39;s own selector if transfer is accepted |

### onERC1155Received

```solidity
function onERC1155Received(address operator, address from, uint256 id, uint256 value, bytes data) external nonpayable returns (bytes4)
```

validate receipt of ERC1155 transfer



#### Parameters

| Name | Type | Description |
|---|---|---|
| operator | address | executor of transfer |
| from | address | sender of tokens |
| id | uint256 | token ID received |
| value | uint256 | quantity of tokens received |
| data | bytes | data payload |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bytes4 | function&#39;s own selector if transfer is accepted |

### previewWithdraw

```solidity
function previewWithdraw(uint64 epoch) external nonpayable returns (uint256, uint256)
```

calculates amount(s) owed to the buyer



#### Parameters

| Name | Type | Description |
|---|---|---|
| epoch | uint64 | epoch id |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | amount refunded |
| _1 | uint256 | amount filled |

### previewWithdraw

```solidity
function previewWithdraw(uint64 epoch, address buyer) external nonpayable returns (uint256, uint256)
```

calculates amount(s) owed to the buyer



#### Parameters

| Name | Type | Description |
|---|---|---|
| epoch | uint64 | epoch id |
| buyer | address | address of buyer |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | amount refunded |
| _1 | uint256 | amount filled |

### priceCurve64x64

```solidity
function priceCurve64x64(uint64 epoch) external view returns (int128)
```

calculates price as a function of time



#### Parameters

| Name | Type | Description |
|---|---|---|
| epoch | uint64 | epoch id |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | int128 | price as 64x64 fixed point number |

### processAuction

```solidity
function processAuction(uint64 epoch) external nonpayable
```

checks various conditions to determine if auction is processed



#### Parameters

| Name | Type | Description |
|---|---|---|
| epoch | uint64 | epoch id |

### setAuctionPrices

```solidity
function setAuctionPrices(uint64 epoch, int128 maxPrice64x64, int128 minPrice64x64) external nonpayable
```

sets the auction max/min prices



#### Parameters

| Name | Type | Description |
|---|---|---|
| epoch | uint64 | epoch id |
| maxPrice64x64 | int128 | max price as 64x64 fixed point number |
| minPrice64x64 | int128 | min price as 64x64 fixed point number |

### supportsInterface

```solidity
function supportsInterface(bytes4 interfaceId) external view returns (bool)
```

query whether contract has registered support for given interface



#### Parameters

| Name | Type | Description |
|---|---|---|
| interfaceId | bytes4 | interface id |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | bool whether interface is supported |

### transferPremium

```solidity
function transferPremium(uint64 epoch) external nonpayable returns (uint256)
```

transfers the premiums paid during auction to the vault



#### Parameters

| Name | Type | Description |
|---|---|---|
| epoch | uint64 | epoch id |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | amount in premiums paid during auction |

### withdraw

```solidity
function withdraw(uint64 epoch) external nonpayable
```

removes any amount(s) owed to the buyer (fill and/or refund)



#### Parameters

| Name | Type | Description |
|---|---|---|
| epoch | uint64 | epoch id |



## Events

### AuctionPricesSet

```solidity
event AuctionPricesSet(uint64 indexed epoch, int128 maxPrice64x64, int128 minPrice64x64)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| epoch `indexed` | uint64 | undefined |
| maxPrice64x64  | int128 | undefined |
| minPrice64x64  | int128 | undefined |

### AuctionStatusSet

```solidity
event AuctionStatusSet(uint64 indexed epoch, enum AuctionStorage.Status status)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| epoch `indexed` | uint64 | undefined |
| status  | enum AuctionStorage.Status | undefined |

### OrderAdded

```solidity
event OrderAdded(uint64 indexed epoch, uint256 id, address buyer, int128 price64x64, uint256 size, bool isLimitOrder)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| epoch `indexed` | uint64 | undefined |
| id  | uint256 | undefined |
| buyer  | address | undefined |
| price64x64  | int128 | undefined |
| size  | uint256 | undefined |
| isLimitOrder  | bool | undefined |

### OrderCanceled

```solidity
event OrderCanceled(uint64 indexed epoch, uint256 id, address buyer)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| epoch `indexed` | uint64 | undefined |
| id  | uint256 | undefined |
| buyer  | address | undefined |

### OrderWithdrawn

```solidity
event OrderWithdrawn(uint64 indexed epoch, address buyer, uint256 refund, uint256 fill)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| epoch `indexed` | uint64 | undefined |
| buyer  | address | undefined |
| refund  | uint256 | undefined |
| fill  | uint256 | undefined |



