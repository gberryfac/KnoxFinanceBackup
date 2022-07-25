import { Block } from "@ethersproject/abstract-provider";

import chai, { expect } from "chai";
import chaiAlmost from "chai-almost";

chai.use(chaiAlmost());

import moment from "moment-timezone";
moment.tz.setDefault("UTC");

import { Auction, IPremiaPool, IVault, MockERC20 } from "../types";

import { time, types, KnoxUtil, PoolUtil } from "../test/utils";

interface ViewBehaviorArgs {
  getKnoxUtil: () => Promise<KnoxUtil>;
  getParams: () => types.VaultParams;
}

export function describeBehaviorOfVaultView(
  { getKnoxUtil, getParams }: ViewBehaviorArgs,
  skips?: string[]
) {
  describe("::VaultView", () => {
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
    });

    describe.skip("#constructor", () => {
      time.revertToSnapshotAfterEach(async () => {});

      it("should initialize VaultView with correct state", async () => {});
    });
  });
}
