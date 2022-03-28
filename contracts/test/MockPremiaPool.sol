// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "abdk-libraries-solidity/ABDKMath64x64.sol";

import "hardhat/console.sol";

contract MockPremiaPool {
    using ABDKMath64x64 for int128;

    mapping(address => mapping(uint256 => uint256)) balances;

    uint256 internal constant UNDERLYING_RESERVED_LIQ_TOKEN_ID =
        0x0200000000000000000000000000000000000000000000000000000000000000;
    uint256 internal constant BASE_RESERVED_LIQ_TOKEN_ID =
        0x0300000000000000000000000000000000000000000000000000000000000000;
    uint256 internal constant LONG_TOKEN_ID = 8;
    uint256 internal constant SHORT_TOKEN_ID = 9;

    uint256 public underlyingDecimals;
    uint256 public baseDecimals;

    address public immutable asset;

    uint16 round;

    constructor(
        uint256 _underlyingDecimals,
        uint256 _baseDecimals,
        address _asset
    ) {
        underlyingDecimals = _underlyingDecimals;
        baseDecimals = _baseDecimals;
        asset = _asset;
        round = 0;
    }

    function writeFrom(
        address underwriter,
        address longReceiver,
        uint64 maturity,
        int128 _strike64x64,
        uint256 contractSize,
        bool isCall
    ) external payable returns (uint256 longTokenId, uint256 shortTokenId) {
        uint256 collateral = isCall
            ? contractSize
            : fromUnderlyingToBaseDecimals(_strike64x64, contractSize);

        IERC20(asset).transferFrom(msg.sender, address(this), collateral);

        balances[underwriter][SHORT_TOKEN_ID + round] += contractSize;
        balances[longReceiver][LONG_TOKEN_ID + round] += contractSize;

        return (LONG_TOKEN_ID + round, SHORT_TOKEN_ID + round);
    }

    function withdraw(uint256 amount, bool isCallPool) external {
        if (isCallPool) {
            balances[msg.sender][UNDERLYING_RESERVED_LIQ_TOKEN_ID] -= amount;
        } else {
            balances[msg.sender][BASE_RESERVED_LIQ_TOKEN_ID] -= amount;
        }

        IERC20(asset).transfer(msg.sender, amount);
    }

    function setDivestmentTimestamp(uint64 timestamp, bool isCallPool)
        external
    {}

    function balanceOf(address account, uint256 id)
        public
        view
        returns (uint256)
    {
        return balances[account][id];
    }

    function setRound(uint16 _round) public {
        round = _round;
    }

    function processExpired(
        address account,
        uint256 _shortBalance,
        uint256 _longBalance,
        bool isCall
    ) public {
        if (isCall) {
            balances[account][
                UNDERLYING_RESERVED_LIQ_TOKEN_ID
            ] += _shortBalance;
        } else {
            balances[account][BASE_RESERVED_LIQ_TOKEN_ID] += _shortBalance;
        }

        balances[account][SHORT_TOKEN_ID + round] = 0;
        balances[account][LONG_TOKEN_ID + round] = 0;

        IERC20(asset).transfer(account, _longBalance);
    }

    function fromUnderlyingToBaseDecimals(int128 _strike64x64, uint256 size)
        public
        view
        returns (uint256)
    {
        int128 value64x64 = ABDKMath64x64.divu(
            _strike64x64.mulu(size),
            10**baseDecimals
        );

        return value64x64.mulu(10**underlyingDecimals);
    }
}
