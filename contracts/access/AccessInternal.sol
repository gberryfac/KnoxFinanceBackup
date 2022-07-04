// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@solidstate/contracts/access/ownable/OwnableInternal.sol";
import "@solidstate/contracts/security/PausableInternal.sol";

import "./AccessStorage.sol";

contract AccessInternal is OwnableInternal, PausableInternal {
    /**
     * @dev Throws if called by any account other than the keeper.
     */
    modifier onlyKeeper() {
        AccessStorage.Layout storage l = AccessStorage.layout();
        require(msg.sender == l.keeper, "!keeper");
        _;
    }

    /**
     * @dev Throws if called by any account other than the queue.
     */
    modifier onlyQueue() {
        AccessStorage.Layout storage l = AccessStorage.layout();
        require(msg.sender == l.queue, "!queue");
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
}
