import { Block } from "@ethersproject/abstract-provider";

import chai, { expect } from "chai";
import chaiAlmost from "chai-almost";

chai.use(chaiAlmost());

import moment from "moment-timezone";
moment.tz.setDefault("UTC");

import { Auction, IPremiaPool, IVault, MockERC20 } from "../types";

import { time, types, KnoxUtil, PoolUtil } from "../test/utils";

interface AdminBehaviorArgs {
  getKnoxUtil: () => Promise<KnoxUtil>;
  getParams: () => types.VaultParams;
}

export function describeBehaviorOfAdmin(
  { getKnoxUtil, getParams }: AdminBehaviorArgs,
  skips?: string[]
) {
  describe("::Admin", () => {
    // Signers and Addresses
    let addresses: types.Addresses;
    let signers: types.Signers;

    // Contract Instances and Proxies
    let asset: MockERC20;
    let auction: Auction;
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
      auction = knoxUtil.auction;

      poolUtil = knoxUtil.poolUtil;

      asset.connect(signers.deployer).mint(addresses.buyer1, params.mint);
      asset.connect(signers.deployer).mint(addresses.buyer2, params.mint);
      asset.connect(signers.deployer).mint(addresses.buyer3, params.mint);
      asset.connect(signers.deployer).mint(addresses.vault, params.mint);
    });

    describe.skip("#constructor", () => {
      time.revertToSnapshotAfterEach(async () => {});
    });

    describe.skip("#processEpoch", () => {
      time.revertToSnapshotAfterEach(async () => {
        await asset
          .connect(signers.lp1)
          .approve(addresses.vault, params.deposit);

        await vault["deposit(uint256)"](params.deposit);
      });

      it("should adjust Queue and Vault balances when processEpoch is called", async () => {});

      it("should update the Vault state when processEpoch is called", async () => {});
    });
  });
}
