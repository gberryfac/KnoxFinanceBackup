// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../auction/IDutchAuction.sol";

import "../pricer/IPricer.sol";

import "../interfaces/IPremiaPool.sol";

import "../libraries/Constants.sol";

library QueueStorage {
    /************************************************
     *  LAYOUT
     ***********************************************/

    struct Layout {
        // @notice
        uint64 epoch;
        // @notice maps claim token id to claim token price
        mapping(uint256 => uint256) pricePerShare;
        // @notice
        uint256 maxTVL;
    }

    bytes32 internal constant LAYOUT_SLOT =
        keccak256("knox.contracts.storage.Queue");

    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = LAYOUT_SLOT;
        assembly {
            l.slot := slot
        }
    }

    /************************************************
     *  ADMIN
     ***********************************************/

    function _setMaxTVL(Layout storage l, uint256 newMaxTVL) internal {
        require(newMaxTVL > 0, "value exceeds minimum");
        l.maxTVL = newMaxTVL;
        // emit MaxTVLSet(l.maxTVL, newMaxTVL);
    }

    /************************************************
     *  VIEW
     ***********************************************/

    function _epoch(Layout storage l) internal view returns (uint64) {
        return l.epoch;
    }

    function _maxTVL(Layout storage l) internal view returns (uint256) {
        return l.maxTVL;
    }

    function _pricePerShare(Layout storage l, uint64 epoch)
        internal
        view
        returns (uint256)
    {
        return l.pricePerShare[epoch];
    }
}
