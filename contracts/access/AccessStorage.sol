// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library AccessStorage {
    /************************************************
     *  LAYOUT
     ***********************************************/

    struct Layout {
        address keeper;
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

    /************************************************
     *  VIEW
     ***********************************************/

    function _getKeeper(Layout storage l) internal view returns (address) {
        return l.keeper;
    }
}
