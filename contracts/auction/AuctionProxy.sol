// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@solidstate/contracts/access/ownable/OwnableStorage.sol";
import "@solidstate/contracts/proxy/upgradeable/UpgradeableProxyOwnable.sol";
import "@solidstate/contracts/proxy/upgradeable/UpgradeableProxyStorage.sol";

import "../access/AccessStorage.sol";

contract AuctionProxy is UpgradeableProxyOwnable {
    using AccessStorage for AccessStorage.Layout;
    using OwnableStorage for OwnableStorage.Layout;
    using UpgradeableProxyStorage for UpgradeableProxyStorage.Layout;

    constructor(address implementation, address vault) {
        AccessStorage.layout().vault = vault;
        OwnableStorage.layout().setOwner(msg.sender);
        UpgradeableProxyStorage.layout().setImplementation(implementation);
    }

    receive() external payable {}
}
