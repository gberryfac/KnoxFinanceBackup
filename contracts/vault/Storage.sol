// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@solidstate/contracts/token/ERC20/IERC20.sol";
import "@solidstate/contracts/utils/SafeERC20.sol";

import "../pricer/IPricer.sol";

import "../interfaces/IPremiaPool.sol";

import "../libraries/Constants.sol";

library Storage {
    using SafeERC20 for IERC20;

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
        uint256 managementFee;
        uint256 performanceFee;
        string name;
        string symbol;
        address keeper;
        address feeRecipient;
        address pool;
        address pricer;
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
        // @notice Timestamp when the current option expires
        uint64 expiry;
        // @notice Delta used to calculate strike price as a 64x64 bit fixed point number
        int128 delta64x64;
        // @notice Strike price of the option as a 64x64 bit fixed point number
        int128 strike64x64;
        // @notice
        uint256 optionTokenId;
        // // @notice Asset held in vault
        // address asset;
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
         * VAULT STATE
         ***********************************************/
        // @notice
        uint64 epoch;
        // @notice
        uint256 claimTokenId;
        // @notice
        uint256 totalQueuedAssets;
        // @notice
        uint256 lastTotalAssets;
        // @notice
        mapping(uint256 => uint256) pricePerShare;
        /************************************************
         * VAULT PROPERTIES
         ***********************************************/
        // @notice
        uint256 cap;
        // @notice
        uint256 managementFee;
        // @notice
        uint64 minimumSupply;
        // @notice
        uint256 performanceFee;
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
        // // @notice
        // IERC20 ERC20;
        // // @notice
        // IPremiaPool Pool;
        // // @notice
        // IVault Vault;
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

    // TODO:
    function _setPricer(address newPricer) internal {}

    function _setManagementFee(uint256 newManagementFee) internal {
        Layout storage l = layout();

        require(
            newManagementFee < 100 * Constants.FEE_MULTIPLIER,
            "invalid fee amount"
        );

        // We are dividing annualized management fee by num weeks in a year
        uint256 tmpManagementFee =
            (newManagementFee * Constants.FEE_MULTIPLIER) /
                Constants.WEEKS_PER_YEAR;

        // emit ManagementFeeSet(l.managementFee, newManagementFee);

        l.managementFee = tmpManagementFee;
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

    function _totalQueuedAssets() internal view returns (uint256) {
        Layout storage l = layout();
        return l.totalQueuedAssets;
    }

    function _epoch() internal view returns (uint256) {
        Layout storage l = layout();
        return l.epoch;
    }

    function _pricePerShare(uint256 epoch) internal view returns (uint256) {
        Layout storage l = layout();
        return l.pricePerShare[epoch];
    }

    function _option()
        internal
        view
        returns (
            bool,
            uint256,
            uint256
        )
    {
        Layout storage l = layout();
        return (l.isCall, l.expiry, l.optionTokenId);
    }

    // function _accountsByOption(uint256 id)
    //     external
    //     view
    //     returns (address[] memory)
    // {
    //     Layout storage l = layout();
    //     return Pool.accountsByToken(id);
    // }

    // function _optionsByAccount(address account)
    //     external
    //     view
    //     returns (uint256[] memory)
    // {
    //     Layout storage l = layout();
    //     return Pool.tokensByAccount(account);
    // }
}
