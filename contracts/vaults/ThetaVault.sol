// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./../interfaces/IPremiaPool.sol";

import "./BaseVault.sol";

import "hardhat/console.sol";

contract ThetaVault is BaseVault {
    mapping(uint256 => uint256) public roundByLongTokenId;
    mapping(uint256 => Payout) public payouts;

    uint256 private constant UNDERLYING_RESERVED_LIQ_TOKEN_ID =
        0x0200000000000000000000000000000000000000000000000000000000000000;
    uint256 private constant BASE_RESERVED_LIQ_TOKEN_ID =
        0x0300000000000000000000000000000000000000000000000000000000000000;

    address public immutable pool;

    struct Payout {
        uint256 longTokenId;
        uint256 amount;
        int128 pricePerShare;
    }

    /************************************************
     *  CONSTRUCTOR
     ***********************************************/

    constructor(
        address _pool,
        address _weth,
        address _registry
    ) BaseVault(_weth, _registry) {
        require(_pool != address(0), VaultErrors.ADDRESS_NOT_PROVIDED);
        pool = _pool;
    }

    // TODO: ADD INIT FUNCTION

    function purchase(
        bytes memory signature,
        uint64 deadline,
        uint64 maturity,
        int128 strike64x64,
        int128 premium64x64,
        uint256 contractSize,
        bool isCall
    ) external nonReentrant returns (uint256 longTokenId) {
        uint256 liquidityRequired = _openPosition(
            signature,
            deadline,
            maturity,
            strike64x64,
            premium64x64,
            contractSize,
            isCall
        );

        IERC20(vaultParams.asset).approve(pool, liquidityRequired);

        (longTokenId, ) = IPremiaPool(pool).writeFrom(
            address(this),
            address(this),
            maturity,
            strike64x64,
            contractSize,
            isCall
        );

        IPremiaPool(pool).setDivestmentTimestamp(maturity, isCall);

        uint256 round = vaultState.round;
        Payout memory payout = payouts[round];

        if (payout.longTokenId == 0) {
            require(
                roundByLongTokenId[longTokenId] == 0,
                "LongTokenId used in previous round"
            );

            roundByLongTokenId[longTokenId] = round;

            payout.longTokenId = longTokenId;
            payouts[round] = payout;
        }

        require(
            payout.longTokenId == longTokenId,
            "token id does not match round token id"
        );

        vaultState.lockedCollateral += uint104(liquidityRequired);

        _mint(msg.sender, longTokenId, contractSize, "");
    }

    function closePosition(
        address account,
        uint256 longTokenId,
        uint256 shares
    ) external nonReentrant {
        uint256 round = roundByLongTokenId[longTokenId];
        Payout memory payout = payouts[round];

        uint256 amount = ABDKMath64x64.mulu(payout.pricePerShare, shares);

        require(payout.amount > 0, VaultErrors.CLAIM_NOT_FOUND);

        require(
            amount <= payout.amount,
            VaultErrors.CLAIM_AMOUNT_EXCEEDS_BALANCE
        );

        payout.amount -= amount;
        vaultState.queuedPayouts -= uint128(amount);

        payouts[round] = payout;

        _burn(account, longTokenId, shares);

        _transferAsset(account, amount);
    }

    function harvest() external nonReentrant onlyKeeper {
        require(
            block.timestamp >= vaultState.expiry,
            VaultErrors.VAULT_ROUND_NOT_CLOSED
        );

        bool isCall = vaultParams.isCall;

        uint256 balanceBefore = IERC20(vaultParams.asset).balanceOf(
            address(this)
        );

        uint256 reservedLiquidity = IPremiaPool(pool).balanceOf(
            address(this),
            isCall
                ? UNDERLYING_RESERVED_LIQ_TOKEN_ID
                : BASE_RESERVED_LIQ_TOKEN_ID
        );

        IPremiaPool(pool).withdraw(reservedLiquidity, isCall);

        uint256 balanceAfter = IERC20(vaultParams.asset).balanceOf(
            address(this)
        );

        uint256 liquidatedShortPosition = balanceAfter - balanceBefore;

        uint256 liquidatedLongPosition = vaultState.lockedCollateral -
            liquidatedShortPosition;

        if (liquidatedLongPosition > 0) {
            vaultState.queuedPayouts += uint128(liquidatedLongPosition);

            uint256 round = vaultState.round;
            Payout memory payout = payouts[round];

            payout.amount = liquidatedLongPosition;
            payout.pricePerShare = ABDKMath64x64.divu(
                liquidatedLongPosition,
                totalSupply(payout.longTokenId)
            );

            payouts[round] = payout;
        }

        _rollover();
    }
}
