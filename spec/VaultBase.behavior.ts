import { ethers } from "hardhat";
import { BigNumber, ContractTransaction } from "ethers";

import { describeBehaviorOfERC4626Base } from "@solidstate/spec";

import chai, { expect } from "chai";
import chaiAlmost from "chai-almost";

chai.use(chaiAlmost());

import moment from "moment-timezone";
moment.tz.setDefault("UTC");

import { Auction, IPremiaPool, IVault, MockERC20, Queue } from "../types";

import { assert, math, time, types, KnoxUtil, PoolUtil } from "../test/utils";

interface VaultBaseBehaviorArgs {
  getKnoxUtil: () => Promise<KnoxUtil>;
  getParams: () => types.VaultParams;
  mintERC4626: (
    address: string,
    amount: BigNumber
  ) => Promise<ContractTransaction>;
  burnERC4626: (
    address: string,
    amount: BigNumber
  ) => Promise<ContractTransaction>;
  mintAsset: (
    address: string,
    amount: BigNumber
  ) => Promise<ContractTransaction>;
  supply: BigNumber;
}

export function describeBehaviorOfVaultBase(
  {
    getKnoxUtil,
    getParams,
    mintERC4626,
    burnERC4626,
    mintAsset,
    supply,
  }: VaultBaseBehaviorArgs,
  skips?: string[]
) {
  describe("::VaultBase", () => {
    // Signers and Addresses
    let addresses: types.Addresses;
    let signers: types.Signers;

    // Contract Instances and Proxies
    let asset: MockERC20;
    let queue: Queue;
    let auction: Auction;
    let vault: IVault;
    let pool: IPremiaPool;

    // Contract Utilities
    let knoxUtil: KnoxUtil;
    let poolUtil: PoolUtil;

    const params = getParams();

    before(async () => {
      knoxUtil = await getKnoxUtil();

      signers = knoxUtil.signers;
      addresses = knoxUtil.addresses;

      asset = knoxUtil.asset;
      vault = knoxUtil.vaultUtil.vault;
      pool = knoxUtil.poolUtil.pool;
      queue = knoxUtil.queue;
      auction = knoxUtil.auction;

      poolUtil = knoxUtil.poolUtil;

      asset.connect(signers.deployer).mint(addresses.deployer, params.mint);
      asset.connect(signers.buyer1).mint(addresses.buyer1, params.mint);
      asset.connect(signers.lp1).mint(addresses.lp1, params.mint);
    });

    describeBehaviorOfERC4626Base(
      async () => vault,
      {
        getAsset: async () => asset,
        mint: mintERC4626,
        burn: burnERC4626,
        mintAsset,
        supply,
      },
      skips
    );

    describe("#constructor()", () => {
      time.revertToSnapshotAfterEach(async () => {});

      it("should deploy with correct state", async () => {
        assert.equal(await vault.ERC20(), asset.address);
        assert.equal(await vault.Pool(), addresses.pool);
      });
    });

    describe("#asset()", () => {
      time.revertToSnapshotAfterEach(async () => {});

      it("should return the collateral asset address", async () => {
        assert.equal(await vault.ERC20(), asset.address);
      });
    });

    describe.skip("#totalReserves()", () => {
      time.revertToSnapshotAfterEach(async () => {});
    });

    describe.skip("#totalCollateral()", () => {
      time.revertToSnapshotAfterEach(async () => {});
    });

    describe.skip("#totalAssets()", () => {
      time.revertToSnapshotAfterEach(async () => {});
    });

    describe("#deposit(uint256,address)", () => {
      time.revertToSnapshotAfterEach(async () => {});

      it("should revert if !queue", async () => {
        await expect(
          vault.connect(signers.lp1).deposit(0, addresses.lp1)
        ).to.be.revertedWith("!queue");
      });
    });

    describe("#mint(uint256,address)", () => {
      time.revertToSnapshotAfterEach(async () => {});

      it("should revert if !queue", async () => {
        await expect(
          vault.connect(signers.lp1).mint(0, addresses.lp1)
        ).to.be.revertedWith("!queue");
      });
    });

    describe("#withdraw(uint256,address,address)", () => {
      time.revertToSnapshotAfterEach(async () => {
        // lp1 deposits into queue
        await asset
          .connect(signers.lp1)
          .approve(addresses.queue, params.deposit);

        await queue.connect(signers.lp1)["deposit(uint256)"](params.deposit);

        // init epoch 0 auction
        let [startTime, , epoch] = await knoxUtil.initializeAuction();

        // init epoch 1
        await knoxUtil.fastForwardToFriday8AM();
        await knoxUtil.initializeNextEpoch();

        // auction 0 starts
        await time.increaseTo(startTime);

        // buyer1 purchases all available options
        await asset
          .connect(signers.buyer1)
          .approve(addresses.auction, ethers.constants.MaxUint256);

        await auction
          .connect(signers.buyer1)
          .addMarketOrder(epoch, await auction.getTotalContracts(epoch));

        // process auction 0
        await vault.connect(signers.keeper).processAuction();
      });

      it.skip("should revert if auction is in progress", async () => {});

      it.skip("should distribute withdrawal fees to fee recipient", async () => {});

      it("should redeem max vault shares from queue", async () => {
        const lpVaultSharesBefore = await vault.balanceOf(addresses.lp1);

        await queue
          .connect(signers.lp1)
          .setApprovalForAll(addresses.vault, true);

        await vault
          .connect(signers.lp1)
          .withdraw(0, addresses.lp1, addresses.lp1);

        const lpVaultSharesAfter = await vault.balanceOf(addresses.lp1);

        assert.bnEqual(lpVaultSharesBefore, BigNumber.from(0));
        assert.bnEqual(lpVaultSharesAfter, params.deposit);
      });

      it("should distribute collateral tokens only to LP between epoch end and auction start", async () => {
        const shortTokenId = await pool["tokensByAccount(address)"](
          addresses.vault
        );

        // init auction 1
        await knoxUtil.initializeAuction();
        await knoxUtil.fastForwardToFriday8AM();
        await time.increase(100);

        // process epoch 0
        await vault.processLastEpoch(true);

        // init epoch 2
        await knoxUtil.initializeNextEpoch();

        await queue.connect(signers.lp1)["redeemMax()"]();

        const lpCollateralBalanceBefore = await asset.balanceOf(addresses.lp1);
        const totalCollateral = await vault.totalCollateral();

        // lp1 withdraws from vault
        await queue
          .connect(signers.lp1)
          .setApprovalForAll(addresses.vault, true);

        const assetAmount = await vault
          .connect(signers.lp1)
          .maxWithdraw(addresses.lp1);

        await vault
          .connect(signers.lp1)
          .withdraw(assetAmount, addresses.lp1, addresses.lp1);

        const lpVaultSharesAfter = await vault.balanceOf(addresses.lp1);

        const lpCollateralBalanceAfter = await asset.balanceOf(addresses.lp1);

        const vaultShortBalanceAfter = await pool.balanceOf(
          addresses.vault,
          shortTokenId[0]
        );

        const lpShortBalanceAfter = await pool.balanceOf(
          addresses.lp1,
          shortTokenId[0]
        );

        assert.bnEqual(lpVaultSharesAfter, BigNumber.from(0));
        expect(vaultShortBalanceAfter).to.almost(0);
        expect(lpShortBalanceAfter).to.almost(0);

        expect(
          math.bnToNumber(lpCollateralBalanceBefore.add(totalCollateral))
        ).to.almost(math.bnToNumber(lpCollateralBalanceAfter), 1);
      });

      it("should distribute collateral and short tokens to LP after auction ends", async () => {
        await queue.connect(signers.lp1)["redeemMax()"]();

        const shortTokenId = await pool["tokensByAccount(address)"](
          addresses.vault
        );

        const lpCollateralBalanceBefore = await asset.balanceOf(addresses.lp1);

        // TODO: Check totalCollateral instead
        const vaultCollateralBalanceBefore = await asset.balanceOf(
          addresses.vault
        );

        const vaultShortBalanceBefore = await pool.balanceOf(
          addresses.vault,
          shortTokenId[0]
        );

        // lp1 withdraws from vault
        await queue
          .connect(signers.lp1)
          .setApprovalForAll(addresses.vault, true);

        const assetAmount = await vault
          .connect(signers.lp1)
          .maxWithdraw(addresses.lp1);

        await vault
          .connect(signers.lp1)
          .withdraw(assetAmount, addresses.lp1, addresses.lp1);

        const lpVaultSharesAfter = await vault.balanceOf(addresses.lp1);

        const lpCollateralBalanceAfter = await asset.balanceOf(addresses.lp1);

        const lpShortBalanceAfter = await pool.balanceOf(
          addresses.lp1,
          shortTokenId[0]
        );

        assert.bnEqual(lpVaultSharesAfter, BigNumber.from(0));

        expect(math.bnToNumber(lpShortBalanceAfter)).to.almost(
          math.bnToNumber(vaultShortBalanceBefore),
          1
        );

        expect(
          math.bnToNumber(
            lpCollateralBalanceBefore.add(vaultCollateralBalanceBefore)
          )
        ).to.almost(math.bnToNumber(lpCollateralBalanceAfter), 1);
      });
    });

    describe.skip("#redeem(uint256,address,address)", () => {
      time.revertToSnapshotAfterEach(async () => {});

      it.skip("should revert if auction is in progress", async () => {});
      it.skip("should distribute withdrawal fees to fee recipient", async () => {});
      it.skip("should redeem max vault shares from queue", async () => {});
      it.skip("should distribute collateral tokens only to LP between epoch end and auction start", async () => {});
      it.skip("should distribute collateral and short tokens to LP after auction ends", async () => {});
    });
  });
}
