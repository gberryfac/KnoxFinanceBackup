# IVault









## Methods

### ERC20

```solidity
function ERC20() external view returns (contract IERC20)
```

gets the collateral asset ERC20 interface




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IERC20 | ERC20 interface |

### Pool

```solidity
function Pool() external view returns (contract IPremiaPool)
```

gets the pool interface




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IPremiaPool | pool interface |

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

### collectPerformanceFee

```solidity
function collectPerformanceFee() external nonpayable
```

collects performance fees on epoch net income




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

### getEpoch

```solidity
function getEpoch() external view returns (uint64)
```

gets the current epoch




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint64 | current epoch id |

### getExerciseAmount

```solidity
function getExerciseAmount(uint64 epoch, uint256 size) external view returns (bool, uint256)
```

calculates the exercise amount



#### Parameters

| Name | Type | Description |
|---|---|---|
| epoch | uint64 | epoch id |
| size | uint256 | amount of contracts |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |
| _1 | uint256 | undefined |

### getOption

```solidity
function getOption(uint64 epoch) external view returns (struct VaultStorage.Option)
```

gets the option by epoch id



#### Parameters

| Name | Type | Description |
|---|---|---|
| epoch | uint64 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | VaultStorage.Option | option parameters |

### initalizeNextEpoch

```solidity
function initalizeNextEpoch() external nonpayable
```

initializes the next epoch




### initialize

```solidity
function initialize(VaultStorage.InitImpl initImpl) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| initImpl | VaultStorage.InitImpl | undefined |

### initializeAuction

```solidity
function initializeAuction() external nonpayable
```

initializes auction




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

### processAuction

```solidity
function processAuction() external nonpayable
```

processes the auction when it has been finalized




### processLastEpoch

```solidity
function processLastEpoch() external nonpayable
```

withdraws reserved liquidity and collects performance fees




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

### setAndInitializeAuction

```solidity
function setAndInitializeAuction() external nonpayable
```

sets the option parameters and initializes auction




### setAuctionPrices

```solidity
function setAuctionPrices() external nonpayable
```

calculates and sets the auction prices




### setAuctionWindowOffsets

```solidity
function setAuctionWindowOffsets(uint16 newStartOffset, uint16 newEndOffset) external nonpayable
```

sets the auction window offsets



#### Parameters

| Name | Type | Description |
|---|---|---|
| newStartOffset | uint16 | new start offset |
| newEndOffset | uint16 | new end offset |

### setFeeRecipient

```solidity
function setFeeRecipient(address newFeeRecipient) external nonpayable
```

sets the new fee recipient



#### Parameters

| Name | Type | Description |
|---|---|---|
| newFeeRecipient | address | address of the new fee recipient |

### setKeeper

```solidity
function setKeeper(address newKeeper) external nonpayable
```

sets the new keeper



#### Parameters

| Name | Type | Description |
|---|---|---|
| newKeeper | address | address of the new keeper |

### setOptionParameters

```solidity
function setOptionParameters() external nonpayable
```

sets the parameters for the next option to be sold




### setPerformanceFee64x64

```solidity
function setPerformanceFee64x64(int128 newPerformanceFee64x64) external nonpayable
```

sets the performance fee for the vault



#### Parameters

| Name | Type | Description |
|---|---|---|
| newPerformanceFee64x64 | int128 | performance fee as a 64x64 fixed point number |

### setPricer

```solidity
function setPricer(address newPricer) external nonpayable
```

sets the new pricer



#### Parameters

| Name | Type | Description |
|---|---|---|
| newPricer | address | address of the new pricer |

### setWithdrawalFee64x64

```solidity
function setWithdrawalFee64x64(int128 newWithdrawalFee64x64) external nonpayable
```

sets the withdrawal fee for the vault



#### Parameters

| Name | Type | Description |
|---|---|---|
| newWithdrawalFee64x64 | int128 | withdrawal fee as a 64x64 fixed point number |

### totalAssets

```solidity
function totalAssets() external view returns (uint256)
```

get the total quantity of the base asset currently managed by the vault




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | total managed asset amount |

### totalCollateral

```solidity
function totalCollateral() external view returns (uint256)
```

gets the total vault collateral




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | total vault collateral |

### totalPremiums

```solidity
function totalPremiums() external view returns (uint256)
```

gets the total premiums of the epoch




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | total premiums |

### totalReserves

```solidity
function totalReserves() external view returns (uint256)
```

gets the total reserved collateral




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | total reserved collateral |

### totalShortAsCollateral

```solidity
function totalShortAsCollateral() external view returns (uint256)
```

gets the short position value denominated in the collateral asset




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | total short position in collateral amount |

### totalShortAsContracts

```solidity
function totalShortAsContracts() external view returns (uint256)
```

gets the amount in short contracts underwitten by the vault in the last epoch




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | total short contracts |

### totalSupply

```solidity
function totalSupply() external view returns (uint256)
```

query the total minted token supply




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

### withdrawReservedLiquidity

```solidity
function withdrawReservedLiquidity() external nonpayable
```

transfers reserved liquidity from pool to vault






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

### AuctionProcessed

```solidity
event AuctionProcessed(uint64 indexed epoch, uint256 totalCollateralUsed, uint256 totalContractsSold)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| epoch `indexed` | uint64 | undefined |
| totalCollateralUsed  | uint256 | undefined |
| totalContractsSold  | uint256 | undefined |

### AuctionWindowOffsetsSet

```solidity
event AuctionWindowOffsetsSet(uint64 indexed epoch, uint256 oldStartOffset, uint256 newStartOffset, uint256 oldEndOffset, uint256 newEndOffset, address caller)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| epoch `indexed` | uint64 | undefined |
| oldStartOffset  | uint256 | undefined |
| newStartOffset  | uint256 | undefined |
| oldEndOffset  | uint256 | undefined |
| newEndOffset  | uint256 | undefined |
| caller  | address | undefined |

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

### Distributions

```solidity
event Distributions(uint64 indexed epoch, uint256 collateralAmountSansFee, uint256 shortContractsSansFee)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| epoch `indexed` | uint64 | undefined |
| collateralAmountSansFee  | uint256 | undefined |
| shortContractsSansFee  | uint256 | undefined |

### FeeRecipientSet

```solidity
event FeeRecipientSet(uint64 indexed epoch, address oldFeeRecipient, address newFeeRecipient, address caller)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| epoch `indexed` | uint64 | undefined |
| oldFeeRecipient  | address | undefined |
| newFeeRecipient  | address | undefined |
| caller  | address | undefined |

### KeeperSet

```solidity
event KeeperSet(uint64 indexed epoch, address oldKeeper, address newKeeper, address caller)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| epoch `indexed` | uint64 | undefined |
| oldKeeper  | address | undefined |
| newKeeper  | address | undefined |
| caller  | address | undefined |

### OptionParametersSet

```solidity
event OptionParametersSet(uint64 indexed epoch, uint64 expiry, int128 strike64x64, uint256 longTokenId, uint256 shortTokenId)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| epoch `indexed` | uint64 | undefined |
| expiry  | uint64 | undefined |
| strike64x64  | int128 | undefined |
| longTokenId  | uint256 | undefined |
| shortTokenId  | uint256 | undefined |

### PerformanceFeeCollected

```solidity
event PerformanceFeeCollected(uint64 indexed epoch, uint256 netIncome, uint256 totalPremiums, uint256 exerciseAmount, uint256 feeInCollateral)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| epoch `indexed` | uint64 | undefined |
| netIncome  | uint256 | undefined |
| totalPremiums  | uint256 | undefined |
| exerciseAmount  | uint256 | undefined |
| feeInCollateral  | uint256 | undefined |

### PerformanceFeeSet

```solidity
event PerformanceFeeSet(uint64 indexed epoch, int128 oldPerformanceFee, int128 newPerformanceFee, address caller)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| epoch `indexed` | uint64 | undefined |
| oldPerformanceFee  | int128 | undefined |
| newPerformanceFee  | int128 | undefined |
| caller  | address | undefined |

### PricerSet

```solidity
event PricerSet(uint64 indexed epoch, address oldPricer, address newPricer, address caller)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| epoch `indexed` | uint64 | undefined |
| oldPricer  | address | undefined |
| newPricer  | address | undefined |
| caller  | address | undefined |

### ReservedLiquidityWithdrawn

```solidity
event ReservedLiquidityWithdrawn(uint64 indexed epoch, uint256 amount)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| epoch `indexed` | uint64 | undefined |
| amount  | uint256 | undefined |

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

### WithdrawalFeeCollected

```solidity
event WithdrawalFeeCollected(uint64 indexed epoch, uint256 feeInCollateral, uint256 feeInShortContracts)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| epoch `indexed` | uint64 | undefined |
| feeInCollateral  | uint256 | undefined |
| feeInShortContracts  | uint256 | undefined |

### WithdrawalFeeSet

```solidity
event WithdrawalFeeSet(uint64 indexed epoch, int128 oldWithdrawalFee, int128 newWithdrawalFee, address caller)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| epoch `indexed` | uint64 | undefined |
| oldWithdrawalFee  | int128 | undefined |
| newWithdrawalFee  | int128 | undefined |
| caller  | address | undefined |



