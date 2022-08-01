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
        // @notice Timestamp when the current option expires
        uint64 expiry;
        // @notice Strike price of the option as a 64x64 bit fixed point number
        int128 strike64x64;
        // @notice
        uint256 longTokenId;
        // @notice
        uint256 shortTokenId;
    }

    /************************************************
     *  LAYOUT
     ***********************************************/

    struct Layout {
        /************************************************
         * TOKEN PAIR PROPERTIES
         ***********************************************/
        // @notice Decimals for base asset used in vault
        uint8 baseDecimals;
        // @notice Decimals for underlying asset used in vault
        uint8 underlyingDecimals;
        /************************************************
         * OPTION PARAMETERS
         ***********************************************/
        // @notice Option type the vault is strategy
        bool isCall;
        // @notice Delta used to calculate strike price
        int128 delta64x64;
        // @notice Offset used to calculate offset strike price
        int128 deltaOffset64x64;
        // @notice maps epoch to option
        mapping(uint64 => Option) options;
        /************************************************
         * AUCTION PARAMETERS
         ***********************************************/
        // @notice
        uint64 startOffset;
        // @notice
        uint64 endOffset;
        // @notice
        uint256 startTime;
        // @notice
        uint256 endTime;
        /************************************************
         * VAULT STATE
         ***********************************************/
        // @notice
        uint64 epoch;
        // @notice
        uint256 totalCollateral;
        // @notice
        uint256 totalShortContracts;
        // @notice
        uint256 totalPremiums;
        /************************************************
         * VAULT PROPERTIES
         ***********************************************/
        // @notice
        int128 reserveRate64x64;
        // @notice
        int128 performanceFee64x64;
        // @notice
        int128 withdrawalFee64x64;
        // @notice
        address feeRecipient;
        /************************************************
         * EXTERNAL CONTRACTS
         ***********************************************/
        // @notice
        IAuction Auction;
        // @notice
        IQueue Queue;
        // @notice
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

    function _getEpoch(Layout storage l) internal view returns (uint64) {
        return l.epoch;
    }

    function _getOption(Layout storage l, uint64 epoch)
        internal
        view
        returns (Option memory)
    {
        return l.options[epoch];
    }
}
