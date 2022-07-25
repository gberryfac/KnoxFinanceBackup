// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../auction/IAuction.sol";

import "../pricer/IPricer.sol";

import "../queue/IQueue.sol";

library VaultStorage {
    // @notice Fees are 6-decimal places. For example: 20 * 10**6 = 20%
    uint256 internal constant FEE_MULTIPLIER = 10**6;

    // @notice Number of weeks per year = 52.142857 weeks * FEE_MULTIPLIER = 52142857.
    // Dividing by weeks per year requires doing num.mul(FEE_MULTIPLIER).div(WEEKS_PER_YEAR)
    uint256 internal constant WEEKS_PER_YEAR = 52142857;

    /************************************************
     *  INITIALIZATION STRUCTS
     ***********************************************/

    struct InitProxy {
        bool isCall;
        int128 delta64x64;
        int128 deltaOffset64x64;
        int128 reserveRate;
        uint256 performanceFee;
        uint256 withdrawalFee;
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
        uint256 totalShort;
        // @notice
        uint256 totalPremiums;
        /************************************************
         * VAULT PROPERTIES
         ***********************************************/
        // @notice
        int128 reserveRate;
        // @notice
        uint256 performanceFee;
        // @notice
        uint256 withdrawalFee;
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
     *  SETTERS
     ***********************************************/

    function _setFeeRecipient(Layout storage l, address newFeeRecipient)
        internal
    {
        require(newFeeRecipient != address(0), "address not provided");
        require(newFeeRecipient != l.feeRecipient, "new address equals old");
        l.feeRecipient = newFeeRecipient;
    }

    function _setPricer(Layout storage l, address newPricer) internal {
        require(newPricer != address(0), "address not provided");
        require(newPricer != address(l.Pricer), "new address equals old");
        l.Pricer = IPricer(newPricer);
    }

    function _setPerformanceFee(Layout storage l, uint256 newPerformanceFee)
        internal
    {
        require(newPerformanceFee < 100 * FEE_MULTIPLIER, "invalid fee amount");

        // emit PerformanceFeeSet(l.performanceFee, newPerformanceFee);

        l.performanceFee = newPerformanceFee;
    }

    function _setWithdrawalFee(Layout storage l, uint256 newWithdrawalFee)
        internal
    {
        require(newWithdrawalFee < 100 * FEE_MULTIPLIER, "invalid fee amount");

        // Divides annualized withdrawal fee by number of weeks in a year
        uint256 tmpWithdrawalFee =
            (newWithdrawalFee * FEE_MULTIPLIER) / WEEKS_PER_YEAR;

        // emit WithdrawalFeeSet(l.withdrawalFee, newWithdrawalFee);

        l.withdrawalFee = tmpWithdrawalFee;
    }

    function _setAuctionWindowOffsets(
        Layout storage l,
        uint16 start,
        uint16 end
    ) internal {
        l.startOffset = start;
        l.endOffset = end;
    }

    /************************************************
     *  VIEW
     ***********************************************/

    function _getEpoch(Layout storage l) internal view returns (uint64) {
        return l.epoch;
    }

    function _optionByEpoch(Layout storage l, uint64 epoch)
        internal
        view
        returns (Option memory)
    {
        return l.options[epoch];
    }
}
