import { ethers } from "hardhat";
import { BigNumber, ContractTransaction } from "ethers";

import { describeBehaviorOfERC4626Base } from "@solidstate/spec";

import { Block } from "@ethersproject/abstract-provider";

import chai, { expect } from "chai";
import chaiAlmost from "chai-almost";

chai.use(chaiAlmost());

import moment from "moment-timezone";
moment.tz.setDefault("UTC");

import { Auction, IPremiaPool, IVault, MockERC20, Queue } from "../types";

import {
  assert,
  math,
  time,
  types,
  KnoxUtil,
  PoolUtil,
  formatClaimTokenId,
} from "../test/utils";

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

      it("", async () => {});
    });

    describe("#totalReserves()", () => {
      time.revertToSnapshotAfterEach(async () => {});

      it("", async () => {});
    });

    describe("#totalCollateral()", () => {
      time.revertToSnapshotAfterEach(async () => {});

      it("", async () => {});
    });

    describe("#totalAssets()", () => {
      time.revertToSnapshotAfterEach(async () => {});

      it("", async () => {});
    });

    describe("#withdraw(uint256,address,address)", () => {
      time.revertToSnapshotAfterEach(async () => {});

      it.only("", async () => {
        // lp1 deposits into queue
        await asset
          .connect(signers.lp1)
          .approve(addresses.queue, params.deposit);

        await queue.connect(signers.lp1)["deposit(uint256)"](params.deposit);

        // init epoch 1 auction
        const [startTime] = await knoxUtil.initializeAuction(epoch);

        // process epoch
        await knoxUtil.processEpoch(epoch);

        // auction starts
        await time.increaseTo(startTime);

        // buyer1 purchases all available options
        await asset
          .connect(signers.buyer1)
          .approve(addresses.auction, ethers.constants.MaxUint256);

        console.log(
          "total contracts available",
          math.bnToNumber(await auction.getTotalContracts(epoch))
        );

        await auction
          .connect(signers.buyer1)
          .addMarketOrder(epoch, await auction.getTotalContracts(epoch));

        console.log(
          "total ERC20 vault balance",
          math.bnToNumber(await asset.balanceOf(addresses.vault))
        );

        // process auction
        await vault.connect(signers.keeper).processAuction();

        console.log(
          "total ERC20 vault balance",
          math.bnToNumber(await asset.balanceOf(addresses.vault))
        );

        console.log(
          "total vault collateral",
          math.bnToNumber(await vault.totalCollateral())
        );

        console.log(
          "total vault assets",
          math.bnToNumber(await vault.totalAssets())
        );

        console.log(
          "LP1 ERC1155 balance",
          await queue.connect(signers.lp1).balanceOf(
            addresses.lp1,
            formatClaimTokenId({
              address: queue.address,
              epoch: BigNumber.from(0),
            })
          )
        );

        console.log(
          "claim token id",
          formatClaimTokenId({
            address: queue.address,
            epoch: BigNumber.from(0),
          })
        );

        await queue.connect(signers.lp1)["redeemMax()"];

        console.log(
          "LP1 ERC4626 balance",
          await vault.connect(signers.lp1).balanceOf(addresses.lp1)
        );

        // lp1 withdraws from vault
        console.log(
          "max withdraw",
          await vault.connect(signers.lp1).maxWithdraw(addresses.lp1)
        );

        // await vault.connect(signers.lp1)["withdraw(uint256,address,address)"]();
      });
    });

    describe("#redeem(uint256,address,address)", () => {
      time.revertToSnapshotAfterEach(async () => {});

      it("", async () => {});
    });
  });
}
