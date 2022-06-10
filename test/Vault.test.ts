import { ethers, network } from "hardhat";
import { BigNumber, Contract } from "ethers";

const { provider } = ethers;
const { parseUnits } = ethers.utils;

import {
  IKnox,
  Queue,
  Vault,
  VaultDiamond,
  IKnox__factory,
  Queue__factory,
  Vault__factory,
  VaultDiamond__factory,
} from "../types";

import { expect } from "chai";
import moment from "moment-timezone";

import * as assets from "./helpers/assets";
import * as time from "./helpers/time";
import * as fixtures from "./helpers/fixtures";
import * as types from "./helpers/types";
import { assert } from "./helpers/assertions";

import { diamondCut } from "../scripts/diamond";

import { TEST_URI, BLOCK_NUMBER, NEXT_FRIDAY } from "../constants";

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

  behavesLikeOptionsVault({
    name: `Knox BTC Delta Vault (Call)`,
    tokenName: `Knox BTC Delta Vault`,
    tokenSymbol: `kBTC-DELTA-C`,
    tokenDecimals: 18,
    asset: assets.BTC,
    pool: assets.PREMIA.WBTC_DAI,
    depositAmount: parseUnits("1", assets.BTC.decimals),
    cap: parseUnits("100", assets.BTC.decimals),
    minimumSupply: BigNumber.from("10").pow("3").toString(),
    minimumContractSize: BigNumber.from("10").pow("7").toString(),
    managementFee: BigNumber.from("2000000"),
    performanceFee: BigNumber.from("20000000"),
    isCall: true,
  });

  behavesLikeOptionsVault({
    name: `Knox LINK Delta Vault (Call)`,
    tokenName: `Knox LINK Delta Vault`,
    tokenSymbol: `kLINK-DELTA-C`,
    tokenDecimals: 18,
    asset: assets.LINK,
    pool: assets.PREMIA.LINK_DAI,
    depositAmount: parseUnits("100", assets.LINK.decimals),
    cap: parseUnits("100000", assets.LINK.decimals),
    minimumSupply: BigNumber.from("10").pow("10").toString(),
    minimumContractSize: BigNumber.from("10").pow("17").toString(),
    managementFee: BigNumber.from("1000000"),
    performanceFee: BigNumber.from("30000000"),
    isCall: true,
  });
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
  let queueContract: Queue;
  let queueFactory: Queue__factory;
  let vaultDiamond: VaultDiamond;
  let vaultContract: Vault;
  let vaultFactory: Vault__factory;
  let assetContract: Contract;
  let vault: IKnox;

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
        params.asset.buyer,
        params.asset.address,
        params.depositAmount,
        signers,
        addresses
      );

      signers.strategy = signers.lp3;
      addresses.strategy = addresses.lp3;

      vaultDiamond = await new VaultDiamond__factory(signers.admin).deploy();

      queueFactory = new Queue__factory(signers.admin);
      queueContract = await queueFactory.deploy();
      await queueContract.deployed();

      let registeredSelectors = [
        vaultDiamond.interface.getSighash("supportsInterface(bytes4)"),
      ];

      registeredSelectors = registeredSelectors.concat(
        await diamondCut(
          vaultDiamond,
          queueContract.address,
          queueFactory,
          registeredSelectors
        )
      );

      vaultFactory = new Vault__factory(signers.admin);
      vaultContract = await vaultFactory.deploy();
      await vaultContract.deployed();

      registeredSelectors = registeredSelectors.concat(
        await diamondCut(
          vaultDiamond,
          vaultContract.address,
          vaultFactory,
          registeredSelectors
        )
      );

      addresses.vault = vaultDiamond.address;
      vault = IKnox__factory.connect(vaultDiamond.address, signers.lp1);

      await vault.connect(signers.admin).initializeVault(
        {
          isCall: params.isCall,
          name: params.tokenName,
          symbol: params.tokenSymbol,
          asset: params.asset.address,
          pool: params.pool.address,
        },
        {
          minimumSupply: params.minimumSupply,
          cap: params.cap,
          managementFee: params.managementFee,
          performanceFee: params.performanceFee,
        },
        addresses.keeper,
        addresses.feeRecipient,
        addresses.strategy
      );

      await vault.connect(signers.admin).initializeQueue();
    });

    after(async () => {
      await time.revertToSnapShot(initSnapshotId);
    });

    describe("#Queue", () => {
      describe("#depositToQueue", () => {
        time.revertToSnapshotAfterEach(async () => {});

        it("should adjust LP and Vault when depositToQueue is called", async () => {
          const lpBalanceBefore = await assetContract.balanceOf(addresses.lp1);

          await assetContract
            .connect(signers.lp1)
            .approve(addresses.vault, params.depositAmount);

          await vault["depositToQueue(uint256)"](params.depositAmount);

          const lpBalanceAfter = await assetContract.balanceOf(addresses.lp1);
          assert.bnEqual(
            lpBalanceBefore,
            lpBalanceAfter.add(params.depositAmount)
          );

          const epoch = await vault.epoch();
          const lpQueueSharesBalance = await vault[
            "balanceOf(address,uint256)"
          ](addresses.lp1, epoch);

          // Queue token is minted 1:1 with deposit
          assert.bnEqual(lpQueueSharesBalance, params.depositAmount);

          const vaultBalance = await assetContract.balanceOf(addresses.vault);
          assert.bnEqual(vaultBalance, params.depositAmount);
        });

        it("should increase vault balance and queue shares if lp1 deposits multiple times", async () => {
          const firstDeposit = params.depositAmount;

          await assetContract
            .connect(signers.lp1)
            .approve(addresses.vault, firstDeposit);

          await vault["depositToQueue(uint256)"](firstDeposit);

          let epoch = await vault.epoch();
          let lpQueueSharesBalance = await vault["balanceOf(address,uint256)"](
            addresses.lp1,
            epoch
          );

          // Queue token is minted 1:1 with deposit
          assert.bnEqual(lpQueueSharesBalance, firstDeposit);

          let vaultBalance = await assetContract.balanceOf(addresses.vault);
          assert.bnEqual(vaultBalance, firstDeposit);

          const secondDeposit = params.depositAmount.div(2);

          await assetContract
            .connect(signers.lp1)
            .approve(addresses.vault, secondDeposit);

          await vault["depositToQueue(uint256)"](secondDeposit);

          epoch = await vault.epoch();
          lpQueueSharesBalance = await vault["balanceOf(address,uint256)"](
            addresses.lp1,
            epoch
          );

          const balance = firstDeposit.add(secondDeposit);

          // Queue token is minted 1:1 with deposit
          assert.bnEqual(lpQueueSharesBalance, balance);

          vaultBalance = await assetContract.balanceOf(addresses.vault);
          assert.bnEqual(vaultBalance, balance);
        });

        it("should receieve vault shares if LP has deposits in past rounds", async () => {
          const firstDeposit = params.depositAmount;

          await assetContract
            .connect(signers.lp1)
            .approve(addresses.vault, firstDeposit);

          await vault["depositToQueue(uint256)"](firstDeposit);

          await vault
            .connect(signers.strategy)
            .setNextRound(NEXT_FRIDAY[chainId], BigNumber.from("111"));

          const secondDeposit = params.depositAmount.div(2);

          await assetContract
            .connect(signers.lp1)
            .approve(addresses.vault, secondDeposit);

          await vault["depositToQueue(uint256)"](secondDeposit);

          const epoch = await vault.epoch();

          const lpQueueShares = await vault["balanceOf(address,uint256)"](
            addresses.lp1,
            epoch
          );

          assert.bnEqual(lpQueueShares, secondDeposit);

          const lpVaultShares = await vault["balanceOf(address)"](
            addresses.lp1
          );

          assert.bnEqual(lpVaultShares, firstDeposit);
        });
      });

      describe("#withdrawFromQueue", () => {
        time.revertToSnapshotAfterEach(async () => {
          await assetContract
            .connect(signers.lp1)
            .approve(addresses.vault, params.depositAmount);

          await vault["depositToQueue(uint256)"](params.depositAmount);
        });

        it("should withdraw exact amount deposited", async () => {
          const lpBalanceBefore = await assetContract.balanceOf(addresses.lp1);

          await vault.withdrawFromQueue(params.depositAmount);

          const lpBalanceAfter = await assetContract.balanceOf(addresses.lp1);
          assert.bnEqual(
            lpBalanceBefore,
            lpBalanceAfter.sub(params.depositAmount)
          );

          const epoch = await vault.epoch();
          const lpQueueSharesBalance = await vault[
            "balanceOf(address,uint256)"
          ](addresses.lp1, epoch);

          // LPs Queue token is burned
          assert.isTrue(lpQueueSharesBalance.isZero());
        });
      });

      describe("#maxRedeemShares", () => {
        time.revertToSnapshotAfterEach(async () => {
          await assetContract
            .connect(signers.lp1)
            .approve(addresses.vault, params.depositAmount);

          await vault["depositToQueue(uint256)"](params.depositAmount);

          await vault
            .connect(signers.strategy)
            .setNextRound(NEXT_FRIDAY[chainId], BigNumber.from("111"));
        });

        it("should redeem Queue shares for Vault shares", async () => {
          const previousEpoch = (await vault.epoch()).sub(1);
          const lpQueueSharesBefore = await vault["balanceOf(address,uint256)"](
            addresses.lp1,
            previousEpoch
          );

          assert.bnEqual(lpQueueSharesBefore, params.depositAmount);

          const lpVaultSharesBefore = await vault["balanceOf(address)"](
            addresses.lp1
          );

          assert.isTrue(lpVaultSharesBefore.isZero());

          await vault.maxRedeemShares(addresses.lp1);

          const lpQueueSharesAfter = await vault["balanceOf(address,uint256)"](
            addresses.lp1,
            previousEpoch
          );

          assert.isTrue(lpQueueSharesAfter.isZero());

          const lpVaultSharesAfter = await vault["balanceOf(address)"](
            addresses.lp1
          );

          assert.bnEqual(lpVaultSharesAfter, params.depositAmount);
        });

        it("should revert if sender != receiver and sender != approved", async () => {
          await expect(
            vault.connect(signers.lp2).maxRedeemShares(addresses.lp1)
          ).to.be.revertedWith("ERC1155: caller is not owner nor approved");

          await vault.setApprovalForAll(addresses.lp2, true);
          await vault.connect(signers.lp2).maxRedeemShares(addresses.lp1);
        });
      });

      describe("#Vault", () => {
        describe("#setNextRound", () => {
          time.revertToSnapshotAfterEach(async () => {
            await assetContract
              .connect(signers.lp1)
              .approve(addresses.vault, params.depositAmount);

            await vault["depositToQueue(uint256)"](params.depositAmount);
          });

          it("should adjust Queue and Vault balances when setNextRound is called", async () => {
            let totalAssets = await vault.totalAssets();
            assert.isTrue(totalAssets.isZero());

            let totalQueuedAssets = await vault.totalQueuedAssets();
            assert.bnEqual(totalQueuedAssets, params.depositAmount);

            await vault
              .connect(signers.strategy)
              .setNextRound(NEXT_FRIDAY[chainId], BigNumber.from("111"));

            totalAssets = await vault.totalAssets();
            assert.bnEqual(totalAssets, params.depositAmount);

            totalQueuedAssets = await vault.totalQueuedAssets();
            assert.isTrue(totalQueuedAssets.isZero());
          });

          it("should update the Vault state when setNextRound is called", async () => {
            let epoch = await vault.epoch();
            assert.bnEqual(epoch, BigNumber.from("0"));

            await vault
              .connect(signers.strategy)
              .setNextRound(NEXT_FRIDAY[chainId], BigNumber.from("111"));

            epoch = await vault.epoch();
            assert.bnEqual(epoch, BigNumber.from("1"));

            let [, expiry, tokenId] = await vault.option();
            assert.bnEqual(expiry, NEXT_FRIDAY[chainId]);
            assert.bnEqual(tokenId, BigNumber.from("111"));
          });
        });

        describe("#withdraw", () => {
          time.revertToSnapshotAfterEach(async () => {
            await assetContract
              .connect(signers.lp1)
              .approve(addresses.vault, params.depositAmount);

            await vault["depositToQueue(uint256)"](params.depositAmount);

            await vault
              .connect(signers.strategy)
              .setNextRound(NEXT_FRIDAY[chainId], BigNumber.from("111"));
          });

          it("should withdraw deposit amount from Vault", async () => {
            const lpBalanceBefore = await assetContract.balanceOf(
              addresses.lp1
            );

            await vault.setApprovalForAll(addresses.vault, true);

            await vault.withdraw(
              params.depositAmount,
              addresses.lp1,
              addresses.lp1
            );

            const lpBalanceAfter = await assetContract.balanceOf(addresses.lp1);
            assert.bnEqual(
              lpBalanceBefore,
              lpBalanceAfter.sub(params.depositAmount)
            );
          });
        });
      });
    });
  });
}
