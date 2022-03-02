// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "abdk-libraries-solidity/ABDKMath64x64.sol";

import "./../interfaces/IPoolIO.sol";
import "./../interfaces/IPoolWrite.sol";
import "./../interfaces/IRegistry.sol";
import "./../interfaces/IStrategy.sol";
import "./../interfaces/IVault.sol";

import "hardhat/console.sol";

contract ThetaDecay {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    address public owner;

    IRegistry public immutable registry;

    constructor(address _registry) {
        registry = IRegistry(_registry);
    }

    // TODO: make contract initializable

    function purchase(
        bytes memory signature,
        uint256 deadline,
        uint256 maturity,
        uint256 strikePrice,
        uint256 spotPrice,
        uint256 premium,
        uint256 size,
        bool isCall
    ) public {
        // require(
        //     registry.authenticate(
        //         signature,
        //         deadline,
        //         maturity,
        //         strikePrice,
        //         spotPrice,
        //         premium,
        //         isCall
        //     ),
        //     "controller/invalid-signature"
        // );
        // uint256 positionSize = premium.mul(size);
        // baseToken.safeTransferFrom(msg.sender, address(this), positionSize);
        // TODO: Move to Vault ^^^
        // require that balanceOf(address(this)) >= positionSize
        // int128 strike64x64 = ABDKMath64x64.fromUInt(strikePrice);
        // IPoolWrite(poolWrite).writeFrom(
        //     msg.sender,
        //     msg.sender,
        //     uint64(maturity),
        //     strike64x64,
        //     size,
        //     isCall
        // );
        // IPoolIO(poolIO).setDivestmentTimestamp(1, isCall);
        // underwrite option
        // short pToken - Vault
        // long pToken - Strategy
        // register short and long token id's
        // wrap long pToken with kToken
        // send kToken to buyer
    }

    // /*called independly by any MM to get payout associated with position*/
    function closePosition() public {
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
    }

    // function setStrategy(address _strategy) public {
    //     // TODO: Add timelock
    //     require(msg.sender == owner, "controller/not-permitted");
    //     strategy = IStrategy(_strategy);
    // }

    // function setRegistry() public {}

    // function setTimelock() public {}

    // function processExpired(uint256 longTokenId, uint256 contractSize) public {
    // for emergencies only
    // calls IPoolExercise.processExpired for a long pToken
    // }
}
