import { ethers } from "hardhat";
import { BigNumber } from "ethers";
const { parseUnits, hexConcat, hexZeroPad } = ethers.utils;

import { deployMockContract, MockContract } from "ethereum-waffle";
import { expect } from "chai";

import {
  MockERC20,
  Queue,
  QueueProxy,
  Queue__factory,
  QueueProxy__factory,
} from "../types";

import * as accounts from "./utils/accounts";
import * as time from "./utils/time";
import * as types from "./utils/types";

import { assert } from "./utils/assertions";

import { MockPremiaPoolUtil } from "./utils/MockUtil";

describe("Queue Unit Tests", () => {
  behavesLikeQueue({
    name: "Queue (Put Options)",
    isCall: false,
    mint: parseUnits("1000", 18),
    deposit: parseUnits("10", 18),
    maxTVL: parseUnits("100", 18),
  });

  behavesLikeQueue({
    name: "Queue (Call Options)",
    isCall: true,
    mint: parseUnits("1000", 18),
    deposit: parseUnits("10", 18),
    maxTVL: parseUnits("100", 18),
  });
});

type Params = {
  name: string;
  isCall: boolean;
  mint: BigNumber;
  deposit: BigNumber;
  maxTVL: BigNumber;
};

function behavesLikeQueue(params: Params) {
  describe.only(params.name, () => {
    let asset: MockERC20;
    let instance: Queue;
    let mockPremiaPool: MockPremiaPoolUtil;
    let mockVault: MockContract;
    let proxy: QueueProxy;
    let addresses: types.Addresses;
    let signers: types.Signers;

    before(async () => {
      signers = await accounts.getSigners();
      addresses = await accounts.getAddresses(signers);

      mockVault = await deployMockContract(signers.deployer as any, [
        "function totalAssets () external view returns (uint256)",
        "function epoch () external view returns (uint64)",
      ]);

      await mockVault.mock.totalAssets.returns(0);
      await mockVault.mock.epoch.returns(1);

      mockPremiaPool = await MockPremiaPoolUtil.deploy(
        {
          decimals: 8,
          price: 200000000,
        },
        {
          decimals: 8,
          price: 100000000,
        },
        signers.deployer
      );

      addresses.pool = mockPremiaPool.pool.address;
      addresses.vault = mockVault.address;

      instance = await new Queue__factory(signers.deployer).deploy(
        params.isCall,
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

      asset = params.isCall
        ? mockPremiaPool.underlyingAsset
        : mockPremiaPool.baseAsset;

      asset.connect(signers.lp1).mint(addresses.lp1, params.mint);
      asset.connect(signers.lp2).mint(addresses.lp2, params.mint);
      asset.connect(signers.lp3).mint(addresses.lp3, params.mint);
    });

    describe("#constructor()", () => {
      time.revertToSnapshotAfterEach(async () => {});

      it("should initialize Queue with correct state", async () => {
        await assert.equal(await instance.ERC20(), asset.address);
        await assert.equal(await instance.Vault(), addresses.vault);
        await assert.bnEqual(await instance.epoch(), ethers.constants.One);
        await assert.bnEqual(await instance.maxTVL(), params.maxTVL);
      });
    });

    describe("#setMaxTVL(uint256,address)", () => {
      time.revertToSnapshotAfterEach(async () => {});

      it("should revert if caller is !owner", async () => {
        await expect(instance.setMaxTVL(1000)).to.be.revertedWith(
          "Ownable: sender must be owner"
        );
      });

      it("should revert if newMaxTVL <= 0", async () => {
        await expect(
          instance.connect(signers.deployer).setMaxTVL(0)
        ).to.be.revertedWith("value exceeds minimum");
      });

      it("should set newMaxTVL", async () => {
        await instance.connect(signers.deployer).setMaxTVL(1000);
        await assert.bnEqual(await instance.maxTVL(), BigNumber.from("1000"));
      });
    });

    describe("#depositToQueue(uint256)", () => {
      time.revertToSnapshotAfterEach(async () => {});

      it("should revert if Queue is paused", async () => {
        await instance.connect(signers.deployer).pause();
        await expect(
          instance["depositToQueue(uint256)"](params.deposit)
        ).to.be.revertedWith("Pausable: paused");
      });

      it("should revert if maxTVL is exceeded", async () => {
        const deposit = params.maxTVL.add(BigNumber.from("1"));

        await asset.connect(signers.lp3).approve(addresses.queue, deposit);

        await expect(
          instance.connect(signers.lp3)["depositToQueue(uint256)"](deposit)
        ).to.be.revertedWith("maxTVL exceeded");
      });

      it("should revert if value is <= 0", async () => {
        await expect(
          instance["depositToQueue(uint256)"](ethers.constants.Zero)
        ).to.be.revertedWith("value exceeds minimum");
      });

      it("should mint claim token 1:1 for collateral deposited", async () => {
        await asset
          .connect(signers.lp1)
          .approve(addresses.queue, params.deposit);

        await instance["depositToQueue(uint256)"](params.deposit);

        const epoch = await instance.epoch();
        const claimTokenBalance = await instance["balanceOf(address,uint256)"](
          addresses.lp1,
          await instance.formatClaimTokenId(epoch)
        );

        const queueBalance = await asset.balanceOf(addresses.queue);

        assert.bnEqual(queueBalance, params.deposit);
        assert.bnEqual(claimTokenBalance, params.deposit);
      });

      it("should mint claim tokens if LP deposits multiple times within same epoch", async () => {
        const firstDeposit = params.deposit;

        await asset.connect(signers.lp1).approve(addresses.queue, firstDeposit);

        await instance["depositToQueue(uint256)"](firstDeposit);

        let epoch = await instance["epoch()"]();
        let claimTokenBalance = await instance["balanceOf(address,uint256)"](
          addresses.lp1,
          await instance.formatClaimTokenId(epoch)
        );

        const secondDeposit = params.deposit.div(2);

        await asset
          .connect(signers.lp1)
          .approve(addresses.queue, secondDeposit);

        await instance["depositToQueue(uint256)"](secondDeposit);

        epoch = await instance["epoch()"]();
        claimTokenBalance = await instance["balanceOf(address,uint256)"](
          addresses.lp1,
          await instance.formatClaimTokenId(epoch)
        );

        const totalDeposits = firstDeposit.add(secondDeposit);
        const queueBalance = await asset.balanceOf(addresses.queue);

        assert.bnEqual(queueBalance, totalDeposits);
        assert.bnEqual(claimTokenBalance, totalDeposits);
      });

      // TODO: Move to integration tests
      it.skip("should redeem vault shares if LP deposited in past epoch", async () => {});
    });

    describe("#depositToQueue(uint256,address)", () => {
      time.revertToSnapshotAfterEach(async () => {});

      it("should revert if Queue is paused", async () => {
        await instance.connect(signers.deployer).pause();
        await expect(
          instance["depositToQueue(uint256,address)"](
            params.deposit,
            addresses.lp2
          )
        ).to.be.revertedWith("Pausable: paused");
      });

      it("should revert if maxTVL is exceeded", async () => {
        const deposit = params.maxTVL.add(BigNumber.from("1"));

        await asset.connect(signers.lp3).approve(addresses.queue, deposit);

        await expect(
          instance
            .connect(signers.lp3)
            ["depositToQueue(uint256,address)"](deposit, addresses.lp2)
        ).to.be.revertedWith("maxTVL exceeded");
      });

      it("should revert if value is <= 0", async () => {
        await expect(
          instance["depositToQueue(uint256,address)"](
            ethers.constants.Zero,
            addresses.lp2
          )
        ).to.be.revertedWith("value exceeds minimum");
      });

      it("should mint claim token 1:1 for collateral deposited", async () => {
        await asset
          .connect(signers.lp1)
          .approve(addresses.queue, params.deposit);

        await instance["depositToQueue(uint256,address)"](
          params.deposit,
          addresses.lp2
        );

        const epoch = await instance.epoch();
        const claimTokenBalance = await instance["balanceOf(address,uint256)"](
          addresses.lp2,
          await instance.formatClaimTokenId(epoch)
        );

        const queueBalance = await asset.balanceOf(addresses.queue);

        assert.bnEqual(queueBalance, params.deposit);
        assert.bnEqual(claimTokenBalance, params.deposit);
      });

      it("should mint claim tokens if LP deposits multiple times within same epoch", async () => {
        const firstDeposit = params.deposit;

        await asset.connect(signers.lp1).approve(addresses.queue, firstDeposit);

        await instance["depositToQueue(uint256,address)"](
          firstDeposit,
          addresses.lp2
        );

        let epoch = await instance["epoch()"]();
        let claimTokenBalance = await instance["balanceOf(address,uint256)"](
          addresses.lp2,
          await instance.formatClaimTokenId(epoch)
        );

        const secondDeposit = params.deposit.div(2);

        await asset
          .connect(signers.lp1)
          .approve(addresses.queue, secondDeposit);

        await instance["depositToQueue(uint256,address)"](
          secondDeposit,
          addresses.lp2
        );

        epoch = await instance["epoch()"]();
        claimTokenBalance = await instance["balanceOf(address,uint256)"](
          addresses.lp2,
          await instance.formatClaimTokenId(epoch)
        );

        const totalDeposits = firstDeposit.add(secondDeposit);
        const queueBalance = await asset.balanceOf(addresses.queue);

        assert.bnEqual(queueBalance, totalDeposits);
        assert.bnEqual(claimTokenBalance, totalDeposits);
      });

      // TODO: Move to integration tests
      it.skip("should redeem vault shares if LP deposited in past epoch", async () => {});
    });

    describe("#withdrawFromQueue(uint256)", () => {
      time.revertToSnapshotAfterEach(async () => {
        await asset
          .connect(signers.lp1)
          .approve(addresses.queue, params.deposit);

        await instance["depositToQueue(uint256)"](params.deposit);
      });

      it("should withdraw exact amount deposited", async () => {
        const lpBalanceBefore = await asset.balanceOf(addresses.lp1);

        await instance.withdrawFromQueue(params.deposit);

        const lpBalanceAfter = await asset.balanceOf(addresses.lp1);
        assert.bnEqual(lpBalanceBefore, lpBalanceAfter.sub(params.deposit));

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
    describe.skip("#redeemSharesFromEpoch(uint64,address)", () => {
      time.revertToSnapshotAfterEach(async () => {});

      it("should revert if sender != receiver and sender != approved", async () => {
        await expect(
          instance.connect(signers.lp2).maxRedeemShares(addresses.lp1)
        ).to.be.revertedWith("ERC1155: caller is not owner nor approved");

        await instance.setApprovalForAll(addresses.lp2, true);
        await instance.connect(signers.lp2).maxRedeemShares(addresses.lp1);
      });
    });

    // TODO:
    // TODO: Move to integration tests
    describe.skip("#maxRedeemShares(address)", () => {
      time.revertToSnapshotAfterEach(async () => {
        await asset
          .connect(signers.lp1)
          .approve(addresses.vault, params.deposit);

        await instance["depositToQueue(uint256)"](params.deposit);
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
        const lpQueueSharesBefore = await instance[
          "balanceOf(address,uint256)"
        ](addresses.lp1, previousEpoch);

        assert.bnEqual(lpQueueSharesBefore, params.deposit);

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

        assert.bnEqual(lpVaultSharesAfter, params.deposit);
      });
    });

    // TODO:
    // TODO: Move to integration tests
    describe.skip("#syncEpoch(uint64)", () => {
      time.revertToSnapshotAfterEach(async () => {});
    });

    // TODO:
    // TODO: Move to integration tests
    describe.skip("#depositToVault()", () => {
      time.revertToSnapshotAfterEach(async () => {});
    });

    // TODO:
    // TODO: Move to integration tests
    describe.skip("#previewUnredeemedShares(address)", () => {
      time.revertToSnapshotAfterEach(async () => {});
    });

    // TODO:
    // TODO: Move to integration tests
    describe.skip("#previewUnredeemedSharesFromEpoch(uint64,uint256)", () => {
      time.revertToSnapshotAfterEach(async () => {});
    });

    // TODO:
    // TODO: Move to integration tests
    describe.skip("#pricePerShare(uint64)", () => {
      time.revertToSnapshotAfterEach(async () => {});
    });

    describe("#formatClaimTokenId(uint64)", () => {
      time.revertToSnapshotAfterEach(async () => {});

      it("should format claim token id correctly", async () => {
        for (let i = 0; i < 10000; i++) {
          let claimTokenId = formatClaimTokenId({
            address: addresses.queue,
            epoch: BigNumber.from(i),
          });

          assert.bnEqual(
            await instance.formatClaimTokenId(i),
            BigNumber.from(claimTokenId)
          );
        }
      });
    });

    describe("#parseClaimTokenId(uint256)", () => {
      time.revertToSnapshotAfterEach(async () => {});

      it("should parse claim token id correctly", async () => {
        for (let i = 0; i < 10000; i++) {
          const bn = BigNumber.from(i);

          let claimTokenId = formatClaimTokenId({
            address: addresses.queue,
            epoch: bn,
          });

          let [address, epoch] = await instance.parseClaimTokenId(claimTokenId);

          assert.equal(address, addresses.queue);
          assert.bnEqual(epoch, bn);
        }
      });
    });
  });
}

export interface ClaimTokenId {
  address: string;
  epoch: BigNumber;
}

function formatClaimTokenId({ address, epoch }: ClaimTokenId) {
  return hexConcat([
    hexZeroPad(BigNumber.from(address).toHexString(), 20),
    hexZeroPad(epoch.toHexString(), 8),
  ]);
}
