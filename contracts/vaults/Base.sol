// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@solidstate/contracts/token/ERC20/metadata/ERC20MetadataStorage.sol";
import "@solidstate/contracts/token/ERC4626/base/ERC4626BaseStorage.sol";

import "./../libraries/Constants.sol";

import "./internal/BaseInternal.sol";

import "hardhat/console.sol";

contract Base is BaseInternal {
    using ERC20MetadataStorage for ERC20MetadataStorage.Layout;
    using ERC4626BaseStorage for ERC4626BaseStorage.Layout;
    using SafeERC20 for IERC20;
    using Storage for Storage.Layout;

    /************************************************
     *  INITIALIZATION
     ***********************************************/

    function initializeVault(
        Storage.InitParams memory _initParams,
        Storage.InitProps memory _initProps,
        address _keeper,
        address _feeRecipient,
        address _strategy
    ) external onlyOwner {
        {
            Storage.Layout storage l = Storage.layout();

            l.minimumSupply = _initProps.minimumSupply;
            l.cap = _initProps.cap;

            l.performanceFee = _initProps.performanceFee;
            l.managementFee =
                (_initProps.managementFee * Constants.FEE_MULTIPLIER) /
                Constants.WEEKS_PER_YEAR;

            l.asset = _initParams.asset;
            l.isCall = _initParams.isCall;

            l.keeper = _keeper;
            l.feeRecipient = _feeRecipient;
            l.strategy = _strategy;

            l.Pool = IPremiaPool(_initParams.pool);
            l.ERC20 = IERC20(_initParams.asset);
        }

        {
            ERC20MetadataStorage.Layout storage l =
                ERC20MetadataStorage.layout();

            l.setName(_initParams.name);
            l.setSymbol(_initParams.symbol);
            l.setDecimals(18);
        }

        {
            ERC4626BaseStorage.Layout storage l = ERC4626BaseStorage.layout();
            l.asset = _initParams.asset;
        }
    }
}
