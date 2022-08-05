// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@solidstate/contracts/access/ownable/OwnableStorage.sol";
import "@solidstate/contracts/proxy/upgradeable/UpgradeableProxyOwnable.sol";
import "@solidstate/contracts/proxy/upgradeable/UpgradeableProxyStorage.sol";

import "./AuctionStorage.sol";

contract AuctionProxy is UpgradeableProxyOwnable {
    using AuctionStorage for AuctionStorage.Layout;
    using OwnableStorage for OwnableStorage.Layout;
    using UpgradeableProxyStorage for UpgradeableProxyStorage.Layout;

    constructor(
        uint256 minSize,
        address implementation,
        address vault
    ) {
        AuctionStorage.Layout storage l = AuctionStorage.layout();
        l.vault = vault;
        l.minSize = minSize;

        OwnableStorage.layout().setOwner(msg.sender);
        UpgradeableProxyStorage.layout().setImplementation(implementation);
    }

    receive() external payable {}
}
