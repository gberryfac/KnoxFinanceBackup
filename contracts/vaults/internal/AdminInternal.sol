// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@solidstate/contracts/access/ownable/OwnableInternal.sol";
import "@solidstate/contracts/security/PausableInternal.sol";

import "./../VaultStorage.sol";

// TODO: Inherit Timelock protection
abstract contract AdminInternal is OwnableInternal, PausableInternal {
    using VaultStorage for VaultStorage.Layout;

    /**
     * @dev Throws if called by any account other than authorized accounts.
     */
    modifier onlyAuthorized() {
        VaultStorage.Layout storage l = VaultStorage.layout();
        require(
            msg.sender == l.strategy || msg.sender == l.keeper,
            "unauthorized"
        );
        _;
    }

    /**
     * @dev Throws if called by any account other than the keeper.
     */
    modifier onlyKeeper() {
        VaultStorage.Layout storage l = VaultStorage.layout();
        require(msg.sender == l.keeper, "!keeper");
        _;
    }

    /**
     * @dev Throws if called by any account other than the strategy.
     */
    modifier onlyStrategy() {
        VaultStorage.Layout storage l = VaultStorage.layout();
        require(msg.sender == l.strategy, "!strategy");
        _;
    }

    /**
     * @dev Throws if called prior to option expiration.
     */
    modifier isExpired() {
        VaultStorage.Layout storage l = VaultStorage.layout();
        require(block.timestamp >= l.expiry, "Option has not expired!");
        _;
    }
}
