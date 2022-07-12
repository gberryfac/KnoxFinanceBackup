// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@solidstate/contracts/access/ownable/OwnableInternal.sol";
import "@solidstate/contracts/security/PausableInternal.sol";

import "../Storage.sol";

// TODO: Inherit Timelock protection
abstract contract AccessInternal is OwnableInternal, PausableInternal {
    using Storage for Storage.Layout;

    /**
     * @dev Throws if auction is not active.
     */
    modifier auctionActive() {
        Storage.Layout storage l = Storage.layout();
        require(l.startTime <= block.timestamp, "auction has not started!");
        require(l.endTime >= block.timestamp, "auction has ended!");
        _;
    }

    /**
     * @dev Throws if auction is active.
     */
    modifier auctionInactive() {
        Storage.Layout storage l = Storage.layout();
        require(l.startTime >= block.timestamp, "auction has started!");
        require(l.endTime <= block.timestamp, "auction has not ended!");
        _;
    }

    /**
     * @dev Throws if called prior to option expiration.
     */
    modifier isExpired() {
        Storage.Layout storage l = Storage.layout();
        Storage.Option memory option = l.options[l.epoch];
        require(block.timestamp >= option.expiry, "Option has not expired!");
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
