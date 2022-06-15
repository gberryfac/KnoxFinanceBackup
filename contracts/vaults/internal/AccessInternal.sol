// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@solidstate/contracts/access/ownable/OwnableInternal.sol";
import "@solidstate/contracts/security/PausableInternal.sol";

import "./../Storage.sol";

// TODO: Inherit Timelock protection
abstract contract AccessInternal is OwnableInternal, PausableInternal {
    using Storage for Storage.Layout;

    /**
     * @dev Throws if purchase window is not active.
     */
    modifier isActive() {
        Storage.Layout storage l = Storage.layout();
        require(l.saleWindow[0] <= block.timestamp, "Sale has not started!");
        require(l.saleWindow[1] >= block.timestamp, "Sale has ended!");
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

    /**
     * @dev Throws if called by any account other than the keeper.
     */
    modifier onlyKeeper() {
        Storage.Layout storage l = Storage.layout();
        require(msg.sender == l.keeper, "!keeper");
        _;
    }
}
