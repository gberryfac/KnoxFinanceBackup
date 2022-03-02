// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

abstract contract RibbonThetaVaultStorageV1 {
    // Amount locked for scheduled withdrawals last week;
    uint256 public lastQueuedWithdrawAmount;
}

// We are following Compound's method of upgrading new contract implementations
// When we need to add new storage variables, we create a new version of RibbonThetaVaultStorage

// e.g. RibbonThetaVaultStorage<versionNumber>, so finally it would look like
// contract RibbonThetaVaultStorage is RibbonThetaVaultStorageV1, RibbonThetaVaultStorageV2
abstract contract RibbonThetaVaultStorage is RibbonThetaVaultStorageV1 {

}
