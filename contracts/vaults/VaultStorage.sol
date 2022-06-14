// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@solidstate/contracts/token/ERC20/IERC20.sol";
import "@solidstate/contracts/token/ERC1155/IERC1155.sol";
import "@solidstate/contracts/utils/SafeERC20.sol";

import "./../interfaces/IPremiaPool.sol";
import "./../interfaces/IQueue.sol";

import "./../libraries/Constants.sol";
import "./../libraries/Errors.sol";

library VaultStorage {
    using SafeERC20 for IERC20;

    /************************************************
     *  INITIALIZATION STRUCTS
     ***********************************************/

    struct InitParams {
        bool isCall;
        string name;
        string symbol;
        address asset;
        address pool;
    }

    struct InitProps {
        uint64 minimumSupply;
        uint256 cap;
        uint256 managementFee;
        uint256 performanceFee;
    }

    /************************************************
     *  LAYOUT
     ***********************************************/

    struct Layout {
        // @notice Option type the vault is strategy
        bool isCall;
        // @notice Timestamp when the current option expires
        uint256 expiry;
        // @notice
        uint256 tokenId;
        // @notice Asset held in vault
        address asset;
        // @notice
        uint256 epoch;
        // @notice
        uint256 totalQueuedAssets;
        // @notice
        uint256 lastTotalAssets;
        // @notice
        uint64 minimumSupply;
        // @notice
        uint256 cap;
        // @notice
        uint256 managementFee;
        // @notice
        uint256 performanceFee;
        // @notice
        address keeper;
        // @notice
        address feeRecipient;
        // @notice
        address strategy;
        // @notice
        mapping(uint256 => uint256) pricePerShare;
        IQueue Queue;
        IPremiaPool Pool;
        IERC20 ERC20;
    }

    bytes32 internal constant LAYOUT_SLOT =
        keccak256("knox.contracts.storage.layout");

    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = LAYOUT_SLOT;
        assembly {
            l.slot := slot
        }
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
            uint256,
            address
        )
    {
        Layout storage l = layout();
        return (l.isCall, l.expiry, l.tokenId, l.asset);
    }

    /************************************************
     *  ADMIN
     ***********************************************/

    function _setFeeRecipient(address newFeeRecipient) internal {
        Layout storage l = layout();
        require(newFeeRecipient != address(0), Errors.ADDRESS_NOT_PROVIDED);
        require(
            newFeeRecipient != l.feeRecipient,
            Errors.NEW_ADDRESS_EQUALS_OLD
        );

        l.feeRecipient = newFeeRecipient;
    }

    function _setKeeper(address newKeeper) internal {
        Layout storage l = layout();
        require(newKeeper != address(0), Errors.ADDRESS_NOT_PROVIDED);
        require(newKeeper != l.keeper, Errors.NEW_ADDRESS_EQUALS_OLD);
        l.keeper = newKeeper;
    }

    function _setStrategy(address newStrategy) internal {
        Layout storage l = layout();
        require(newStrategy != address(0), Errors.ADDRESS_NOT_PROVIDED);
        require(newStrategy != l.strategy, Errors.NEW_ADDRESS_EQUALS_OLD);
        l.strategy = newStrategy;
    }

    function _setManagementFee(uint256 newManagementFee) internal {
        Layout storage l = layout();

        require(
            newManagementFee < 100 * Constants.FEE_MULTIPLIER,
            Errors.INVALID_FEE_AMOUNT
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
            Errors.INVALID_FEE_AMOUNT
        );

        // emit PerformanceFeeSet(l.performanceFee, newPerformanceFee);

        l.performanceFee = newPerformanceFee;
    }

    function _setCap(uint256 newCap) internal {
        Layout storage l = layout();
        require(newCap > 0, Errors.VALUE_EXCEEDS_MINIMUM);

        // emit CapSet(l.cap, newCap);

        l.cap = newCap;
    }
}
