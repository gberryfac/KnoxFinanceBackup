// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@solidstate/contracts/token/ERC20/metadata/ERC20MetadataStorage.sol";
import "@solidstate/contracts/token/ERC20/metadata/IERC20Metadata.sol";
import "@solidstate/contracts/token/ERC4626/base/ERC4626BaseStorage.sol";

import "./internal/BaseInternal.sol";

import "hardhat/console.sol";

contract Base is BaseInternal {
    using ERC20MetadataStorage for ERC20MetadataStorage.Layout;
    using ERC4626BaseStorage for ERC4626BaseStorage.Layout;
    using SafeERC20 for IERC20;
    using Storage for Storage.Layout;

    constructor(
        Storage.InitParams memory _initParams,
        Storage.InitProps memory _initProps
    ) {
        // // TODO: Validation
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
            Storage.Layout storage l = Storage.layout();
            PoolStorage.PoolSettings memory settings;

            settings = l.Pool.getPoolSettings();

            l.isCall = _initParams.isCall;
            l.asset = l.isCall ? settings.underlying : settings.base;
            asset = l.asset;

            l.baseDecimals = IERC20Metadata(settings.base).decimals();
            l.underlyingDecimals = IERC20Metadata(settings.underlying)
                .decimals();

            l.minimumContractSize = _initParams.minimumContractSize;
            l.minimumSupply = _initProps.minimumSupply;

            l.delta64x64 = _initParams.delta64x64;
            l.cap = _initProps.cap;

            l.performanceFee = _initProps.performanceFee;
            l.managementFee =
                (_initProps.managementFee * Constants.FEE_MULTIPLIER) /
                Constants.WEEKS_PER_YEAR;

            l.keeper = _initProps.keeper;
            l.feeRecipient = _initProps.feeRecipient;

            l.Pool = IPremiaPool(_initProps.pool);
            l.Pricer = IDeltaPricer(_initProps.pricer);

            l.ERC20 = IERC20(asset);
            l.Vault = IVault(address(this));

            l.startOffset = 2 hours;
            l.endOffset = 4 hours;
        }

        {
            ERC20MetadataStorage.Layout storage l =
                ERC20MetadataStorage.layout();

            l.setName(_initProps.name);
            l.setSymbol(_initProps.symbol);
            l.setDecimals(18);
        }

        {
            ERC4626BaseStorage.Layout storage l = ERC4626BaseStorage.layout();
            l.asset = asset;
        }
    }
}
