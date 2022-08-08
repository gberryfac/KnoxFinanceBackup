import { ethers } from "hardhat";
import { BigNumber, ContractTransaction } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import { describeBehaviorOfERC1155Enumerable } from "@solidstate/spec";

import { expect } from "chai";

import { IVault, MockERC20, Queue } from "../types";

import {
  assert,
  time,
  types,
  KnoxUtil,
  formatClaimTokenId,
} from "../test/utils";
import { parseUnits } from "ethers/lib/utils";

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

    // Contract Utilities
    let knoxUtil: KnoxUtil;

    // Test Suite Globals
    const params = getParams();

    before(async () => {
      knoxUtil = await getKnoxUtil();

      signers = knoxUtil.signers;
      addresses = knoxUtil.addresses;

      asset = knoxUtil.asset;
      vault = knoxUtil.vaultUtil.vault;
      queue = knoxUtil.queue;

      await asset
        .connect(signers.deployer)
        .mint(addresses.deployer, params.mint);
      await asset.connect(signers.lp1).mint(addresses.lp1, params.mint);
      await asset.connect(signers.lp2).mint(addresses.lp2, params.mint);
      await asset.connect(signers.lp3).mint(addresses.lp3, params.mint);
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
        await assert.bnEqual(await queue.getEpoch(), ethers.constants.Zero);
        await assert.bnEqual(await queue.getMaxTVL(), params.maxTVL);
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
        await assert.bnEqual(await queue.getMaxTVL(), BigNumber.from("1000"));
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

        let lpClaimBalance = await queue["balanceOf(address,uint256)"](
          addresses.lp1,
          await queue.getCurrentTokenId()
        );

        const queueBalance = await asset.balanceOf(addresses.queue);

        assert.bnEqual(queueBalance, params.deposit);
        assert.bnEqual(lpClaimBalance, queueBalance);
      });

      it("should mint claim tokens if LP deposits multiple times within same epoch", async () => {
        const firstDeposit = params.deposit;

        await asset.connect(signers.lp1).approve(addresses.queue, firstDeposit);
        await queue["deposit(uint256)"](firstDeposit);

        const secondDeposit = params.deposit.div(2);

        await asset
          .connect(signers.lp1)
          .approve(addresses.queue, secondDeposit);

        await queue["deposit(uint256)"](secondDeposit);

        let lpClaimBalance = await queue["balanceOf(address,uint256)"](
          addresses.lp1,
          await queue.getCurrentTokenId()
        );

        const totalDeposits = firstDeposit.add(secondDeposit);

        assert.bnEqual(lpClaimBalance, totalDeposits);
      });

      it("should redeem vault shares if LP deposited in past epoch", async () => {
        await knoxUtil.setAndInitializeAuction();

        await asset
          .connect(signers.lp1)
          .approve(addresses.queue, params.deposit);

        // deposits in epoch 0
        await queue["deposit(uint256)"](params.deposit);
        const tokenId1 = await queue.getCurrentTokenId();

        let lpTokenId1Balance = await queue.balanceOf(addresses.lp1, tokenId1);
        assert.bnEqual(lpTokenId1Balance, params.deposit);

        let lpBalance = await vault.balanceOf(addresses.lp1);
        assert.isTrue(lpBalance.isZero());

        await time.fastForwardToFriday8AM();
        await knoxUtil.initializeNextEpoch();
        await knoxUtil.setAndInitializeAuction();

        await asset
          .connect(signers.lp1)
          .approve(addresses.queue, params.deposit);

        // deposits in epoch 1
        await queue["deposit(uint256)"](params.deposit);
        const tokenId2 = await queue.getCurrentTokenId();

        lpTokenId1Balance = await queue.balanceOf(addresses.lp1, tokenId1);
        assert.isTrue(lpTokenId1Balance.isZero());

        let lpTokenId2Balance = await queue.balanceOf(addresses.lp1, tokenId2);
        assert.bnEqual(lpTokenId2Balance, params.deposit);

        lpBalance = await vault.balanceOf(addresses.lp1);
        assert.bnEqual(lpBalance, params.deposit);
      });
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
        await queue.cancel(params.deposit);

        const lpBalanceAfter = await asset.balanceOf(addresses.lp1);
        assert.bnEqual(lpBalanceBefore, lpBalanceAfter.sub(params.deposit));

        let lpClaimBalance = await queue["balanceOf(address,uint256)"](
          addresses.lp1,
          await queue.getCurrentTokenId()
        );

        // LPs Queue token is burned
        assert.isTrue(lpClaimBalance.isZero());
      });
    });

    describe("#redeem(uint256)", () => {
      describe("if epoch has not been incremented", () => {
        time.revertToSnapshotAfterEach(async () => {
          await asset
            .connect(signers.lp1)
            .approve(addresses.queue, params.deposit);

          await queue["deposit(uint256)"](params.deposit);
        });

        it("should revert if tokenId == currentTokenId", async () => {
          const tokenId = await queue.getCurrentTokenId();

          await expect(queue["redeem(uint256)"](tokenId)).to.be.revertedWith(
            "current claim token cannot be redeemed"
          );
        });
      });

      describe("else", () => {
        let tokenId: BigNumber;

        time.revertToSnapshotAfterEach(async () => {
          await knoxUtil.setAndInitializeAuction();

          await asset
            .connect(signers.lp1)
            .approve(addresses.queue, params.deposit);

          await queue["deposit(uint256)"](params.deposit);

          tokenId = await queue.getCurrentTokenId();

          await time.fastForwardToFriday8AM();
          await knoxUtil.initializeNextEpoch();
        });

        it("should burn claim tokens when shares are redeemed", async () => {
          await queue["redeem(uint256)"](tokenId);
          const balance = await queue.balanceOf(addresses.lp1, tokenId);
          assert.isTrue(balance.isZero());
        });

        it("should send redeemed vault shares to receiver", async () => {
          await queue["redeem(uint256)"](tokenId);

          const lpBalance = await vault.balanceOf(addresses.lp1);
          assert.bnEqual(lpBalance, params.deposit);

          const queueBalance = await vault.balanceOf(addresses.queue);
          assert.isTrue(queueBalance.isZero());
        });
      });
    });

    describe("#redeemMax()", () => {
      let tokenId1: BigNumber;
      let tokenId2: BigNumber;
      let tokenId3: BigNumber;

      time.revertToSnapshotAfterEach(async () => {
        await knoxUtil.setAndInitializeAuction();

        await asset
          .connect(signers.lp1)
          .approve(addresses.queue, params.deposit);

        // deposits in epoch 0
        await queue["deposit(uint256)"](params.deposit);
        tokenId1 = await queue.getCurrentTokenId();

        await time.fastForwardToFriday8AM();
        await knoxUtil.initializeNextEpoch();

        await knoxUtil.setAndInitializeAuction();

        await asset
          .connect(signers.lp1)
          .approve(addresses.queue, params.deposit);

        // deposits in epoch 1
        await queue["deposit(uint256)"](params.deposit);
        tokenId2 = await queue.getCurrentTokenId();

        await time.fastForwardToFriday8AM();
        await knoxUtil.initializeNextEpoch();

        await knoxUtil.setAndInitializeAuction();

        await asset
          .connect(signers.lp1)
          .approve(addresses.queue, params.deposit);

        // deposits in epoch 2
        await queue["deposit(uint256)"](params.deposit);
        tokenId3 = await queue.getCurrentTokenId();

        await time.fastForwardToFriday8AM();
        await knoxUtil.initializeNextEpoch();
      });

      it("should burn all claim tokens when shares are redeemed", async () => {
        await queue["redeemMax()"]();

        const balance1 = await queue.balanceOf(addresses.lp1, tokenId1);
        assert.isTrue(balance1.isZero());

        const balance2 = await queue.balanceOf(addresses.lp1, tokenId2);
        assert.isTrue(balance2.isZero());

        const balance3 = await queue.balanceOf(addresses.lp1, tokenId3);
        assert.isTrue(balance3.isZero());
      });

      it("should send all of redeemed vault shares to reciever", async () => {
        await queue["redeemMax()"]();

        const lpBalance = await vault.balanceOf(addresses.lp1);
        assert.bnEqual(lpBalance, params.deposit.mul(3));

        const queueBalance = await vault.balanceOf(addresses.queue);
        assert.isTrue(queueBalance.isZero());
      });
    });

    describe("#syncEpoch(uint64)", () => {
      time.revertToSnapshotAfterEach(async () => {});

      it("should revert if !vault", async () => {
        await expect(queue.syncEpoch(0)).to.be.revertedWith("!vault");
      });

      it("should set the current epoch of the queue", async () => {
        assert.bnEqual(await queue.getEpoch(), BigNumber.from(0));
        await queue.connect(signers.vault).syncEpoch(1);
        assert.bnEqual(await queue.getEpoch(), BigNumber.from(1));
      });
    });

    describe("#processQueuedDeposits()", () => {
      describe("if shares are not minted", () => {
        time.revertToSnapshotAfterEach(async () => {});

        it("should revert if !vault", async () => {
          await expect(queue.processQueuedDeposits()).to.be.revertedWith(
            "!vault"
          );
        });

        it("should set price per share to 0 if shares are not minted", async () => {
          let tokenId = await queue.getCurrentTokenId();
          await queue.connect(signers.vault).processQueuedDeposits();

          let pricePerShare = await queue.getPricePerShare(tokenId);
          assert.isTrue(pricePerShare.isZero());
        });
      });

      describe("else", () => {
        time.revertToSnapshotAfterEach(async () => {
          await knoxUtil.setAndInitializeAuction();

          await asset
            .connect(signers.lp1)
            .approve(addresses.queue, params.deposit);

          // deposits in epoch 0
          await queue["deposit(uint256)"](params.deposit);

          await asset
            .connect(signers.lp2)
            .approve(addresses.queue, params.deposit);

          // deposits in epoch 0
          await queue.connect(signers.lp2)["deposit(uint256)"](params.deposit);

          await asset
            .connect(signers.lp3)
            .approve(addresses.queue, params.deposit);

          // deposits in epoch 0
          await queue.connect(signers.lp3)["deposit(uint256)"](params.deposit);

          await time.fastForwardToFriday8AM();
        });

        it("should deposit all of queued ERC20 tokens into vault", async () => {
          let erc20Balance = await asset.balanceOf(addresses.queue);
          assert.bnEqual(erc20Balance, params.deposit.mul(3));

          await queue.connect(signers.vault).processQueuedDeposits();

          erc20Balance = await asset.balanceOf(addresses.queue);
          assert.isTrue(erc20Balance.isZero());
        });

        it("should calculate price per share correctly", async () => {
          let tokenId = await queue.getCurrentTokenId();

          await queue.connect(signers.vault).processQueuedDeposits();
          await vault.connect(signers.keeper).setNextEpoch();

          let pricePerShare = await queue.getPricePerShare(tokenId);

          assert.bnEqual(pricePerShare, parseUnits("1", 18));

          await knoxUtil.setAndInitializeAuction();

          // simluate vault profits, dilute shares by half
          await asset
            .connect(signers.deployer)
            .transfer(addresses.vault, params.deposit.mul(3));

          await asset
            .connect(signers.lp1)
            .approve(addresses.queue, params.deposit);

          // deposits in epoch 1
          await queue["deposit(uint256)"](params.deposit);

          await asset
            .connect(signers.lp2)
            .approve(addresses.queue, params.deposit);

          // deposits in epoch 1
          await queue.connect(signers.lp2)["deposit(uint256)"](params.deposit);

          tokenId = await queue.getCurrentTokenId();

          await time.fastForwardToFriday8AM();

          await queue.connect(signers.vault).processQueuedDeposits();
          await vault.connect(signers.keeper).setNextEpoch();

          pricePerShare = await queue.getPricePerShare(tokenId);

          assert.bnEqual(pricePerShare, parseUnits("5", 17));
        });
      });
    });

    describe("#previewUnredeemed(uint256)", () => {
      time.revertToSnapshotAfterEach(async () => {});

      it("should preview unredeemed shares", async () => {
        let tokenId = await queue.getCurrentTokenId();
        let shares = await queue["previewUnredeemed(uint256)"](tokenId);

        assert.isTrue(shares.isZero());

        // simluate vault profits, not included in totalSupply
        await asset
          .connect(signers.deployer)
          .transfer(addresses.vault, params.deposit.mul(4));

        await knoxUtil.setAndInitializeAuction();

        await asset
          .connect(signers.lp1)
          .approve(addresses.queue, params.deposit);

        // deposits in epoch 0
        await queue["deposit(uint256)"](params.deposit);

        tokenId = await queue.getCurrentTokenId();

        await time.fastForwardToFriday8AM();

        // totalAssets = 40,000
        // totalSupply = 0
        await queue.connect(signers.vault).processQueuedDeposits();
        await vault.connect(signers.keeper).setNextEpoch();

        shares = await queue["previewUnredeemed(uint256)"](tokenId);
        assert.bnEqual(shares, params.deposit);

        await knoxUtil.setAndInitializeAuction();

        await asset
          .connect(signers.lp1)
          .approve(addresses.queue, params.deposit);

        // deposits in epoch 1
        await queue["deposit(uint256)"](params.deposit);

        tokenId = await queue.getCurrentTokenId();

        await time.fastForwardToFriday8AM();

        // totalAssets = 50,000
        // totalSupply = 10,000
        await queue.connect(signers.vault).processQueuedDeposits();
        await vault.connect(signers.keeper).setNextEpoch();

        shares = await queue["previewUnredeemed(uint256)"](tokenId);

        const pricePerShare = await queue.getPricePerShare(tokenId);
        const expectedShares = pricePerShare
          .mul(params.deposit)
          .div(parseUnits("1", 18));

        assert.bnEqual(shares, expectedShares);
      });
    });

    describe("#formatClaimTokenId(uint64)", () => {
      time.revertToSnapshotAfterEach(async () => {});

      it("should format claim token id correctly", async () => {
        for (let i = 0; i < 10000; i++) {
          let tokenId = formatClaimTokenId({
            address: addresses.queue,
            epoch: BigNumber.from(i),
          });
          assert.bnEqual(
            await queue.formatClaimTokenId(i),
            BigNumber.from(tokenId)
          );
        }
      });
    });

    describe("#parseClaimTokenId(uint256)", () => {
      time.revertToSnapshotAfterEach(async () => {});

      it("should parse claim token id correctly", async () => {
        for (let i = 0; i < 10000; i++) {
          const bn = BigNumber.from(i);
          let tokenId = formatClaimTokenId({
            address: addresses.queue,
            epoch: bn,
          });
          let [address, epoch] = await queue.parseClaimTokenId(tokenId);
          assert.equal(address, addresses.queue);
          assert.bnEqual(epoch, bn);
        }
      });
    });
  });
}
