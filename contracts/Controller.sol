// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "./interfaces/IRegistry.sol";
import "./interfaces/IStrategy.sol";
import "./interfaces/IVault.sol";

import "hardhat/console.sol";

contract Controller {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    address public owner;

    IVault public immutable vault;
    IERC20 public immutable baseToken;
    IRegistry public immutable registry;
    IStrategy public strategy;

    constructor(
        address _vault,
        address _registry,
        address _strategy
    ) {
        owner = msg.sender;
        vault = IVault(_vault);
        baseToken = vault.baseToken();
        registry = IRegistry(_registry);
        strategy = IStrategy(_strategy);
    }

    function openPosition(
        bytes memory signature,
        uint256 deadline,
        uint256 maturity,
        uint256 strikePrice,
        uint256 spotPrice,
        uint256 premium,
        uint256 size,
        bool isCall
    ) public {
        require(
            registry.authenticate(
                bytes memory signature,
                uint256 deadline,
                uint256 maturity
                uint256 strikePrice,
                uint256 spotPrice,
                uint256 premium,
                bool isCall
            ),
            "controller/invalid-signature"
        );

        uint256 positionSize = premium.mul(size);
        baseToken.safeTransferFrom(msg.sender, address(this), positionSize);
        vault.borrow(positionSize);

        bytes memory callData = abi.encodeWithSignature(
            "openPosition(uint256 maturity, uint256 strikePrice, uint256 size, bool isCall)",
            abi.encode(maturity, strikePrice, size, isCall)
        );

        (bool status, ) = address(strategy).delegatecall(callData);
        require(status, "controller/strategy-invocation-failed");
    }

    // function settlePosition(address treasuryAddress) public {
    //     require(msg.sender == owner, "controller/not-permitted");
    //     IVault vault = IVault(treasuryAddress);
    //     int32 epochId = vault.currentEpoch();

    //     bytes memory callData = abi.encodeWithSignature("closePosition()");

    //     (, bytes memory retVal) = address(strategies[treasuryAddress])
    //         .delegatecall(callData);
    //     (uint64 payout, uint64 payback) = abi.decode(retVal, (uint64, uint64));

    //     IERC20 payoutToken = IERC20(vault.baseToken());

    //     payoutToken.approve(treasuryAddress, uint256(payback) * WEI_PER_UNIT);

    //     vault.repay(uint256(payback) * WEI_PER_UNIT);
    //     totalMMPayout[treasuryAddress][epochId] = payout;
    // }

    // /*called independly by any MM to get payout associated with position*/
    // function withdrawPayout(uint256 index) public {
    //     PositionRecord memory rec = openedPositions[msg.sender][index];

    //     uint64 positionSize = totalPositionSize[rec.vault][rec.epochId];
    //     uint64 totalPayout = totalMMPayout[rec.vault][rec.epochId];

    //     uint64 payout = uint64(
    //         (uint256(rec.positionSize) * uint256(totalPayout)) /
    //             uint256(positionSize)
    //     );

    //     IVault vault = IVault(rec.vault);
    //     IERC20 payoutToken = IERC20(vault.baseToken());

    //     payoutToken.transfer(msg.sender, payout * WEI_PER_UNIT);
    // }

    // function setStrategy(address _strategy) public {
    //     // TODO: Add timelock
    //     require(msg.sender == owner, "controller/not-permitted");
    //     strategy = IStrategy(_strategy);
    // }

    // function setRegistry() public {

    // }

    // function setTimelock() public {

    // }
}
