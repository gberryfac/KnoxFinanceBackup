// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library QueueStorage {
    /************************************************
     *  LAYOUT
     ***********************************************/
    struct Layout {
        // @notice
        uint64 epoch;
        // @notice
        uint256 maxTVL;
        // @notice maps claim token id to claim token price
        mapping(uint256 => uint256) pricePerShare;
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
     *  VIEW
     ***********************************************/

    function _getCurrentTokenId(Layout storage l)
        internal
        view
        returns (uint256)
    {
        return _formatTokenId(_getEpoch(l));
    }

    function _getEpoch(Layout storage l) internal view returns (uint64) {
        return l.epoch;
    }

    function _getMaxTVL(Layout storage l) internal view returns (uint256) {
        return l.maxTVL;
    }

    function _getPricePerShare(Layout storage l, uint256 tokenId)
        internal
        view
        returns (uint256)
    {
        return l.pricePerShare[tokenId];
    }

    /************************************************
     * HELPERS
     ***********************************************/

    function _formatTokenId(uint64 epoch) internal view returns (uint256) {
        return (uint256(uint160(address(this))) << 64) + uint256(epoch);
    }

    function _parseTokenId(uint256 tokenId)
        internal
        pure
        returns (address, uint64)
    {
        address queue;
        uint64 epoch;

        assembly {
            queue := shr(64, tokenId)
            epoch := tokenId
        }

        return (queue, epoch);
    }
}
