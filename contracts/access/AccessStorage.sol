// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library AccessStorage {
    /************************************************
     *  LAYOUT
     ***********************************************/

    struct Layout {
        address keeper;
        address queue;
        address vault;
    }

    bytes32 internal constant LAYOUT_SLOT =
        keccak256("knox.contracts.storage.Access");

    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = LAYOUT_SLOT;
        assembly {
            l.slot := slot
        }
    }

    /************************************************
     *  ADMIN
     ***********************************************/

    function _setKeeper(Layout storage l, address newKeeper) internal {
        require(newKeeper != address(0), "address not provided");
        require(newKeeper != l.keeper, "new address equals old");
        l.keeper = newKeeper;
    }

    function _setQueue(Layout storage l, address newQueue) internal {
        require(newQueue != address(0), "address not provided");
        require(newQueue != l.queue, "new address equals old");
        l.queue = newQueue;
    }

    function _setVault(Layout storage l, address newVault) internal {
        require(newVault != address(0), "address not provided");
        require(newVault != l.vault, "new address equals old");
        l.vault = newVault;
    }

    /************************************************
     *  VIEW
     ***********************************************/

    function _getKeeper(Layout storage l) internal view returns (address) {
        return l.keeper;
    }

    function _getQueue(Layout storage l) internal view returns (address) {
        return l.queue;
    }

    function _getVault(Layout storage l) internal view returns (address) {
        return l.vault;
    }
}
