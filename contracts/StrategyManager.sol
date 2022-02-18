// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "hardhat/console.sol";
import {IKnoxStrategy} from "./interfaces/IKnoxStrategy.sol";
import {ITreasury} from "./FarmersTreasury.sol";

interface IVerifier {
    function verifySignature(bytes memory data, bytes memory signature)
        external
        returns (bool);

    function getTreasuryAddress(bytes memory signature)
        external
        returns (address);
}

struct PositionRecord {
    int32 epochId;
    uint64 positionSize;
    address treasury;
}

contract StrategyManager {
    address public owner;
    IVerifier public signatureVerifier;
    uint256 constant WEI_PER_UNIT = 10**9;
    mapping(address => IKnoxStrategy) public strategies; // mapping treausryAddress (in signature) => strategyLogicAddress
    mapping(address => PositionRecord[]) public openedPositions;

    mapping(address => mapping(int32 => uint64)) public totalPositionSize; // treasury address => epoch => totalPositionSize
    mapping(address => mapping(int32 => uint64)) public totalMMPayout; // treasury address => epoch => totalMMPayout

    constructor(address _signatureVerifier) {
        owner = msg.sender;
        signatureVerifier = IVerifier(_signatureVerifier);
    }

    function addOrUpdateStrategy(address treasury, address strategy) public {
        require(msg.sender == owner, "strategy-manager/not-allowed");
        strategies[treasury] = IKnoxStrategy(strategy);
    }

    function transferOwnership(address newOwner) public {
        require(msg.sender == owner, "strategy-manager/not-permitted");
        owner = newOwner;
    }

    function openPosition(
        uint256 premiumAmount,
        bytes memory strategyParameters,
        bytes memory strategyParametersSignature
    ) public {
        /* TODO: Add era period validation */
        uint64 normalizedPremiumAmount = uint64(premiumAmount / WEI_PER_UNIT);

        require(
            signatureVerifier.verifySignature(
                strategyParameters,
                strategyParametersSignature
            ),
            "strategy-manager/not-signed-parameters"
        );

        address treasuryAddress = signatureVerifier.getTreasuryAddress(
            strategyParametersSignature
        );

        uint64 positionSize = IKnoxStrategy(strategies[treasuryAddress])
            .getPositionSize(normalizedPremiumAmount, strategyParameters);
        ITreasury treasury = ITreasury(treasuryAddress);
        int32 epochId = treasury.currentEpoch();

        treasury.trustedBorrow(uint256(positionSize) * WEI_PER_UNIT);

        require(
            treasury.baseToken().transferFrom(
                msg.sender,
                address(this),
                positionSize
            ),
            "strategy-manager/premium-transfer-impossible"
        );
        bytes memory callData = abi.encodeWithSignature(
            "openPosition(bytes, bytes)",
            abi.encode(strategyParameters, normalizedPremiumAmount)
        );
        (bool status, ) = address(strategies[treasuryAddress]).delegatecall(
            callData
        );

        require(status, "strategy-manager/strategy-invocation-failed");

        openedPositions[msg.sender].push(
            PositionRecord(epochId, positionSize, address(treasury))
        );
        totalPositionSize[treasuryAddress][epochId] =
            totalPositionSize[treasuryAddress][epochId] +
            positionSize;
    }

    function settlePosition(address treasuryAddress) public {
        /*called once per strategy/treausery for era by administrator*/

        require(msg.sender == owner, "strategy-manager/not-permitted");
        ITreasury treasury = ITreasury(treasuryAddress);
        int32 epochId = treasury.currentEpoch();

        bytes memory callData = abi.encodeWithSignature("closePosition()");

        (bool status, bytes memory retVal) = address(
            strategies[treasuryAddress]
        ).delegatecall(callData);
        (uint64 payout, uint64 payback) = abi.decode(retVal, (uint64, uint64));

        IERC20 payoutToken = IERC20(treasury.baseToken());

        payoutToken.approve(treasuryAddress, uint256(payback) * WEI_PER_UNIT);

        treasury.trustedRepay(uint256(payback) * WEI_PER_UNIT);
        totalMMPayout[treasuryAddress][epochId] = payout;
    }

    function withdrawPayout(uint256 index) public {
        /*called independly by any MM to get payaout associated with position*/
        PositionRecord memory rec = openedPositions[msg.sender][index];

        uint64 totalPositionSize = totalPositionSize[rec.treasury][rec.epochId];
        uint64 totalPayout = totalMMPayout[rec.treasury][rec.epochId];

        uint64 payout = uint64(
            (uint256(rec.positionSize) * uint256(totalPayout)) /
                uint256(totalPositionSize)
        );

        ITreasury treasury = ITreasury(rec.treasury);
        IERC20 payoutToken = IERC20(treasury.baseToken());

        payoutToken.transfer(msg.sender, payout * WEI_PER_UNIT);
    }

    function startNewPeriod(address treasury) public {
        require(msg.sender == owner, "strategy-manager/not-permitted");
        ITreasury treasury = ITreasury(treasury);
        treasury.createNewEpoch();
    }
}
