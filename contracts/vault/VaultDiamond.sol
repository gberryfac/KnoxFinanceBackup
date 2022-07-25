// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@solidstate/contracts/proxy/diamond/SolidStateDiamond.sol";
import "@solidstate/contracts/token/ERC20/metadata/ERC20MetadataStorage.sol";
import "@solidstate/contracts/token/ERC20/metadata/IERC20Metadata.sol";
import "@solidstate/contracts/token/ERC4626/base/ERC4626BaseStorage.sol";

import "../access/AccessStorage.sol";

import "../interfaces/IPremiaPool.sol";

import "../libraries/Helpers.sol";

import "./VaultStorage.sol";

contract VaultDiamond is SolidStateDiamond {
    using AccessStorage for AccessStorage.Layout;
    using ERC20MetadataStorage for ERC20MetadataStorage.Layout;
    using ERC4626BaseStorage for ERC4626BaseStorage.Layout;
    using OwnableStorage for OwnableStorage.Layout;
    using VaultStorage for VaultStorage.Layout;

    constructor(VaultStorage.InitProxy memory initProxy) {
        // require(_initProps.pricer != address(0), "address not provided");

        // require(
        //     _initParams.delta64x64 >= 0x00000000000000000,
        //     "Exceeds minimum allowable value"
        // );

        // require(
        //     _initParams.delta64x64 <= 0x010000000000000000,
        //     "Exceeds maximum allowable value"
        // );

        address asset;

        {
            VaultStorage.Layout storage l = VaultStorage.layout();
            IPremiaPool.PoolSettings memory settings =
                IPremiaPool(initProxy.pool).getPoolSettings();

            l.isCall = initProxy.isCall;
            asset = l.isCall ? settings.underlying : settings.base;

            l.baseDecimals = IERC20Metadata(settings.base).decimals();
            l.underlyingDecimals = IERC20Metadata(settings.underlying)
                .decimals();

            l.delta64x64 = initProxy.delta64x64;
            l.deltaOffset64x64 = initProxy.deltaOffset64x64;

            l.reserveRate = initProxy.reserveRate;
            l.performanceFee = initProxy.performanceFee;
            l.withdrawalFee =
                (initProxy.withdrawalFee * VaultStorage.FEE_MULTIPLIER) /
                VaultStorage.WEEKS_PER_YEAR;

            l.feeRecipient = initProxy.feeRecipient;

            l.startOffset = 2 hours;
            l.endOffset = 4 hours;

            VaultStorage.Option storage option = l.options[l.epoch];
            option.expiry = uint64(Helpers._getFriday(block.timestamp));
        }

        {
            ERC20MetadataStorage.Layout storage l =
                ERC20MetadataStorage.layout();
            l.setName(initProxy.name);
            l.setSymbol(initProxy.symbol);
            l.setDecimals(18);
        }

        AccessStorage.layout().keeper = initProxy.keeper;
        ERC4626BaseStorage.layout().asset = asset;
        OwnableStorage.layout().setOwner(msg.sender);
    }
}
