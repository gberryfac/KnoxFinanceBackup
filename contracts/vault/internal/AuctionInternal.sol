// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "abdk-libraries-solidity/ABDKMath64x64.sol";

// import "../../interfaces/IDelta.sol";
// import "../../interfaces/IPricer.sol";

import "./BaseInternal.sol";

abstract contract AuctionInternal is BaseInternal {
    using ABDKMath64x64 for int128;
    using ABDKMath64x64 for uint256;
    using SafeERC20 for IERC20;
    using Storage for Storage.Layout;

    constructor(bool isCall, address pool) BaseInternal(isCall, pool) {}

    /************************************************
     *  INPUT/OUTPUT
     ***********************************************/

    function _purchase(uint256 contractSize) internal {
        // require(
        //     contractSize >= option.minimumContractSize,
        //     Errors.CONTRACT_SIZE_EXCEEDS_MINIMUM
        // );
        // TODO: query price curve to get premium
        // TODO: require(premium <= maxCost, "slippage too high!");
        // TODO: Asset.safeTransferFrom(
        //     msg.sender,
        //     address(Vault),
        //     premium.mulu(contractSize)
        // );
        //     uint256 amount = option.isCall
        //         ? contractSize
        //         : _fromUnderlyingtoBaseDecimals(
        //             option.strike64x64.mulu(contractSize),
        //             assetProperties
        //         );
        //     // TODO: Change to '_underwrite' function
        //     _borrow(amount);
        //     Asset.approve(address(Pool), amount);
        //     (uint256 longTokenId, ) = Pool.writeFrom(
        //         address(Vault),
        //         msg.sender,
        //         option.expiry,
        //         option.strike64x64,
        //         contractSize,
        //         option.isCall
        //     );
        //     emit Sold(msg.sender, contractSize, longTokenId);
        //     Pool.setDivestmentTimestamp(option.expiry, option.isCall);
    }

    function _exercise(
        address holder,
        uint256 longTokenId,
        uint256 contractSize
    ) internal {
        Storage.Layout storage l = Storage.layout();
        Pool.exerciseFrom(holder, longTokenId, contractSize);
    }

    /************************************************
     * HELPERS
     ***********************************************/

    // // /**
    // //  * @notice adjusts precision of value to base decimals
    // //  * @param value is the amount denominated in the underlying asset decimals
    // //  * @param assetProperties is a struct containing the underlying and asset decimals
    // //  */
    // function _fromUnderlyingtoBaseDecimals(uint256 value)
    //     internal
    //     view
    //     returns (uint256)
    // {
    //     Storage.Layout storage l = Storage.layout();
    //     int128 value64x64 = value.divu(10**l.underlyingDecimals);
    //     return value64x64.mulu(10**l.baseDecimals);
    // }
}
