import { ethers } from "hardhat";
import { BigNumber, ContractTransaction } from "ethers";

import { describeBehaviorOfERC4626Base } from "@solidstate/spec";

import { Block } from "@ethersproject/abstract-provider";

import chai, { expect } from "chai";
import chaiAlmost from "chai-almost";

chai.use(chaiAlmost());

import moment from "moment-timezone";
moment.tz.setDefault("UTC");

import { Auction, IPremiaPool, IVault, MockERC20 } from "../types";

import { time, types, KnoxUtil, PoolUtil } from "../test/utils";

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

    describe.skip("#constructor", () => {
      time.revertToSnapshotAfterEach(async () => {});

      it("should initialize VaultBase with correct state", async () => {});
    });
  });
}
