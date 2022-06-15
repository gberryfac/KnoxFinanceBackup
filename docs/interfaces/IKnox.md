# IKnox









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

### allowance

```solidity
function allowance(address holder, address spender) external view returns (uint256)
```

query the allowance granted from given holder to given spender



#### Parameters

| Name | Type | Description |
|---|---|---|
| holder | address | approver of allowance |
| spender | address | recipient of allowance |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | token allowance |

### approve

```solidity
function approve(address spender, uint256 amount) external nonpayable returns (bool)
```

grant approval to spender to spend tokens

*prefer ERC20Extended functions to avoid transaction-ordering vulnerability (see https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729)*

#### Parameters

| Name | Type | Description |
|---|---|---|
| spender | address | recipient of allowance |
| amount | uint256 | quantity of tokens approved for spending |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | success status (always true; otherwise function should revert) |

### asset

```solidity
function asset() external view returns (address)
```

get the address of the base token used for vault accountin purposes




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | base token address |

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

### balanceOf

```solidity
function balanceOf(address account) external view returns (uint256)
```

query the token balance of given account



#### Parameters

| Name | Type | Description |
|---|---|---|
| account | address | address to query |

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

### borrow

```solidity
function borrow() external nonpayable
```






### collectVaultFees

```solidity
function collectVaultFees() external nonpayable
```






### convertToAssets

```solidity
function convertToAssets(uint256 shareAmount) external view returns (uint256 assetAmount)
```

calculate the quantity of assets received in exchange for a given quantity of shares, not accounting for slippage



#### Parameters

| Name | Type | Description |
|---|---|---|
| shareAmount | uint256 | quantity of shares to convert |

#### Returns

| Name | Type | Description |
|---|---|---|
| assetAmount | uint256 | quantity of assets calculated |

### convertToShares

```solidity
function convertToShares(uint256 assetAmount) external view returns (uint256 shareAmount)
```

calculate the quantity of shares received in exchange for a given quantity of assets, not accounting for slippage



#### Parameters

| Name | Type | Description |
|---|---|---|
| assetAmount | uint256 | quantity of assets to convert |

#### Returns

| Name | Type | Description |
|---|---|---|
| shareAmount | uint256 | quantity of shares calculated |

### deposit

```solidity
function deposit(uint256 assetAmount, address receiver) external nonpayable returns (uint256 shareAmount)
```

execute a deposit of assets on behalf of given address



#### Parameters

| Name | Type | Description |
|---|---|---|
| assetAmount | uint256 | quantity of assets to deposit |
| receiver | address | recipient of shares resulting from deposit |

#### Returns

| Name | Type | Description |
|---|---|---|
| shareAmount | uint256 | quantity of shares to mint |

### depositQueuedToVault

```solidity
function depositQueuedToVault() external nonpayable
```






### depositToQueue

```solidity
function depositToQueue(uint256 amount, address receiver) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| amount | uint256 | undefined |
| receiver | address | undefined |

### depositToQueue

```solidity
function depositToQueue(uint256 amount) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| amount | uint256 | undefined |

### epoch

```solidity
function epoch() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### initializeQueue

```solidity
function initializeQueue() external nonpayable
```






### initializeVault

```solidity
function initializeVault(Storage.InitParams _initParams, Storage.InitProps _initProps, address _keeper, address _feeRecipient, address _strategy) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _initParams | Storage.InitParams | undefined |
| _initProps | Storage.InitProps | undefined |
| _keeper | address | undefined |
| _feeRecipient | address | undefined |
| _strategy | address | undefined |

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

### maxDeposit

```solidity
function maxDeposit(address receiver) external view returns (uint256 maxAssets)
```

calculate the maximum quantity of base assets which may be deposited on behalf of given receiver



#### Parameters

| Name | Type | Description |
|---|---|---|
| receiver | address | recipient of shares resulting from deposit |

#### Returns

| Name | Type | Description |
|---|---|---|
| maxAssets | uint256 | maximum asset deposit amount |

### maxMint

```solidity
function maxMint(address receiver) external view returns (uint256 maxShares)
```

calculate the maximum quantity of shares which may be minted on behalf of given receiver



#### Parameters

| Name | Type | Description |
|---|---|---|
| receiver | address | recipient of shares resulting from deposit |

#### Returns

| Name | Type | Description |
|---|---|---|
| maxShares | uint256 | maximum share mint amount |

### maxRedeem

```solidity
function maxRedeem(address owner) external view returns (uint256 maxShares)
```

calculate the maximum quantity of shares which may be redeemed by given holder



#### Parameters

| Name | Type | Description |
|---|---|---|
| owner | address | holder of shares to be redeemed |

#### Returns

| Name | Type | Description |
|---|---|---|
| maxShares | uint256 | maximum share redeem amount |

### maxRedeemShares

```solidity
function maxRedeemShares(address receiver) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| receiver | address | undefined |

### maxWithdraw

```solidity
function maxWithdraw(address owner) external view returns (uint256 maxAssets)
```

calculate the maximum quantity of base assets which may be withdrawn by given holder



#### Parameters

| Name | Type | Description |
|---|---|---|
| owner | address | holder of shares to be redeemed |

#### Returns

| Name | Type | Description |
|---|---|---|
| maxAssets | uint256 | maximum asset mint amount |

### mint

```solidity
function mint(uint256 shareAmount, address receiver) external nonpayable returns (uint256 assetAmount)
```

execute a minting of shares on behalf of given address



#### Parameters

| Name | Type | Description |
|---|---|---|
| shareAmount | uint256 | quantity of shares to mint |
| receiver | address | recipient of shares resulting from deposit |

#### Returns

| Name | Type | Description |
|---|---|---|
| assetAmount | uint256 | quantity of assets to deposit |

### option

```solidity
function option() external view returns (bool, uint256, uint256, address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |
| _1 | uint256 | undefined |
| _2 | uint256 | undefined |
| _3 | address | undefined |

### previewDeposit

```solidity
function previewDeposit(uint256 assetAmount) external view returns (uint256 shareAmount)
```

simulate a deposit of given quantity of assets



#### Parameters

| Name | Type | Description |
|---|---|---|
| assetAmount | uint256 | quantity of assets to deposit |

#### Returns

| Name | Type | Description |
|---|---|---|
| shareAmount | uint256 | quantity of shares to mint |

### previewMint

```solidity
function previewMint(uint256 shareAmount) external view returns (uint256 assetAmount)
```

simulate a minting of given quantity of shares



#### Parameters

| Name | Type | Description |
|---|---|---|
| shareAmount | uint256 | quantity of shares to mint |

#### Returns

| Name | Type | Description |
|---|---|---|
| assetAmount | uint256 | quantity of assets to deposit |

### previewRedeem

```solidity
function previewRedeem(uint256 shareAmount) external view returns (uint256 assetAmount)
```

simulate a redemption of given quantity of shares



#### Parameters

| Name | Type | Description |
|---|---|---|
| shareAmount | uint256 | quantity of shares to redeem |

#### Returns

| Name | Type | Description |
|---|---|---|
| assetAmount | uint256 | quantity of assets to withdraw |

### previewUnredeemedShares

```solidity
function previewUnredeemedShares(address account) external view returns (uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| account | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### previewUnredeemedSharesFromEpoch

```solidity
function previewUnredeemedSharesFromEpoch(uint256 epoch, uint256 balance) external view returns (uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| epoch | uint256 | undefined |
| balance | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### previewWithdraw

```solidity
function previewWithdraw(uint256 assetAmount) external view returns (uint256 shareAmount)
```

simulate a withdrawal of given quantity of assets



#### Parameters

| Name | Type | Description |
|---|---|---|
| assetAmount | uint256 | quantity of assets to withdraw |

#### Returns

| Name | Type | Description |
|---|---|---|
| shareAmount | uint256 | quantity of shares to redeem |

### pricePerShare

```solidity
function pricePerShare(uint256 epoch) external view returns (uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| epoch | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### processEpoch

```solidity
function processEpoch() external nonpayable
```






### redeem

```solidity
function redeem(uint256 shareAmount, address receiver, address owner) external nonpayable returns (uint256 assetAmount)
```

execute a redemption of shares on behalf of given address



#### Parameters

| Name | Type | Description |
|---|---|---|
| shareAmount | uint256 | quantity of shares to redeem |
| receiver | address | recipient of assets resulting from withdrawal |
| owner | address | holder of shares to be redeemed |

#### Returns

| Name | Type | Description |
|---|---|---|
| assetAmount | uint256 | quantity of assets to withdraw |

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

### totalAssets

```solidity
function totalAssets() external view returns (uint256)
```

get the total quantity of the base asset currently managed by the vault




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | total managed asset amount |

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

### totalQueuedAssets

```solidity
function totalQueuedAssets() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### totalSupply

```solidity
function totalSupply() external view returns (uint256)
```

query the total minted token supply




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | token supply |

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

### transfer

```solidity
function transfer(address recipient, uint256 amount) external nonpayable returns (bool)
```

transfer tokens to given recipient



#### Parameters

| Name | Type | Description |
|---|---|---|
| recipient | address | beneficiary of token transfer |
| amount | uint256 | quantity of tokens to transfer |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | success status (always true; otherwise function should revert) |

### transferFrom

```solidity
function transferFrom(address holder, address recipient, uint256 amount) external nonpayable returns (bool)
```

transfer tokens to given recipient on behalf of given holder



#### Parameters

| Name | Type | Description |
|---|---|---|
| holder | address | holder of tokens prior to transfer |
| recipient | address | beneficiary of token transfer |
| amount | uint256 | quantity of tokens to transfer |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | success status (always true; otherwise function should revert) |

### withdraw

```solidity
function withdraw(uint256 assetAmount, address receiver, address owner) external nonpayable returns (uint256 shareAmount)
```

execute a withdrawal of assets on behalf of given address



#### Parameters

| Name | Type | Description |
|---|---|---|
| assetAmount | uint256 | quantity of assets to withdraw |
| receiver | address | recipient of assets resulting from withdrawal |
| owner | address | holder of shares to be redeemed |

#### Returns

| Name | Type | Description |
|---|---|---|
| shareAmount | uint256 | quantity of shares to redeem |

### withdrawFromQueue

```solidity
function withdrawFromQueue(uint256 amount) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| amount | uint256 | undefined |

### withdrawReservedLiquidity

```solidity
function withdrawReservedLiquidity() external nonpayable
```








## Events

### Approval

```solidity
event Approval(address indexed owner, address indexed spender, uint256 value)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| owner `indexed` | address | undefined |
| spender `indexed` | address | undefined |
| value  | uint256 | undefined |

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

### Deposit

```solidity
event Deposit(address indexed caller, address indexed owner, uint256 assets, uint256 shares)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| caller `indexed` | address | undefined |
| owner `indexed` | address | undefined |
| assets  | uint256 | undefined |
| shares  | uint256 | undefined |

### Transfer

```solidity
event Transfer(address indexed from, address indexed to, uint256 value)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| from `indexed` | address | undefined |
| to `indexed` | address | undefined |
| value  | uint256 | undefined |

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

### Withdraw

```solidity
event Withdraw(address indexed caller, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| caller `indexed` | address | undefined |
| receiver `indexed` | address | undefined |
| owner `indexed` | address | undefined |
| assets  | uint256 | undefined |
| shares  | uint256 | undefined |



