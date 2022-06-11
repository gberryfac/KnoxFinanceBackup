# IVault









## Methods

### borrow

```solidity
function borrow(uint256 liquidityRequired) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| liquidityRequired | uint256 | undefined |

### completeWithdraw

```solidity
function completeWithdraw() external nonpayable
```






### deposit

```solidity
function deposit(uint256 amount) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| amount | uint256 | undefined |

### depositETH

```solidity
function depositETH() external payable
```






### depositFor

```solidity
function depositFor(uint256 amount, address creditor) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| amount | uint256 | undefined |
| creditor | address | undefined |

### harvest

```solidity
function harvest(uint256 expiry) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| expiry | uint256 | undefined |

### initiateWithdraw

```solidity
function initiateWithdraw(uint256 numShares) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| numShares | uint256 | undefined |

### maxRedeem

```solidity
function maxRedeem() external nonpayable
```






### redeem

```solidity
function redeem(uint256 numShares) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| numShares | uint256 | undefined |

### sync

```solidity
function sync(uint256 expiry) external nonpayable returns (address)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| expiry | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### withdrawInstantly

```solidity
function withdrawInstantly(uint256 amount) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| amount | uint256 | undefined |



## Events

### CapSet

```solidity
event CapSet(uint256 oldCap, uint256 newCap)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| oldCap  | uint256 | undefined |
| newCap  | uint256 | undefined |

### CollectVaultFees

```solidity
event CollectVaultFees(uint256 performanceFee, uint256 vaultFee, uint256 round, address indexed feeRecipient)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| performanceFee  | uint256 | undefined |
| vaultFee  | uint256 | undefined |
| round  | uint256 | undefined |
| feeRecipient `indexed` | address | undefined |

### Deposit

```solidity
event Deposit(address indexed account, uint256 amount, uint256 round)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| account `indexed` | address | undefined |
| amount  | uint256 | undefined |
| round  | uint256 | undefined |

### InitiateWithdraw

```solidity
event InitiateWithdraw(address indexed account, uint256 shares, uint256 round)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| account `indexed` | address | undefined |
| shares  | uint256 | undefined |
| round  | uint256 | undefined |

### InstantWithdraw

```solidity
event InstantWithdraw(address indexed account, uint256 amount, uint256 round)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| account `indexed` | address | undefined |
| amount  | uint256 | undefined |
| round  | uint256 | undefined |

### ManagementFeeSet

```solidity
event ManagementFeeSet(uint256 managementFee, uint256 newManagementFee)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| managementFee  | uint256 | undefined |
| newManagementFee  | uint256 | undefined |

### PerformanceFeeSet

```solidity
event PerformanceFeeSet(uint256 performanceFee, uint256 newPerformanceFee)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| performanceFee  | uint256 | undefined |
| newPerformanceFee  | uint256 | undefined |

### Redeem

```solidity
event Redeem(address indexed account, uint256 share, uint256 round)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| account `indexed` | address | undefined |
| share  | uint256 | undefined |
| round  | uint256 | undefined |

### Withdraw

```solidity
event Withdraw(address indexed account, uint256 amount, uint256 shares)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| account `indexed` | address | undefined |
| amount  | uint256 | undefined |
| shares  | uint256 | undefined |



