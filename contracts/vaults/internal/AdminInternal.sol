// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@solidstate/contracts/access/ownable/OwnableInternal.sol";
import "@solidstate/contracts/security/PausableInternal.sol";

import "./../Storage.sol";

// TODO: Inherit Timelock protection
abstract contract AdminInternal is OwnableInternal, PausableInternal {
    using Storage for Storage.Layout;

    /**
     * @dev Throws if called by any account other than authorized accounts.
     */
    modifier onlyAuthorized() {
        Storage.Layout storage l = Storage.layout();
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
        Storage.Layout storage l = Storage.layout();
        require(msg.sender == l.keeper, "!keeper");
        _;
    }

    /**
     * @dev Throws if called by any account other than the strategy.
     */
    modifier onlyStrategy() {
        Storage.Layout storage l = Storage.layout();
        require(msg.sender == l.strategy, "!strategy");
        _;
    }

    /**
     * @dev Throws if called prior to option expiration.
     */
    modifier isExpired() {
        Storage.Layout storage l = Storage.layout();
        require(block.timestamp >= l.expiry, "Option has not expired!");
        _;
    }
}
