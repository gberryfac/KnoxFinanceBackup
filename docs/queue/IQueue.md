# IQueue









## Methods

### accountsByToken

```solidity
function accountsByToken(uint256 id) external view returns (address[])
```

query holders of given token



#### Parameters

| Name | Type | Description |
|---|---|---|
| id | uint256 | token id to query |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address[] | list of holder addresses |

### balanceOf

```solidity
function balanceOf(address account, uint256 id) external view returns (uint256)
```

query the balance of given token held by given address



#### Parameters

| Name | Type | Description |
|---|---|---|
| account | address | address to query |
| id | uint256 | token to query |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | token balance |

### balanceOfBatch

```solidity
function balanceOfBatch(address[] accounts, uint256[] ids) external view returns (uint256[])
```

query the balances of given tokens held by given addresses



#### Parameters

| Name | Type | Description |
|---|---|---|
| accounts | address[] | addresss to query |
| ids | uint256[] | tokens to query |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256[] | token balances |

### cancel

```solidity
function cancel(uint256 amount) external nonpayable
```

cancels deposit, refunds collateral asset

*cancellation must be made within the same epoch as the deposit*

#### Parameters

| Name | Type | Description |
|---|---|---|
| amount | uint256 | total collateral which will be withdrawn |

### deposit

```solidity
function deposit(uint256 amount, address receiver) external nonpayable
```

deposits collateral asset

*sender must approve contract*

#### Parameters

| Name | Type | Description |
|---|---|---|
| amount | uint256 | total collateral deposited |
| receiver | address | claim token recipient |

### deposit

```solidity
function deposit(uint256 amount) external nonpayable
```

deposits collateral asset

*sender must approve contract*

#### Parameters

| Name | Type | Description |
|---|---|---|
| amount | uint256 | total collateral deposited |

### formatClaimTokenId

```solidity
function formatClaimTokenId(uint64 epoch) external view returns (uint256)
```

calculates claim token id for a given epoch



#### Parameters

| Name | Type | Description |
|---|---|---|
| epoch | uint64 | weekly interval id |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | claim token id |

### getCurrentTokenId

```solidity
function getCurrentTokenId() external view returns (uint256)
```

gets current claim token id




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | claim token id |

### getEpoch

```solidity
function getEpoch() external view returns (uint64)
```

gets current epoch of the queue




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint64 | epoch id |

### getMaxTVL

```solidity
function getMaxTVL() external view returns (uint256)
```

gets max total value locked of the vault




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | max total value |

### getPricePerShare

```solidity
function getPricePerShare(uint256 tokenId) external view returns (uint256)
```

gets price per share for a given claim token id



#### Parameters

| Name | Type | Description |
|---|---|---|
| tokenId | uint256 | claim token id |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | price per share |

### isApprovedForAll

```solidity
function isApprovedForAll(address account, address operator) external view returns (bool)
```

query approval status of given operator with respect to given address



#### Parameters

| Name | Type | Description |
|---|---|---|
| account | address | address to query for approval granted |
| operator | address | address to query for approval received |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | whether operator is approved to spend tokens held by account |

### parseClaimTokenId

```solidity
function parseClaimTokenId(uint256 tokenId) external pure returns (address, uint64)
```

derives queue address and epoch from claim token id



#### Parameters

| Name | Type | Description |
|---|---|---|
| tokenId | uint256 | claim token id |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | address of queue |
| _1 | uint64 | epoch id |

### previewUnredeemed

```solidity
function previewUnredeemed(uint256 tokenId) external view returns (uint256)
```

calculates unredeemed vault shares available



#### Parameters

| Name | Type | Description |
|---|---|---|
| tokenId | uint256 | claim token id |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | total unredeemed vault shares |

### previewUnredeemed

```solidity
function previewUnredeemed(uint256 tokenId, address account) external view returns (uint256)
```

calculates unredeemed vault shares available



#### Parameters

| Name | Type | Description |
|---|---|---|
| tokenId | uint256 | claim token id |
| account | address | claim token holder |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | total unredeemed vault shares |

### processDeposits

```solidity
function processDeposits() external nonpayable
```

transfers deposited collateral to vault, calculates the price per share




### redeem

```solidity
function redeem(uint256 tokenId, address receiver) external nonpayable
```

exchanges claim token for vault shares



#### Parameters

| Name | Type | Description |
|---|---|---|
| tokenId | uint256 | claim token id |
| receiver | address | vault share recipient |

### redeem

```solidity
function redeem(uint256 tokenId, address receiver, address owner) external nonpayable
```

exchanges claim token for vault shares



#### Parameters

| Name | Type | Description |
|---|---|---|
| tokenId | uint256 | claim token id |
| receiver | address | vault share recipient |
| owner | address | claim token holder |

### redeem

```solidity
function redeem(uint256 tokenId) external nonpayable
```

exchanges claim token for vault shares



#### Parameters

| Name | Type | Description |
|---|---|---|
| tokenId | uint256 | claim token id |

### redeemMax

```solidity
function redeemMax() external nonpayable
```

exchanges all claim tokens for vault shares




### redeemMax

```solidity
function redeemMax(address receiver) external nonpayable
```

exchanges all claim tokens for vault shares



#### Parameters

| Name | Type | Description |
|---|---|---|
| receiver | address | vault share recipient |

### redeemMax

```solidity
function redeemMax(address receiver, address owner) external nonpayable
```

exchanges all claim tokens for vault shares



#### Parameters

| Name | Type | Description |
|---|---|---|
| receiver | address | vault share recipient |
| owner | address | claim token holder |

### safeBatchTransferFrom

```solidity
function safeBatchTransferFrom(address from, address to, uint256[] ids, uint256[] amounts, bytes data) external nonpayable
```

transfer batch of tokens between given addresses, checking for ERC1155Receiver implementation if applicable



#### Parameters

| Name | Type | Description |
|---|---|---|
| from | address | sender of tokens |
| to | address | receiver of tokens |
| ids | uint256[] | list of token IDs |
| amounts | uint256[] | list of quantities of tokens to transfer |
| data | bytes | data payload |

### safeTransferFrom

```solidity
function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data) external nonpayable
```

transfer tokens between given addresses, checking for ERC1155Receiver implementation if applicable



#### Parameters

| Name | Type | Description |
|---|---|---|
| from | address | sender of tokens |
| to | address | receiver of tokens |
| id | uint256 | token ID |
| amount | uint256 | quantity of tokens to transfer |
| data | bytes | data payload |

### setApprovalForAll

```solidity
function setApprovalForAll(address operator, bool status) external nonpayable
```

grant approval to or revoke approval from given operator to spend held tokens



#### Parameters

| Name | Type | Description |
|---|---|---|
| operator | address | address whose approval status to update |
| status | bool | whether operator should be considered approved |

### setMaxTVL

```solidity
function setMaxTVL(uint256 newMaxTVL) external nonpayable
```

sets a new max TVL for deposits



#### Parameters

| Name | Type | Description |
|---|---|---|
| newMaxTVL | uint256 | is the new TVL limit for deposits |

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

### syncEpoch

```solidity
function syncEpoch(uint64 epoch) external nonpayable
```

syncs queue epoch with vault epoch



#### Parameters

| Name | Type | Description |
|---|---|---|
| epoch | uint64 | current epoch of vault |

### tokensByAccount

```solidity
function tokensByAccount(address account) external view returns (uint256[])
```

query tokens held by given address



#### Parameters

| Name | Type | Description |
|---|---|---|
| account | address | address to query |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256[] | list of token ids |

### totalHolders

```solidity
function totalHolders(uint256 id) external view returns (uint256)
```

query total number of holders for given token



#### Parameters

| Name | Type | Description |
|---|---|---|
| id | uint256 | token id to query |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | quantity of holders |

### totalSupply

```solidity
function totalSupply(uint256 id) external view returns (uint256)
```

query total minted supply of given token



#### Parameters

| Name | Type | Description |
|---|---|---|
| id | uint256 | token id to query |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | token supply |



## Events

### ApprovalForAll

```solidity
event ApprovalForAll(address indexed account, address indexed operator, bool approved)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| account `indexed` | address | undefined |
| operator `indexed` | address | undefined |
| approved  | bool | undefined |

### Cancel

```solidity
event Cancel(uint64 indexed epoch, address depositer, uint256 amount)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| epoch `indexed` | uint64 | undefined |
| depositer  | address | undefined |
| amount  | uint256 | undefined |

### Deposit

```solidity
event Deposit(uint64 indexed epoch, address receiver, address depositer, uint256 amount)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| epoch `indexed` | uint64 | undefined |
| receiver  | address | undefined |
| depositer  | address | undefined |
| amount  | uint256 | undefined |

### EpochSet

```solidity
event EpochSet(uint64 indexed epoch, address caller)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| epoch `indexed` | uint64 | undefined |
| caller  | address | undefined |

### MaxTVLSet

```solidity
event MaxTVLSet(uint64 indexed epoch, uint256 oldMaxTVL, uint256 newMaxTVL, address caller)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| epoch `indexed` | uint64 | undefined |
| oldMaxTVL  | uint256 | undefined |
| newMaxTVL  | uint256 | undefined |
| caller  | address | undefined |

### ProcessQueuedDeposits

```solidity
event ProcessQueuedDeposits(uint64 indexed epoch, uint256 deposits, uint256 pricePerShare, uint256 shares, uint256 claimTokenSupply)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| epoch `indexed` | uint64 | undefined |
| deposits  | uint256 | undefined |
| pricePerShare  | uint256 | undefined |
| shares  | uint256 | undefined |
| claimTokenSupply  | uint256 | undefined |

### Redeem

```solidity
event Redeem(uint64 indexed epoch, address receiver, address depositer, uint256 shares)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| epoch `indexed` | uint64 | undefined |
| receiver  | address | undefined |
| depositer  | address | undefined |
| shares  | uint256 | undefined |

### TransferBatch

```solidity
event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| operator `indexed` | address | undefined |
| from `indexed` | address | undefined |
| to `indexed` | address | undefined |
| ids  | uint256[] | undefined |
| values  | uint256[] | undefined |

### TransferSingle

```solidity
event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| operator `indexed` | address | undefined |
| from `indexed` | address | undefined |
| to `indexed` | address | undefined |
| id  | uint256 | undefined |
| value  | uint256 | undefined |



