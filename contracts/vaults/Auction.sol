// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@solidstate/contracts/token/ERC20/metadata/IERC20Metadata.sol";
import "@solidstate/contracts/utils/ReentrancyGuard.sol";
import "@solidstate/contracts/utils/SafeERC20.sol";

import "abdk-libraries-solidity/ABDKMath64x64.sol";

import {IPremiaPool, PoolStorage} from "./../interfaces/IPremiaPool.sol";
import "./../interfaces/IDeltaPricer.sol";

import "./internal/AuctionInternal.sol";

contract Auction is AuctionInternal, ReentrancyGuard {
    using ABDKMath64x64 for int128;
    using ABDKMath64x64 for uint256;
    using SafeERC20 for IERC20;
    using Storage for Storage.Layout;

    /************************************************
     *  INITIALIZATION
     ***********************************************/

    /**
     * @notice Initializes the vault contract with storage variables.
     * @dev Vault contracts must be deployed and initialized.
     */
    function initialize(
        bool _isCall,
        uint64 _minimumContractSize,
        int128 _delta64x64,
        address _pricer
    ) external onlyOwner {
        require(_pricer != address(0), "address not provided");

        require(
            _delta64x64 >= 0x00000000000000000,
            "Exceeds minimum allowable value"
        );

        require(
            _delta64x64 <= 0x010000000000000000,
            "Exceeds maximum allowable value"
        );

        PoolStorage.PoolSettings memory settings;

        Storage.Layout storage l = Storage.layout();
        settings = l.Pool.getPoolSettings();

        l.baseDecimals = IERC20Metadata(settings.base).decimals();
        l.underlyingDecimals = IERC20Metadata(settings.underlying).decimals();

        l.isCall = _isCall;
        l.minimumContractSize = _minimumContractSize;

        l.delta64x64 = _delta64x64;

        l.Pricer = IDeltaPricer(_pricer);

        l.startOffset = 2 hours;
        l.endOffset = 4 hours;
    }

    /************************************************
     *  INPUT/OUTPUT
     ***********************************************/

    /**
     * @notice Initiates the option sale
     */
    function purchase(uint256 contractSize, uint256 maxCost)
        external
        isActive
        nonReentrant
    {
        _purchase(contractSize);
    }

    /**
     * @notice Exercises In-The-Money options
     */
    function exercise(
        address holder,
        uint256 longTokenId,
        uint256 contractSize
    ) external nonReentrant {
        _exercise(holder, longTokenId, contractSize);
    }

    /************************************************
     * VIEW
     ***********************************************/

    // TODO: Move to Storage.sol
    function accountsByOption(uint256 id)
        external
        view
        returns (address[] memory)
    {
        Storage.Layout storage l = Storage.layout();
        return l.Pool.accountsByToken(id);
    }

    // TODO: Move to Storage.sol
    function optionsByAccount(address account)
        external
        view
        returns (uint256[] memory)
    {
        Storage.Layout storage l = Storage.layout();
        return l.Pool.tokensByAccount(account);
    }
}
