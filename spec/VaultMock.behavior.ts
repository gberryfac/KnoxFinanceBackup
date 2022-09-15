import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import { fixedFromFloat } from "@premia/utils";

import moment from "moment-timezone";
moment.tz.setDefault("UTC");

import {
  UNDERLYING_RESERVED_LIQ_TOKEN_ID,
  BASE_RESERVED_LIQ_TOKEN_ID,
} from "../constants";

import { Auction, IPremiaPool, IVaultMock, MockERC20, Queue } from "../types";

import { assert, time, types, KnoxUtil } from "../test/utils";

interface VaultMockBehaviorArgs {
  getKnoxUtil: () => Promise<KnoxUtil>;
  getParams: () => types.VaultParams;
}

export function describeBehaviorOfVaultMock(
  { getKnoxUtil, getParams }: VaultMockBehaviorArgs,
  skips?: string[]
) {
  describe("::VaultMock", () => {
    // Signers and Addresses
    let addresses: types.Addresses;
    let signers: types.Signers;

    // Contract Instances and Proxies
    let asset: MockERC20;
    let queue: Queue;
    let auction: Auction;
    let vault: IVaultMock;
    let pool: IPremiaPool;

    // Contract Utilities
    let knoxUtil: KnoxUtil;

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

      await asset
        .connect(signers.deployer)
        .mint(addresses.deployer, params.mint);
      await asset.connect(signers.buyer1).mint(addresses.buyer1, params.mint);
      await asset.connect(signers.lp1).mint(addresses.lp1, params.mint);
    });

    describe("__internal", () => {
      time.revertToSnapshotAfterEach(async () => {});

      describe("#_withdrawReservedLiquidity()", () => {
        time.revertToSnapshotAfterEach(async () => {
          await vault
            .connect(signers.deployer)
            .setPerformanceFee64x64(fixedFromFloat(0.2));

          // lp1 deposits into queue
          await asset
            .connect(signers.lp1)
            .approve(addresses.queue, params.deposit);

          await queue.connect(signers.lp1)["deposit(uint256)"](params.deposit);

          // init epoch 0 auction
          let [startTime, , epoch] = await knoxUtil.setAndInitializeAuction();

          // init epoch 1
          await time.fastForwardToFriday8AM();
          await knoxUtil.initializeNextEpoch();

          // auction 0 starts
          await time.increaseTo(startTime);

          // buyer1 purchases all available options
          await asset
            .connect(signers.buyer1)
            .approve(addresses.auction, ethers.constants.MaxUint256);

          const size = await auction.getTotalContracts(epoch);

          await auction
            .connect(signers.buyer1)
            .addMarketOrder(epoch, size, ethers.constants.MaxUint256);

          // process auction 0
          await vault.connect(signers.keeper).processAuction();

          // init auction 1
          await knoxUtil.setAndInitializeAuction();

          await time.fastForwardToFriday8AM();
          await time.increase(100);
        });

        it("should withdraw reserved liquidity from pool", async () => {
          // process epoch 0
          const totalCollateralInShortPosition =
            await vault.totalShortAsCollateral();

          await knoxUtil.processExpiredOptions();

          const reservedLiquidityTokenId = params.isCall
            ? UNDERLYING_RESERVED_LIQ_TOKEN_ID
            : BASE_RESERVED_LIQ_TOKEN_ID;

          const reservedLiquidityBefore = await pool.balanceOf(
            addresses.vault,
            reservedLiquidityTokenId
          );

          assert.bnEqual(
            reservedLiquidityBefore,
            totalCollateralInShortPosition
          );

          const vaultCollateralBalanceBefore = await asset.balanceOf(
            addresses.vault
          );

          await vault.connect(signers.keeper)["withdrawReservedLiquidity()"]();

          const reservedLiquidityAfter = await pool.balanceOf(
            addresses.vault,
            reservedLiquidityTokenId
          );

          const vaultCollateralBalanceAfter = await asset.balanceOf(
            addresses.vault
          );

          assert.bnEqual(reservedLiquidityAfter, BigNumber.from(0));

          assert.bnEqual(
            reservedLiquidityBefore.add(vaultCollateralBalanceBefore),
            vaultCollateralBalanceAfter
          );
        });
      });
    });
  });
}
