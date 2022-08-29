// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../auction/IAuction.sol";

import "../pricer/IPricer.sol";

import "../queue/IQueue.sol";

library VaultStorage {
    /************************************************
     *  INITIALIZATION STRUCTS
     ***********************************************/

    struct InitProxy {
        bool isCall;
        int128 delta64x64;
        int128 deltaOffset64x64;
        int128 reserveRate64x64;
        int128 performanceFee64x64;
        int128 withdrawalFee64x64;
        string name;
        string symbol;
        address keeper;
        address feeRecipient;
        address pool;
    }

    struct InitImpl {
        address auction;
        address queue;
        address pricer;
    }

    struct Option {
        uint64 expiry;
        int128 strike64x64;
        uint256 longTokenId;
        uint256 shortTokenId;
    }

    /************************************************
     *  LAYOUT
     ***********************************************/

    struct Layout {
        /************************************************
         * TOKEN PAIR PROPERTIES
         ***********************************************/
        uint8 baseDecimals;
        uint8 underlyingDecimals;
        /************************************************
         * OPTION PARAMETERS
         ***********************************************/
        bool isCall;
        int128 delta64x64;
        int128 deltaOffset64x64;
        mapping(uint64 => Option) options;
        /************************************************
         * AUCTION PARAMETERS
         ***********************************************/
        uint64 startOffset;
        uint64 endOffset;
        /************************************************
         * VAULT STATE
         ***********************************************/
        uint64 epoch;
        uint256 totalPremiums;
        /************************************************
         * VAULT PROPERTIES
         ***********************************************/
        int128 reserveRate64x64;
        int128 performanceFee64x64;
        int128 withdrawalFee64x64;
        address feeRecipient;
        address keeper;
        /************************************************
         * EXTERNAL CONTRACTS
         ***********************************************/
        IAuction Auction;
        IQueue Queue;
        IPricer Pricer;
    }

    bytes32 internal constant LAYOUT_SLOT =
        keccak256("knox.contracts.storage.Vault");

    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = LAYOUT_SLOT;
        assembly {
            l.slot := slot
        }
    }

    /************************************************
     *  VIEW
     ***********************************************/

    function _getEpoch() internal view returns (uint64) {
        return layout().epoch;
    }

    function _getOption(uint64 epoch) internal view returns (Option memory) {
        return layout().options[epoch];
    }
}
