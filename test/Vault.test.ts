import { ethers, network } from "hardhat";
import { BigNumber, Contract } from "ethers";

const { getContractFactory, provider } = ethers;
const { parseUnits, parseEther } = ethers.utils;

import { Vault, Vault__factory } from "./../types";

import { expect } from "chai";
import moment from "moment-timezone";

import * as assets from "./helpers/assets";
import * as time from "./helpers/time";
import * as fixtures from "./helpers/fixtures";
import * as types from "./helpers/types";

import { assert } from "./helpers/assertions";

import {
  ADDRESS_ZERO,
  ADDRESS_ONE,
  TEST_URI,
  FEE_SCALING,
  SECONDS_PER_WEEK,
  WEEKS_PER_YEAR,
  BLOCK_NUMBER,
  NEXT_FRIDAY,
} from "../constants";

const chainId = network.config.chainId;

moment.tz.setDefault("UTC");

let block;
describe("Vault Unit Tests", () => {
  behavesLikeOptionsVault({
    name: `Knox ETH Delta Vault (Put)`,
    tokenName: `Knox ETH Delta Vault`,
    tokenSymbol: `kETH-DELTA-P`,
    tokenDecimals: 18,
    asset: assets.DAI,
    pool: assets.PREMIA.WETH_DAI,
    depositAmount: parseUnits("100000", assets.DAI.decimals),
    cap: parseUnits("5000000", assets.DAI.decimals),
    minimumSupply: BigNumber.from("10").pow("3").toString(),
    minimumContractSize: BigNumber.from("10").pow("17").toString(),
    managementFee: BigNumber.from("2000000"),
    performanceFee: BigNumber.from("20000000"),
    isCall: false,
  });

  behavesLikeOptionsVault({
    name: `Knox ETH Delta Vault (Call)`,
    tokenName: `Knox ETH Delta Vault`,
    tokenSymbol: `kETH-DELTA-C`,
    tokenDecimals: 18,
    asset: assets.ETH,
    pool: assets.PREMIA.WETH_DAI,
    depositAmount: parseUnits("10", assets.ETH.decimals),
    cap: parseUnits("1000", assets.ETH.decimals),
    minimumSupply: BigNumber.from("10").pow("10").toString(),
    minimumContractSize: BigNumber.from("10").pow("17").toString(),
    managementFee: BigNumber.from("2000000"),
    performanceFee: BigNumber.from("20000000"),
    isCall: true,
  });

  // behavesLikeOptionsVault({
  //   name: `Knox BTC Delta Vault (Call)`,
  //   tokenName: `Knox BTC Delta Vault`,
  //   tokenSymbol: `kBTC-DELTA-C`,
  //   tokenDecimals: 18,
  //   asset: assets.BTC,
  //   pool: assets.PREMIA.WBTC_DAI,
  //   depositAmount: parseUnits("1", assets.BTC.decimals),
  //   cap: parseUnits("100", assets.BTC.decimals),
  //   minimumSupply: BigNumber.from("10").pow("3").toString(),
  //   minimumContractSize: BigNumber.from("10").pow("7").toString(),
  //   managementFee: BigNumber.from("2000000"),
  //   performanceFee: BigNumber.from("20000000"),
  //   isCall: true,
  // });

  // behavesLikeOptionsVault({
  //   name: `Knox LINK Delta Vault (Call)`,
  //   tokenName: `Knox LINK Delta Vault`,
  //   tokenSymbol: `kLINK-DELTA-C`,
  //   tokenDecimals: 18,
  //   asset: assets.LINK,
  //   pool: assets.PREMIA.LINK_DAI,
  //   depositAmount: parseUnits("100", assets.LINK.decimals),
  //   cap: parseUnits("100000", assets.LINK.decimals),
  //   minimumSupply: BigNumber.from("10").pow("10").toString(),
  //   minimumContractSize: BigNumber.from("10").pow("17").toString(),
  //   managementFee: BigNumber.from("1000000"),
  //   performanceFee: BigNumber.from("30000000"),
  //   isCall: true,
  // });
});

function behavesLikeOptionsVault(params: {
  name: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimals: number;
  asset: types.Asset;
  pool: types.Pool;
  depositAmount: BigNumber;
  cap: BigNumber;
  minimumSupply: string;
  minimumContractSize: string;
  managementFee: BigNumber;
  performanceFee: BigNumber;
  isCall: boolean;
}) {
  let signers: types.Signers;
  let addresses: types.Addresses;

  // Contracts
  let commonLibrary: Contract;
  let vaultDisplayLibrary: Contract;
  let vaultLifecycleLibrary: Contract;
  let vaultContract: Vault;
  let assetContract: Contract;

  describe.only(params.name, () => {
    let initSnapshotId: string;

    before(async () => {
      // Reset block
      await network.provider.request({
        method: "hardhat_reset",
        params: [
          {
            forking: {
              jsonRpcUrl: TEST_URI[chainId],
              blockNumber: BLOCK_NUMBER[chainId],
            },
          },
        ],
      });

      initSnapshotId = await time.takeSnapshot();
      block = await provider.getBlock(await provider.getBlockNumber());

      signers = await fixtures.getSigners();
      addresses = await fixtures.getAddresses(signers);

      [signers, addresses, assetContract] = await fixtures.impersonateWhale(
        params.asset.whale,
        params.asset.address,
        params.depositAmount,
        signers,
        addresses
      );

      signers.strategy = signers.user3;
      addresses.strategy = addresses.user3;

      vaultContract = await new Vault__factory(signers.admin).deploy(
        {
          isCall: params.isCall,
          name: params.tokenName,
          symbol: params.tokenSymbol,
          asset: params.asset.address,
          pool: params.pool.address,
        },
        {
          decimals: params.asset.decimals,
          minimumSupply: params.minimumSupply,
          cap: params.cap,
          managementFee: params.managementFee,
          performanceFee: params.performanceFee,
        },
        {
          keeper: addresses.keeper,
          feeRecipient: addresses.feeRecipient,
          strategy: addresses.strategy,
        }
      );

      vaultContract = await vaultContract.connect(signers.user);

      addresses.vault = vaultContract.address;
    });

    after(async () => {
      await time.revertToSnapShot(initSnapshotId);
    });

    describe("#depositToQueue", () => {
      time.revertToSnapshotAfterEach(async () => {});

      it("should adjust User and Vault when depositToQueue is called", async () => {
        const userBalanceBefore = await assetContract.balanceOf(addresses.user);

        await assetContract
          .connect(signers.user)
          .approve(addresses.vault, params.depositAmount);

        await vaultContract["depositToQueue(uint256)"](params.depositAmount);

        const userBalanceAfter = await assetContract.balanceOf(addresses.user);
        assert.bnEqual(
          userBalanceBefore,
          userBalanceAfter.add(params.depositAmount)
        );

        const epoch = await vaultContract.epoch();
        const userQueueSharesBalance = await vaultContract[
          "balanceOf(address,uint256)"
        ](addresses.user, epoch);

        // Queue token is minted 1:1 with deposit
        assert.bnEqual(userQueueSharesBalance, params.depositAmount);

        const vaultBalance = await assetContract.balanceOf(addresses.vault);
        assert.bnEqual(vaultBalance, params.depositAmount);
      });
    });

    describe("#maxRedeemShares", () => {
      time.revertToSnapshotAfterEach(async () => {
        await assetContract
          .connect(signers.user)
          .approve(addresses.vault, params.depositAmount);

        await vaultContract["depositToQueue(uint256)"](params.depositAmount);

        await vaultContract
          .connect(signers.strategy)
          .setNextRound(NEXT_FRIDAY[chainId], BigNumber.from("111"));
      });

      it("should redeem Queue shares for Vault shares", async () => {
        const previousEpoch = (await vaultContract.epoch()).sub(1);
        const userQueueSharesBefore = await vaultContract[
          "balanceOf(address,uint256)"
        ](addresses.user, previousEpoch);

        assert.bnEqual(userQueueSharesBefore, params.depositAmount);

        const userVaultSharesBefore = await vaultContract["balanceOf(address)"](
          addresses.user
        );

        assert.isTrue(userVaultSharesBefore.isZero());

        await vaultContract.maxRedeemShares();

        const userQueueSharesAfter = await vaultContract[
          "balanceOf(address,uint256)"
        ](addresses.user, previousEpoch);

        assert.isTrue(userQueueSharesAfter.isZero());

        const userVaultSharesAfter = await vaultContract["balanceOf(address)"](
          addresses.user
        );

        assert.bnEqual(userVaultSharesAfter, params.depositAmount);
      });
    });

    describe("#setNextRound", () => {
      time.revertToSnapshotAfterEach(async () => {
        await assetContract
          .connect(signers.user)
          .approve(addresses.vault, params.depositAmount);

        await vaultContract["depositToQueue(uint256)"](params.depositAmount);
      });

      it("should adjust Queue and Vault balances when setNextRound is called", async () => {
        let totalAssets = await vaultContract.totalAssets();
        assert.isTrue(totalAssets.isZero());

        let totalQueuedAssets = await vaultContract.totalQueuedAssets();
        assert.bnEqual(totalQueuedAssets, params.depositAmount);

        await vaultContract
          .connect(signers.strategy)
          .setNextRound(NEXT_FRIDAY[chainId], BigNumber.from("111"));

        totalAssets = await vaultContract.totalAssets();
        assert.bnEqual(totalAssets, params.depositAmount);

        totalQueuedAssets = await vaultContract.totalQueuedAssets();
        assert.isTrue(totalQueuedAssets.isZero());
      });

      it("should update the Vault state when setNextRound is called", async () => {
        let epoch = await vaultContract.epoch();
        assert.bnEqual(epoch, BigNumber.from("1"));

        await vaultContract
          .connect(signers.strategy)
          .setNextRound(NEXT_FRIDAY[chainId], BigNumber.from("111"));

        epoch = await vaultContract.epoch();
        assert.bnEqual(epoch, BigNumber.from("2"));

        let option = await vaultContract.option();
        assert.bnEqual(option.expiry, NEXT_FRIDAY[chainId]);
        assert.bnEqual(option.tokenId, BigNumber.from("111"));
      });
    });

    describe("#withdraw", () => {
      time.revertToSnapshotAfterEach(async () => {
        await assetContract
          .connect(signers.user)
          .approve(addresses.vault, params.depositAmount);

        await vaultContract["depositToQueue(uint256)"](params.depositAmount);

        await vaultContract
          .connect(signers.strategy)
          .setNextRound(NEXT_FRIDAY[chainId], BigNumber.from("111"));
      });

      it("should withdraw deposit amount from Vault", async () => {
        const userBalanceBefore = await assetContract.balanceOf(addresses.user);

        await vaultContract.withdraw(
          params.depositAmount,
          addresses.user,
          addresses.user
        );

        const userBalanceAfter = await assetContract.balanceOf(addresses.user);
        assert.bnEqual(
          userBalanceBefore,
          userBalanceAfter.sub(params.depositAmount)
        );
      });
    });
  });
}
