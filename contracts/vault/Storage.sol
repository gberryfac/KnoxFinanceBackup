// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../pricer/IPricer.sol";

import "../interfaces/IPremiaPool.sol";

import "../libraries/Constants.sol";

library Storage {
    /************************************************
     *  INITIALIZATION STRUCTS
     ***********************************************/

    struct InitParams {
        bool isCall;
        uint64 minimumContractSize;
        int128 delta64x64;
    }

    struct InitProps {
        uint64 minimumSupply;
        uint256 cap;
        uint256 performanceFee;
        uint256 withdrawalFee;
        string name;
        string symbol;
        address keeper;
        address feeRecipient;
        address pool;
        address pricer;
    }

    struct Option {
        // @notice Timestamp when the current option expires
        uint64 expiry;
        // @notice Strike price of the option as a 64x64 bit fixed point number
        int128 strike64x64;
        // @notice
        uint256 optionTokenId;
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
        // @notice Minimum amount of the underlying a strategy will sell
        uint64 minimumContractSize;
        // @notice Delta used to calculate strike price as a 64x64 bit fixed point number
        int128 delta64x64;
        // @notice maps epoch to option
        mapping(uint64 => Option) options;
        /************************************************
         * AUCTION PARAMETERS
         ***********************************************/
        // @notice
        uint16 startOffset;
        // @notice
        uint16 endOffset;
        // @notice
        uint256[2] saleWindow;
        /************************************************
         * VAULT ACCOUNTING
         ***********************************************/
        // @notice
        uint256 totalCollateralAssets;
        // @notice
        uint256 totalShortAssets;
        // @notice
        uint256 totalPremiums;
        // @notice
        uint256 totalDeposits;
        // @notice
        uint256 totalWithdrawals;
        /************************************************
         * VAULT STATE
         ***********************************************/
        // @notice
        uint64 epoch;
        // @notice
        uint256 claimTokenId;
        // @notice maps epoch to claim token price per share
        mapping(uint64 => uint256) pricePerShare;
        /************************************************
         * VAULT PROPERTIES
         ***********************************************/
        // @notice
        uint64 minimumSupply;
        // @notice
        uint256 cap;
        // @notice
        uint256 performanceFee;
        // @notice
        uint256 withdrawalFee;
        /************************************************
         * ACTORS
         ***********************************************/
        // @notice
        address keeper;
        // @notice
        address feeRecipient;
        /************************************************
         * EXTERNAL CONTRACTS
         ***********************************************/
        // @notice
        IPricer Pricer;
    }

    bytes32 internal constant LAYOUT_SLOT =
        keccak256("knox.contracts.vault.storage.layout");

    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = LAYOUT_SLOT;
        assembly {
            l.slot := slot
        }
    }

    /************************************************
     *  ADMIN
     ***********************************************/

    function _setFeeRecipient(address newFeeRecipient) internal {
        Layout storage l = layout();
        require(newFeeRecipient != address(0), "address not provided");
        require(newFeeRecipient != l.feeRecipient, "new address equals old");
        l.feeRecipient = newFeeRecipient;
    }

    function _setKeeper(address newKeeper) internal {
        Layout storage l = layout();
        require(newKeeper != address(0), "address not provided");
        require(newKeeper != l.keeper, "new address equals old");
        l.keeper = newKeeper;
    }

    function _setPricer(address newPricer) internal {
        Layout storage l = layout();
        require(newPricer != address(0), "address not provided");
        require(newPricer != address(l.Pricer), "new address equals old");
        l.Pricer = IPricer(newPricer);
    }

    function _setPerformanceFee(uint256 newPerformanceFee) internal {
        Layout storage l = layout();

        require(
            newPerformanceFee < 100 * Constants.FEE_MULTIPLIER,
            "invalid fee amount"
        );

        // emit PerformanceFeeSet(l.performanceFee, newPerformanceFee);

        l.performanceFee = newPerformanceFee;
    }

    function _setWithdrawalFee(uint256 newWithdrawalFee) internal {
        Layout storage l = layout();

        require(
            newWithdrawalFee < 100 * Constants.FEE_MULTIPLIER,
            "invalid fee amount"
        );

        // Divides annualized withdrawal fee by number of weeks in a year
        uint256 tmpWithdrawalFee =
            (newWithdrawalFee * Constants.FEE_MULTIPLIER) /
                Constants.WEEKS_PER_YEAR;

        // emit WithdrawalFeeSet(l.withdrawalFee, newWithdrawalFee);

        l.withdrawalFee = tmpWithdrawalFee;
    }

    function _setCap(uint256 newCap) internal {
        Layout storage l = layout();
        require(newCap > 0, "value exceeds minimum");

        // emit CapSet(l.cap, newCap);

        l.cap = newCap;
    }

    function _setAuctionWindowOffsets(uint16 start, uint16 end) internal {
        Layout storage l = layout();
        l.startOffset = start;
        l.endOffset = end;
    }

    /************************************************
     *  VIEW
     ***********************************************/

    function _totalDeposits() internal view returns (uint256) {
        Layout storage l = layout();
        return l.totalDeposits;
    }

    function _epoch() internal view returns (uint256) {
        Layout storage l = layout();
        return l.epoch;
    }

    function _pricePerShare(uint64 epoch) internal view returns (uint256) {
        Layout storage l = layout();
        return l.pricePerShare[epoch];
    }

    function _optionByEpoch(uint64 epoch)
        internal
        view
        returns (Option memory)
    {
        Layout storage l = layout();
        return l.options[epoch];
    }
}
