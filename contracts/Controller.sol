// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./interfaces/IRegistry.sol";
import "./interfaces/IStrategy.sol";
import "./interfaces/IVault.sol";

import "hardhat/console.sol";

struct PositionRecord {
    int32 epochId;
    uint64 positionSize;
    address vault;
}

contract Controller {
    address public owner;
    IRegistry public signatureVerifier;
    uint256 constant WEI_PER_UNIT = 10**9;
    // mapping treausryAddress (in signature) => strategyLogicAddress
    mapping(address => IStrategy) public strategies;
    mapping(address => PositionRecord[]) public openedPositions;
    // vault address => epoch => totalPositionSize
    mapping(address => mapping(int32 => uint64)) public totalPositionSize;
    // vault address => epoch => totalMMPayout
    mapping(address => mapping(int32 => uint64)) public totalMMPayout;

    constructor(address _signatureVerifier) {
        owner = msg.sender;
        signatureVerifier = IRegistry(_signatureVerifier);
    }

    function addOrUpdateStrategy(address vault, address strategy) public {
        require(msg.sender == owner, "strategy-manager/not-allowed");
        strategies[vault] = IStrategy(strategy);
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
            signatureVerifier.authenticate(
                strategyParameters,
                strategyParametersSignature
            ),
            "strategy-manager/not-signed-parameters"
        );

        address treasuryAddress = signatureVerifier.getTreasuryAddress(
            strategyParametersSignature
        );

        uint64 positionSize = IStrategy(strategies[treasuryAddress])
            .getPositionSize(normalizedPremiumAmount, strategyParameters);
        IVault vault = IVault(treasuryAddress);
        int32 epochId = vault.currentEpoch();

        vault.trustedBorrow(uint256(positionSize) * WEI_PER_UNIT);

        require(
            vault.baseToken().transferFrom(
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
            PositionRecord(epochId, positionSize, address(vault))
        );
        totalPositionSize[treasuryAddress][epochId] =
            totalPositionSize[treasuryAddress][epochId] +
            positionSize;
    }

    function settlePosition(address treasuryAddress) public {
        /*called once per strategy/treausery for era by administrator*/

        require(msg.sender == owner, "strategy-manager/not-permitted");
        IVault vault = IVault(treasuryAddress);
        int32 epochId = vault.currentEpoch();

        bytes memory callData = abi.encodeWithSignature("closePosition()");

        (, bytes memory retVal) = address(strategies[treasuryAddress])
            .delegatecall(callData);
        (uint64 payout, uint64 payback) = abi.decode(retVal, (uint64, uint64));

        IERC20 payoutToken = IERC20(vault.baseToken());

        payoutToken.approve(treasuryAddress, uint256(payback) * WEI_PER_UNIT);

        vault.trustedRepay(uint256(payback) * WEI_PER_UNIT);
        totalMMPayout[treasuryAddress][epochId] = payout;
    }

    function withdrawPayout(uint256 index) public {
        /*called independly by any MM to get payaout associated with position*/
        PositionRecord memory rec = openedPositions[msg.sender][index];

        uint64 positionSize = totalPositionSize[rec.vault][rec.epochId];
        uint64 totalPayout = totalMMPayout[rec.vault][rec.epochId];

        uint64 payout = uint64(
            (uint256(rec.positionSize) * uint256(totalPayout)) /
                uint256(positionSize)
        );

        IVault vault = IVault(rec.vault);
        IERC20 payoutToken = IERC20(vault.baseToken());

        payoutToken.transfer(msg.sender, payout * WEI_PER_UNIT);
    }

    function startNewPeriod(address vaultAddress) public {
        require(msg.sender == owner, "strategy-manager/not-permitted");
        IVault vault = IVault(vaultAddress);
        vault.createNewEpoch();
    }
}
