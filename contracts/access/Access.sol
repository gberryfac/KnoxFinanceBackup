// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@solidstate/contracts/utils/ReentrancyGuard.sol";

import "./AccessInternal.sol";

contract Access is AccessInternal, ReentrancyGuard {
    /**
     * @dev Throws if called by any account other than the keeper.
     */
    modifier onlyKeeper() {
        AccessStorage.Layout storage l = AccessStorage.layout();
        require(msg.sender == l.keeper, "!keeper");
        _;
    }

    /**
     * @dev Throws if called by any account other than the vault.
     */
    modifier onlyVault() {
        AccessStorage.Layout storage l = AccessStorage.layout();
        require(msg.sender == l.vault, "!vault");
        _;
    }

    /************************************************
     *  SAFETY
     ***********************************************/

    /**
     * @notice Pauses the vault during an emergency preventing deposits and borrowing.
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpauses the vault during following an emergency allowing deposits and borrowing.
     */
    function unpause() external onlyOwner {
        _unpause();
    }
}
