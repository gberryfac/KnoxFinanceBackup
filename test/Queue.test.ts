import { ethers } from "hardhat";
const { parseUnits } = ethers.utils;

import { deployMockContract, MockContract } from "ethereum-waffle";
import { expect } from "chai";

import {
  IAsset,
  Queue,
  QueueProxy,
  Queue__factory,
  QueueProxy__factory,
} from "../types";

import * as accounts from "./utils/accounts";
import * as assets from "./utils/assets";
import * as time from "./utils/time";
import * as types from "./utils/types";

import { assert } from "./utils/assertions";

import { MockPremiaPoolUtil } from "./utils/MockUtil";

import moment from "moment-timezone";
moment.tz.setDefault("UTC");

// TODO: test multiple cases, see StandardDelta
const params = {
  isCall: true,
  base: assets.DAI,
  underlying: assets.ETH,
  depositAmount: parseUnits("1", assets.ETH.decimals),
  maxTVL: parseUnits("100", assets.ETH.decimals),
};

let addresses: types.Addresses;
let assetContract: IAsset;
let instance: Queue;
let mockPremiaPool: MockPremiaPoolUtil;
let mockVault: MockContract;
let proxy: QueueProxy;
let signers: types.Signers;

describe.only("Queue Unit Tests", () => {
  before(async () => {
    signers = await accounts.getSigners();
    addresses = await accounts.getAddresses(signers);

    const asset = params.isCall ? params.underlying : params.base;

    [signers, addresses, assetContract] = await accounts.impersonateWhale(
      asset.buyer,
      asset.address,
      params.depositAmount,
      signers,
      addresses
    );

    mockVault = await deployMockContract(signers.deployer as any, [
      "function totalAssets () external view returns (uint256)",
      "function epoch () external view returns (uint64)",
    ]);

    await mockVault.mock.totalAssets.returns(0);
    await mockVault.mock.epoch.returns(1);

    mockPremiaPool = await MockPremiaPoolUtil.deploy(
      {
        oracleDecimals: 8,
        oraclePrice: 200000000,
        asset: params.underlying,
      },
      {
        oracleDecimals: 8,
        oraclePrice: 100000000,
        asset: params.base,
      },
      signers.deployer
    );

    addresses.pool = mockPremiaPool.pool.address;
    addresses.vault = mockVault.address;

    instance = await new Queue__factory(signers.deployer).deploy(
      true,
      addresses.pool,
      addresses.vault
    );

    proxy = await new QueueProxy__factory(signers.deployer).deploy(
      params.maxTVL,
      instance.address,
      addresses.vault
    );

    instance = Queue__factory.connect(proxy.address, signers.lp1);
    addresses.queue = instance.address;
  });

  describe("#constructor", () => {
    time.revertToSnapshotAfterEach(async () => {});

    it("should initialize Queue with correct state", async () => {
      const asset = params.isCall ? params.underlying : params.base;

      await assert.equal(await instance.ERC20(), asset.address);
      await assert.equal(await instance.Vault(), addresses.vault);
      await assert.bnEqual(await instance.epoch(), ethers.constants.One);
      await assert.bnEqual(await instance.maxTVL(), params.maxTVL);
    });
  });

  // TODO:
  describe.skip("#setMaxTVL(uint256, address)", () => {
    time.revertToSnapshotAfterEach(async () => {});
  });

  describe("#depositToQueue(uint256)", () => {
    time.revertToSnapshotAfterEach(async () => {});

    it.skip("should revert if Queue is paused", async () => {});
    it.skip("should revert if maxTVL is exceeded", async () => {});

    it("should revert if value is <= 0", async () => {
      await expect(
        instance["depositToQueue(uint256)"](ethers.constants.Zero)
      ).to.be.revertedWith("value exceeds minimum");
    });

    it("should mint claim token 1:1 for collateral deposited", async () => {
      await assetContract
        .connect(signers.lp1)
        .approve(addresses.queue, params.depositAmount);

      await instance["depositToQueue(uint256)"](params.depositAmount);

      const epoch = await instance.epoch();
      const claimTokenBalance = await instance["balanceOf(address,uint256)"](
        addresses.lp1,
        await instance.formatClaimTokenId(epoch)
      );

      const queueBalance = await assetContract.balanceOf(addresses.queue);

      assert.bnEqual(queueBalance, params.depositAmount);
      assert.bnEqual(claimTokenBalance, params.depositAmount);
    });

    it("should mint claim tokens if LP deposits multiple times within same epoch", async () => {
      const firstDeposit = params.depositAmount;

      await assetContract
        .connect(signers.lp1)
        .approve(addresses.queue, firstDeposit);

      await instance["depositToQueue(uint256)"](firstDeposit);

      let epoch = await instance["epoch()"]();
      let claimTokenBalance = await instance["balanceOf(address,uint256)"](
        addresses.lp1,
        await instance.formatClaimTokenId(epoch)
      );

      const secondDeposit = params.depositAmount.div(2);

      await assetContract
        .connect(signers.lp1)
        .approve(addresses.queue, secondDeposit);

      await instance["depositToQueue(uint256)"](secondDeposit);

      epoch = await instance["epoch()"]();
      claimTokenBalance = await instance["balanceOf(address,uint256)"](
        addresses.lp1,
        await instance.formatClaimTokenId(epoch)
      );

      const totalDeposits = firstDeposit.add(secondDeposit);
      const queueBalance = await assetContract.balanceOf(addresses.queue);

      assert.bnEqual(queueBalance, totalDeposits);
      assert.bnEqual(claimTokenBalance, totalDeposits);
    });

    // TODO: Move to integration tests
    it.skip("should redeem vault shares if LP deposited in past epoch", async () => {});
  });

  // TODO:
  describe.skip("#depositToQueue(uint256, address)", () => {
    time.revertToSnapshotAfterEach(async () => {});
  });

  describe("#withdrawFromQueue(uint256)", () => {
    time.revertToSnapshotAfterEach(async () => {
      await assetContract
        .connect(signers.lp1)
        .approve(addresses.queue, params.depositAmount);

      await instance["depositToQueue(uint256)"](params.depositAmount);
    });

    it("should withdraw exact amount deposited", async () => {
      const lpBalanceBefore = await assetContract.balanceOf(addresses.lp1);

      await instance.withdrawFromQueue(params.depositAmount);

      const lpBalanceAfter = await assetContract.balanceOf(addresses.lp1);
      assert.bnEqual(lpBalanceBefore, lpBalanceAfter.sub(params.depositAmount));

      const epoch = await instance.epoch();
      const claimTokenBalance = await instance["balanceOf(address,uint256)"](
        addresses.lp1,
        await instance.formatClaimTokenId(epoch)
      );

      // LPs Queue token is burned
      assert.isTrue(claimTokenBalance.isZero());
    });
  });

  // TODO:
  // TODO: Move to integration tests
  describe.skip("#redeemSharesFromEpoch(uint64, address)", () => {
    time.revertToSnapshotAfterEach(async () => {});

    it("should revert if sender != receiver and sender != approved", async () => {
      await expect(
        instance.connect(signers.lp2).maxRedeemShares(addresses.lp1)
      ).to.be.revertedWith("ERC1155: caller is not owner nor approved");

      await instance.setApprovalForAll(addresses.lp2, true);
      await instance.connect(signers.lp2).maxRedeemShares(addresses.lp1);
    });
  });

  // TODO: Move to integration tests
  describe.skip("#maxRedeemShares(address)", () => {
    time.revertToSnapshotAfterEach(async () => {
      await assetContract
        .connect(signers.lp1)
        .approve(addresses.vault, params.depositAmount);

      await instance["depositToQueue(uint256)"](params.depositAmount);
      await instance.connect(signers.keeper)["processEpoch(bool)"](false);
    });

    it("should revert if sender != receiver and sender != approved", async () => {
      await expect(
        instance.connect(signers.lp2).maxRedeemShares(addresses.lp1)
      ).to.be.revertedWith("ERC1155: caller is not owner nor approved");

      await instance.setApprovalForAll(addresses.lp2, true);
      await instance.connect(signers.lp2).maxRedeemShares(addresses.lp1);
    });

    it("should redeem Queue shares for Vault shares", async () => {
      const previousEpoch = (await instance.epoch()).sub(1);
      const lpQueueSharesBefore = await instance["balanceOf(address,uint256)"](
        addresses.lp1,
        previousEpoch
      );

      assert.bnEqual(lpQueueSharesBefore, params.depositAmount);

      const lpVaultSharesBefore = await instance["balanceOf(address)"](
        addresses.lp1
      );

      assert.isTrue(lpVaultSharesBefore.isZero());

      await instance.maxRedeemShares(addresses.lp1);

      const lpQueueSharesAfter = await instance["balanceOf(address,uint256)"](
        addresses.lp1,
        previousEpoch
      );

      assert.isTrue(lpQueueSharesAfter.isZero());

      const lpVaultSharesAfter = await instance["balanceOf(address)"](
        addresses.lp1
      );

      assert.bnEqual(lpVaultSharesAfter, params.depositAmount);
    });
  });
});
