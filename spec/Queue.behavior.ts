import { ethers } from "hardhat";
import { BigNumber, ContractTransaction } from "ethers";
import { Block } from "@ethersproject/abstract-provider";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import { describeBehaviorOfERC1155Enumerable } from "@solidstate/spec";

import { expect } from "chai";

import { IPremiaPool, IVault, MockERC20, Queue } from "../types";

import {
  assert,
  time,
  types,
  KnoxUtil,
  PoolUtil,
  formatClaimTokenId,
} from "../test/utils";

interface QueueBehaviorArgs {
  getKnoxUtil: () => Promise<KnoxUtil>;
  getParams: () => types.VaultParams;
  transferERC1155: (
    from: SignerWithAddress,
    to: SignerWithAddress,
    id: BigNumber,
    amount: BigNumber
  ) => Promise<ContractTransaction>;
  mintERC1155: (
    address: string,
    id: BigNumber,
    amount: BigNumber
  ) => Promise<ContractTransaction>;
  burnERC1155: (
    address: string,
    id: BigNumber,
    amount: BigNumber
  ) => Promise<ContractTransaction>;
  tokenIdERC1155?: BigNumber;
}

export async function describeBehaviorOfQueue(
  {
    getKnoxUtil,
    getParams,
    transferERC1155,
    mintERC1155,
    burnERC1155,
    tokenIdERC1155,
  }: QueueBehaviorArgs,
  skips?: string[]
) {
  describe("::Queue", () => {
    // Signers and Addresses
    let addresses: types.Addresses;
    let signers: types.Signers;

    // Contract Instances and Proxies
    let asset: MockERC20;
    let queue: Queue;
    let vault: IVault;
    let pool: IPremiaPool;

    // Contract Utilities
    let knoxUtil: KnoxUtil;
    let poolUtil: PoolUtil;

    // Test Suite Globals
    let block: Block;
    let epoch = 1;

    const params = getParams();

    before(async () => {
      knoxUtil = await getKnoxUtil();

      signers = knoxUtil.signers;
      addresses = knoxUtil.addresses;

      asset = knoxUtil.asset;
      vault = knoxUtil.vaultUtil.vault;
      pool = knoxUtil.poolUtil.pool;
      queue = knoxUtil.queue;

      poolUtil = knoxUtil.poolUtil;

      asset.connect(signers.lp1).mint(addresses.lp1, params.mint);
      asset.connect(signers.lp2).mint(addresses.lp2, params.mint);
      asset.connect(signers.lp3).mint(addresses.lp3, params.mint);
    });

    describeBehaviorOfERC1155Enumerable(
      async () => queue,
      {
        transfer: transferERC1155,
        mint: mintERC1155,
        burn: burnERC1155,
        tokenId: tokenIdERC1155,
      },
      skips
    );

    describe("#constructor()", () => {
      time.revertToSnapshotAfterEach(async () => {});

      it("should initialize Queue with correct state", async () => {
        await assert.equal(await queue.ERC20(), asset.address);
        await assert.equal(await queue.Vault(), addresses.vault);
        await assert.bnEqual(await queue.epoch(), ethers.constants.Zero);
        await assert.bnEqual(await queue.maxTVL(), params.maxTVL);
      });
    });

    describe("#setMaxTVL(uint256,address)", () => {
      time.revertToSnapshotAfterEach(async () => {});

      it("should revert if caller is !owner", async () => {
        await expect(queue.setMaxTVL(1000)).to.be.revertedWith(
          "Ownable: sender must be owner"
        );
      });

      it("should revert if newMaxTVL <= 0", async () => {
        await expect(
          queue.connect(signers.deployer).setMaxTVL(0)
        ).to.be.revertedWith("value exceeds minimum");
      });

      it("should set newMaxTVL", async () => {
        await queue.connect(signers.deployer).setMaxTVL(1000);
        await assert.bnEqual(await queue.maxTVL(), BigNumber.from("1000"));
      });
    });

    describe("#deposit(uint256)", () => {
      time.revertToSnapshotAfterEach(async () => {});

      it("should revert if Queue is paused", async () => {
        await queue.connect(signers.deployer).pause();
        await expect(
          queue["deposit(uint256)"](params.deposit)
        ).to.be.revertedWith("Pausable: paused");
      });

      it("should revert if maxTVL is exceeded", async () => {
        const deposit = params.maxTVL.add(BigNumber.from("1"));
        await asset.connect(signers.lp3).approve(addresses.queue, deposit);
        await expect(
          queue.connect(signers.lp3)["deposit(uint256)"](deposit)
        ).to.be.revertedWith("maxTVL exceeded");
      });

      it("should revert if value is <= 0", async () => {
        await expect(
          queue["deposit(uint256)"](ethers.constants.Zero)
        ).to.be.revertedWith("value exceeds minimum");
      });

      it("should mint claim token 1:1 for collateral deposited", async () => {
        await asset
          .connect(signers.lp1)
          .approve(addresses.queue, params.deposit);
        await queue["deposit(uint256)"](params.deposit);
        const epoch = await queue.epoch();
        const claimTokenBalance = await queue["balanceOf(address,uint256)"](
          addresses.lp1,
          await queue.formatClaimTokenId(epoch)
        );
        const queueBalance = await asset.balanceOf(addresses.queue);
        assert.bnEqual(queueBalance, params.deposit);
        assert.bnEqual(claimTokenBalance, params.deposit);
      });

      it("should mint claim tokens if LP deposits multiple times within same epoch", async () => {
        const firstDeposit = params.deposit;
        await asset.connect(signers.lp1).approve(addresses.queue, firstDeposit);
        await queue["deposit(uint256)"](firstDeposit);
        let epoch = await queue["epoch()"]();
        let claimTokenBalance = await queue["balanceOf(address,uint256)"](
          addresses.lp1,
          await queue.formatClaimTokenId(epoch)
        );
        const secondDeposit = params.deposit.div(2);
        await asset
          .connect(signers.lp1)
          .approve(addresses.queue, secondDeposit);
        await queue["deposit(uint256)"](secondDeposit);
        epoch = await queue["epoch()"]();
        claimTokenBalance = await queue["balanceOf(address,uint256)"](
          addresses.lp1,
          await queue.formatClaimTokenId(epoch)
        );
        const totalDeposits = firstDeposit.add(secondDeposit);
        const queueBalance = await asset.balanceOf(addresses.queue);
        assert.bnEqual(queueBalance, totalDeposits);
        assert.bnEqual(claimTokenBalance, totalDeposits);
      });
      // TODO: Move to integration tests

      it.skip("should redeem vault shares if LP deposited in past epoch", async () => {});
    });

    describe("#deposit(uint256,address)", () => {
      time.revertToSnapshotAfterEach(async () => {});

      it("should revert if Queue is paused", async () => {
        await queue.connect(signers.deployer).pause();
        await expect(
          queue["deposit(uint256,address)"](params.deposit, addresses.lp2)
        ).to.be.revertedWith("Pausable: paused");
      });

      it("should revert if maxTVL is exceeded", async () => {
        const deposit = params.maxTVL.add(BigNumber.from("1"));
        await asset.connect(signers.lp3).approve(addresses.queue, deposit);
        await expect(
          queue
            .connect(signers.lp3)
            ["deposit(uint256,address)"](deposit, addresses.lp2)
        ).to.be.revertedWith("maxTVL exceeded");
      });

      it("should revert if value is <= 0", async () => {
        await expect(
          queue["deposit(uint256,address)"](
            ethers.constants.Zero,
            addresses.lp2
          )
        ).to.be.revertedWith("value exceeds minimum");
      });

      it("should mint claim token 1:1 for collateral deposited", async () => {
        await asset
          .connect(signers.lp1)
          .approve(addresses.queue, params.deposit);
        await queue["deposit(uint256,address)"](params.deposit, addresses.lp2);
        const epoch = await queue.epoch();
        const claimTokenBalance = await queue["balanceOf(address,uint256)"](
          addresses.lp2,
          await queue.formatClaimTokenId(epoch)
        );
        const queueBalance = await asset.balanceOf(addresses.queue);
        assert.bnEqual(queueBalance, params.deposit);
        assert.bnEqual(claimTokenBalance, params.deposit);
      });

      it("should mint claim tokens if LP deposits multiple times within same epoch", async () => {
        const firstDeposit = params.deposit;
        await asset.connect(signers.lp1).approve(addresses.queue, firstDeposit);
        await queue["deposit(uint256,address)"](firstDeposit, addresses.lp2);
        let epoch = await queue["epoch()"]();
        let claimTokenBalance = await queue["balanceOf(address,uint256)"](
          addresses.lp2,
          await queue.formatClaimTokenId(epoch)
        );
        const secondDeposit = params.deposit.div(2);
        await asset
          .connect(signers.lp1)
          .approve(addresses.queue, secondDeposit);
        await queue["deposit(uint256,address)"](secondDeposit, addresses.lp2);
        epoch = await queue["epoch()"]();
        claimTokenBalance = await queue["balanceOf(address,uint256)"](
          addresses.lp2,
          await queue.formatClaimTokenId(epoch)
        );
        const totalDeposits = firstDeposit.add(secondDeposit);
        const queueBalance = await asset.balanceOf(addresses.queue);
        assert.bnEqual(queueBalance, totalDeposits);
        assert.bnEqual(claimTokenBalance, totalDeposits);
      });
      // TODO: Move to integration tests

      it.skip("should redeem vault shares if LP deposited in past epoch", async () => {});
    });

    describe("#withdraw(uint256)", () => {
      time.revertToSnapshotAfterEach(async () => {
        await asset
          .connect(signers.lp1)
          .approve(addresses.queue, params.deposit);
        await queue["deposit(uint256)"](params.deposit);
      });

      it("should withdraw exact amount deposited", async () => {
        const lpBalanceBefore = await asset.balanceOf(addresses.lp1);
        await queue.withdraw(params.deposit);
        const lpBalanceAfter = await asset.balanceOf(addresses.lp1);
        assert.bnEqual(lpBalanceBefore, lpBalanceAfter.sub(params.deposit));
        const epoch = await queue.epoch();
        const claimTokenBalance = await queue["balanceOf(address,uint256)"](
          addresses.lp1,
          await queue.formatClaimTokenId(epoch)
        );
        // LPs Queue token is burned
        assert.isTrue(claimTokenBalance.isZero());
      });
    });
    // TODO:
    // TODO: Move to integration tests

    describe.skip("#redeemShares(uint64,address)", () => {
      time.revertToSnapshotAfterEach(async () => {});

      it("should revert if sender != receiver and sender != approved", async () => {
        await expect(
          queue.connect(signers.lp2)["redeemMaxShares(address)"](addresses.lp1)
        ).to.be.revertedWith("ERC1155: caller is not owner nor approved");
        await queue.setApprovalForAll(addresses.lp2, true);
        await queue
          .connect(signers.lp2)
          ["redeemMaxShares(address)"](addresses.lp1);
      });
    });
    // TODO:
    // TODO: Move to integration tests

    describe.skip("#redeemMaxShares(address)", () => {
      time.revertToSnapshotAfterEach(async () => {
        await asset
          .connect(signers.lp1)
          .approve(addresses.vault, params.deposit);
        await queue["deposit(uint256)"](params.deposit);
        await queue.connect(signers.keeper)["processEpoch(bool)"](false);
      });

      it("should revert if sender != receiver and sender != approved", async () => {
        await expect(
          queue.connect(signers.lp2)["redeemMaxShares(address)"](addresses.lp1)
        ).to.be.revertedWith("ERC1155: caller is not owner nor approved");
        await queue.setApprovalForAll(addresses.lp2, true);
        await queue
          .connect(signers.lp2)
          ["redeemMaxShares(address)"](addresses.lp1);
      });

      it("should redeem Queue shares for Vault shares", async () => {
        const previousEpoch = (await queue.epoch()).sub(1);
        const lpQueueSharesBefore = await queue["balanceOf(address,uint256)"](
          addresses.lp1,
          previousEpoch
        );
        assert.bnEqual(lpQueueSharesBefore, params.deposit);
        const lpVaultSharesBefore = await queue["balanceOf(address)"](
          addresses.lp1
        );
        assert.isTrue(lpVaultSharesBefore.isZero());
        await queue["redeemMaxShares(address)"](addresses.lp1);
        const lpQueueSharesAfter = await queue["balanceOf(address,uint256)"](
          addresses.lp1,
          previousEpoch
        );
        assert.isTrue(lpQueueSharesAfter.isZero());
        const lpVaultSharesAfter = await queue["balanceOf(address)"](
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

    describe.skip("#previewUnredeemedShares(uint64,uint256)", () => {
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
            await queue.formatClaimTokenId(i),
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
          let [address, epoch] = await queue.parseClaimTokenId(claimTokenId);
          assert.equal(address, addresses.queue);
          assert.bnEqual(epoch, bn);
        }
      });
    });
  });
}
