# Vault









## Methods

### accountVaultBalance

```solidity
function accountVaultBalance(address account) external view returns (uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| account | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### allowance

```solidity
function allowance(address owner, address spender) external view returns (uint256)
```



*See {IERC20-allowance}.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| owner | address | undefined |
| spender | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### approve

```solidity
function approve(address spender, uint256 amount) external nonpayable returns (bool)
```



*See {IERC20-approve}. NOTE: If `amount` is the maximum `uint256`, the allowance is not updated on `transferFrom`. This is semantically equivalent to an infinite approval. Requirements: - `spender` cannot be the zero address.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| spender | address | undefined |
| amount | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |

### balanceOf

```solidity
function balanceOf(address account) external view returns (uint256)
```



*See {IERC20-balanceOf}.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| account | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### borrow

```solidity
function borrow(uint256 amount) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| amount | uint256 | undefined |

### completeWithdraw

```solidity
function completeWithdraw() external nonpayable
```

Completes a scheduled withdrawal from a past round. Uses finalized pps for the round




### decimals

```solidity
function decimals() external view returns (uint8)
```



*Returns the number of decimals used to get its user representation. For example, if `decimals` equals `2`, a balance of `505` tokens should be displayed to a user as `5.05` (`505 / 10 ** 2`). Tokens usually opt for a value of 18, imitating the relationship between Ether and Wei. This is the value {ERC20} uses, unless this function is overridden; NOTE: This information is only used for _display_ purposes: it in no way affects any of the arithmetic of the contract, including {IERC20-balanceOf} and {IERC20-transfer}.*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint8 | undefined |

### decreaseAllowance

```solidity
function decreaseAllowance(address spender, uint256 subtractedValue) external nonpayable returns (bool)
```



*Atomically decreases the allowance granted to `spender` by the caller. This is an alternative to {approve} that can be used as a mitigation for problems described in {IERC20-approve}. Emits an {Approval} event indicating the updated allowance. Requirements: - `spender` cannot be the zero address. - `spender` must have allowance for the caller of at least `subtractedValue`.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| spender | address | undefined |
| subtractedValue | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |

### deposit

```solidity
function deposit(uint256 amount) external nonpayable
```

Deposits the `asset` from msg.sender.



#### Parameters

| Name | Type | Description |
|---|---|---|
| amount | uint256 | is the amount of `asset` to deposit |

### depositETH

```solidity
function depositETH() external payable
```

Deposits ETH into the contract and mint vault shares. Reverts if the asset is not weth.




### depositFor

```solidity
function depositFor(uint256 amount, address creditor) external nonpayable
```

Deposits the `asset` from msg.sender added to `creditor`&#39;s deposit.Used for vault -&gt; vault deposits on the user&#39;s behalf



#### Parameters

| Name | Type | Description |
|---|---|---|
| amount | uint256 | is the amount of `asset` to deposit |
| creditor | address | is the address that can claim/withdraw deposited amount |

### depositReceipts

```solidity
function depositReceipts(address) external view returns (uint16 round, uint104 amount, uint128 unredeemedShares)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| round | uint16 | undefined |
| amount | uint104 | undefined |
| unredeemedShares | uint128 | undefined |

### feeRecipient

```solidity
function feeRecipient() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### harvest

```solidity
function harvest(uint256 expiry) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| expiry | uint256 | undefined |

### increaseAllowance

```solidity
function increaseAllowance(address spender, uint256 addedValue) external nonpayable returns (bool)
```



*Atomically increases the allowance granted to `spender` by the caller. This is an alternative to {approve} that can be used as a mitigation for problems described in {IERC20-approve}. Emits an {Approval} event indicating the updated allowance. Requirements: - `spender` cannot be the zero address.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| spender | address | undefined |
| addedValue | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |

### initialize

```solidity
function initialize(VaultSchema.InitParams _initParams, VaultSchema.VaultParams _vaultParams) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _initParams | VaultSchema.InitParams | undefined |
| _vaultParams | VaultSchema.VaultParams | undefined |

### initiateWithdraw

```solidity
function initiateWithdraw(uint256 numShares) external nonpayable
```

Initiates a withdrawal that can be processed once the round completes



#### Parameters

| Name | Type | Description |
|---|---|---|
| numShares | uint256 | is the number of shares to withdraw |

### keeper

```solidity
function keeper() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### lpPricePerShare

```solidity
function lpPricePerShare() external view returns (uint256)
```

The price of a unit of share denominated in the `asset`




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### lpShareBalances

```solidity
function lpShareBalances(address account) external view returns (uint256 heldByAccount, uint256 heldByVault)
```

Getter for returning the account&#39;s share balance split between account and vault holdings



#### Parameters

| Name | Type | Description |
|---|---|---|
| account | address | is the account to lookup share balance for |

#### Returns

| Name | Type | Description |
|---|---|---|
| heldByAccount | uint256 | is the shares held by account |
| heldByVault | uint256 | is the shares held on the vault (unredeemedShares) |

### lpShares

```solidity
function lpShares(address account) external view returns (uint256)
```

Getter for returning the account&#39;s share balance including unredeemed shares



#### Parameters

| Name | Type | Description |
|---|---|---|
| account | address | is the account to lookup share balance for |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | the share balance |

### lpTokenPricePerShare

```solidity
function lpTokenPricePerShare(uint256) external view returns (uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### managementFee

```solidity
function managementFee() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### maxRedeem

```solidity
function maxRedeem() external nonpayable
```

Redeems the entire unredeemedShares balance that is owed to the account




### name

```solidity
function name() external view returns (string)
```



*Returns the name of the token.*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | string | undefined |

### owner

```solidity
function owner() external view returns (address)
```



*Returns the address of the current owner.*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### pause

```solidity
function pause() external nonpayable
```

Pauses the vault during an emergency preventing deposits and borrowing.




### paused

```solidity
function paused() external view returns (bool)
```



*Returns true if the contract is paused, and false otherwise.*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |

### performanceFee

```solidity
function performanceFee() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### redeem

```solidity
function redeem(uint256 numShares) external nonpayable
```

Redeems shares that are owed to the account



#### Parameters

| Name | Type | Description |
|---|---|---|
| numShares | uint256 | is the number of shares to redeem |

### renounceOwnership

```solidity
function renounceOwnership() external nonpayable
```



*Leaves the contract without owner. It will not be possible to call `onlyOwner` functions anymore. Can only be called by the current owner. NOTE: Renouncing ownership will leave the contract without an owner, thereby removing any functionality that is only available to the owner.*


### setCap

```solidity
function setCap(uint256 newCap) external nonpayable
```

Sets a new cap for deposits



#### Parameters

| Name | Type | Description |
|---|---|---|
| newCap | uint256 | is the new cap for deposits |

### setFeeRecipient

```solidity
function setFeeRecipient(address newFeeRecipient) external nonpayable
```

Sets the new fee recipient



#### Parameters

| Name | Type | Description |
|---|---|---|
| newFeeRecipient | address | is the address of the new fee recipient |

### setKeeper

```solidity
function setKeeper(address newKeeper) external nonpayable
```

Sets the new keeper



#### Parameters

| Name | Type | Description |
|---|---|---|
| newKeeper | address | is the address of the new keeper |

### setManagementFee

```solidity
function setManagementFee(uint256 newManagementFee) external nonpayable
```

Sets the management fee for the vault



#### Parameters

| Name | Type | Description |
|---|---|---|
| newManagementFee | uint256 | is the management fee (6 decimals). ex: 2 * 10 ** 6 = 2% |

### setPerformanceFee

```solidity
function setPerformanceFee(uint256 newPerformanceFee) external nonpayable
```

Sets the performance fee for the vault



#### Parameters

| Name | Type | Description |
|---|---|---|
| newPerformanceFee | uint256 | is the performance fee (6 decimals). ex: 20 * 10 ** 6 = 20% |

### setStrategy

```solidity
function setStrategy(address newStrategy) external nonpayable
```

Sets the new strategy



#### Parameters

| Name | Type | Description |
|---|---|---|
| newStrategy | address | is the address of the new strategy |

### strategy

```solidity
function strategy() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### symbol

```solidity
function symbol() external view returns (string)
```



*Returns the symbol of the token, usually a shorter version of the name.*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | string | undefined |

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

### totalBalance

```solidity
function totalBalance() external view returns (uint256)
```

Returns the vault&#39;s total balance, including the amounts locked into a short position




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | total balance of the vault, including the amounts locked in third party protocols |

### totalSupply

```solidity
function totalSupply() external view returns (uint256)
```



*See {IERC20-totalSupply}.*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### transfer

```solidity
function transfer(address to, uint256 amount) external nonpayable returns (bool)
```



*See {IERC20-transfer}. Requirements: - `to` cannot be the zero address. - the caller must have a balance of at least `amount`.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| to | address | undefined |
| amount | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |

### transferFrom

```solidity
function transferFrom(address from, address to, uint256 amount) external nonpayable returns (bool)
```



*See {IERC20-transferFrom}. Emits an {Approval} event indicating the updated allowance. This is not required by the EIP. See the note at the beginning of {ERC20}. NOTE: Does not update the allowance if the current allowance is the maximum `uint256`. Requirements: - `from` and `to` cannot be the zero address. - `from` must have a balance of at least `amount`. - the caller must have allowance for ``from``&#39;s tokens of at least `amount`.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| from | address | undefined |
| to | address | undefined |
| amount | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |

### transferOwnership

```solidity
function transferOwnership(address newOwner) external nonpayable
```



*Transfers ownership of the contract to a new account (`newOwner`). Can only be called by the current owner.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| newOwner | address | undefined |

### unpause

```solidity
function unpause() external nonpayable
```

Unpauses the vault during following an emergency allowing deposits and borrowing.




### vaultParams

```solidity
function vaultParams() external view returns (uint8 decimals, uint56 minimumSupply, uint104 cap, address asset)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| decimals | uint8 | undefined |
| minimumSupply | uint56 | undefined |
| cap | uint104 | undefined |
| asset | address | undefined |

### vaultState

```solidity
function vaultState() external view returns (uint16 round, uint104 lockedCollateral, uint128 queuedDeposits, uint128 queuedWithdrawShares, uint128 queuedWithdrawals, uint256 lastTotalCapital, uint256 expiry)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| round | uint16 | undefined |
| lockedCollateral | uint104 | undefined |
| queuedDeposits | uint128 | undefined |
| queuedWithdrawShares | uint128 | undefined |
| queuedWithdrawals | uint128 | undefined |
| lastTotalCapital | uint256 | undefined |
| expiry | uint256 | undefined |

### weth

```solidity
function weth() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### withdrawInstantly

```solidity
function withdrawInstantly(uint256 amount) external nonpayable
```

Withdraws the assets on the vault using the outstanding `DepositReceipt.amount`



#### Parameters

| Name | Type | Description |
|---|---|---|
| amount | uint256 | is the amount to withdraw |

### withdrawals

```solidity
function withdrawals(address) external view returns (uint16 round, uint128 shares)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| round | uint16 | undefined |
| shares | uint128 | undefined |



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

### OwnershipTransferred

```solidity
event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| previousOwner `indexed` | address | undefined |
| newOwner `indexed` | address | undefined |

### Paused

```solidity
event Paused(address account)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| account  | address | undefined |

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

### Unpaused

```solidity
event Unpaused(address account)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| account  | address | undefined |

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



