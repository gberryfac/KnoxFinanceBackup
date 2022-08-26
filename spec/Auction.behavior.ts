import { ethers } from "hardhat";
import { BigNumber, ContractTransaction } from "ethers";
const { parseUnits } = ethers.utils;

import { fixedFromFloat, fixedToBn, fixedToNumber } from "@premia/utils";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import chai, { expect } from "chai";
import chaiAlmost from "chai-almost";

chai.use(chaiAlmost());

import moment from "moment-timezone";
moment.tz.setDefault("UTC");

import { Auction, IPremiaPool, IVault, MockERC20 } from "../types";

import {
  accounts,
  assert,
  math,
  time,
  types,
  KnoxUtil,
  PoolUtil,
  getEventArgs,
} from "../test/utils";

interface AuctionBehaviorArgs {
  getKnoxUtil: () => Promise<KnoxUtil>;
  getParams: () => types.VaultParams;
}

enum Status {
  UNINITIALIZED,
  INITIALIZED,
  FINALIZED,
  PROCESSED,
}

export function describeBehaviorOfAuction(
  { getKnoxUtil, getParams }: AuctionBehaviorArgs,
  skips?: string[]
) {
  describe("::Auction", () => {
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

    const params = getParams();

    // max price is assumed to be the same unit as the vault collateral asset
    // e.g. WETH Vault -> WETH, DAI Vault -> DAI
    const maxPrice64x64 = fixedFromFloat(params.price.max);

    // min price is assumed to be the same unit as the vault collateral asset
    // e.g. WETH Vault -> WETH, DAI Vault -> DAI
    const minPrice64x64 = fixedFromFloat(params.price.min);

    before(async () => {
      knoxUtil = await getKnoxUtil();

      signers = knoxUtil.signers;
      addresses = knoxUtil.addresses;

      asset = knoxUtil.asset;
      vault = knoxUtil.vaultUtil.vault;
      pool = knoxUtil.poolUtil.pool;
      auction = knoxUtil.auction;

      poolUtil = knoxUtil.poolUtil;

      await asset.connect(signers.buyer1).mint(addresses.buyer1, params.mint);
      await asset.connect(signers.buyer2).mint(addresses.buyer2, params.mint);
      await asset.connect(signers.buyer3).mint(addresses.buyer3, params.mint);
      await asset.connect(signers.vault).mint(addresses.vault, params.mint);

      signers.vault = await accounts.impersonateVault(signers, addresses);
    });

    const setupSimpleAuction = async (processAuction: boolean) => {
      const [startTime, endTime, epoch] =
        await knoxUtil.setAndInitializeAuction();

      await time.fastForwardToFriday8AM();
      await knoxUtil.initializeNextEpoch();
      await time.increaseTo(startTime);

      const [txs, totalContractsSold] =
        await utilizeAllContractsMarketOrdersOnly(epoch);

      const buyerOrderSize = totalContractsSold.div(3);

      if (processAuction) {
        await vault.connect(signers.keeper).processAuction();
      }

      const clearingPrice64x64 = await auction.clearingPrice64x64(epoch);

      return { txs, totalContractsSold, buyerOrderSize, clearingPrice64x64 };
    };

    const setupAdvancedAuction = async (processAuction: boolean) => {
      const [startTime, endTime] = await knoxUtil.setAndInitializeAuction();

      let epoch = await vault.getEpoch();

      const totalContracts = await auction.getTotalContracts(epoch);

      const buyer1OrderSize = totalContracts.sub(totalContracts.div(10));
      const buyer2OrderSize = totalContracts;
      const buyer3OrderSize = totalContracts.div(10).mul(2);

      await asset
        .connect(signers.buyer1)
        .approve(addresses.auction, ethers.constants.MaxUint256);

      await auction.addLimitOrder(epoch, maxPrice64x64, buyer1OrderSize);

      await asset
        .connect(signers.buyer2)
        .approve(addresses.auction, ethers.constants.MaxUint256);

      await auction
        .connect(signers.buyer2)
        .addLimitOrder(epoch, minPrice64x64, buyer2OrderSize);

      await time.fastForwardToFriday8AM();
      await knoxUtil.initializeNextEpoch();

      await time.increaseTo(startTime);

      await asset
        .connect(signers.buyer3)
        .approve(addresses.auction, ethers.constants.MaxUint256);

      const marketOrder = await auction
        .connect(signers.buyer3)
        .addMarketOrder(epoch, buyer3OrderSize);

      if (processAuction) {
        await vault.connect(signers.keeper).processAuction();
      }

      const clearingPrice64x64 = await auction.clearingPrice64x64(epoch);

      return {
        marketOrder,
        buyer1OrderSize,
        buyer2OrderSize,
        buyer3OrderSize,
        clearingPrice64x64,
      };
    };

    const utilizeAllContractsMarketOrdersOnly = async (
      epoch: BigNumber
    ): Promise<[ContractTransaction[], BigNumber]> => {
      let totalContracts = await auction.getTotalContracts(epoch);
      const size = totalContracts.div(3).add(1);

      await asset
        .connect(signers.buyer1)
        .approve(addresses.auction, ethers.constants.MaxUint256);

      const tx1 = await auction.addMarketOrder(epoch, size);
      await time.increase(100);

      await asset
        .connect(signers.buyer2)
        .approve(addresses.auction, ethers.constants.MaxUint256);

      const tx2 = await auction
        .connect(signers.buyer2)
        .addMarketOrder(epoch, size);
      await time.increase(100);

      await asset
        .connect(signers.buyer3)
        .approve(addresses.auction, ethers.constants.MaxUint256);

      const tx3 = await auction
        .connect(signers.buyer3)
        .addMarketOrder(epoch, size);

      return [[tx1, tx2, tx3], totalContracts];
    };

    // calculates estimated refund in the vault collateral asset
    // e.g. WETH Vault -> WETH, DAI Vault -> DAI
    const estimateRefund = (
      size: BigNumber,
      fill: BigNumber,
      pricePaid: number,
      clearingPrice: number
    ) => {
      const paid = math.toUnits(pricePaid * math.bnToNumber(size));
      const cost = math.toUnits(clearingPrice * math.bnToNumber(fill));
      return paid.sub(cost);
    };

    describe("#constructor()", () => {
      time.revertToSnapshotAfterEach(async () => {});

      it("should initialize Auction with correct state", async () => {
        await assert.equal(await auction.ERC20(), asset.address);
        await assert.equal(await auction.Vault(), addresses.vault);
        await assert.bnEqual(await auction.getMinSize(), params.minSize);
      });
    });

    describe("#initialize(AuctionStorage.InitAuction)", () => {
      const underlyingPrice = params.underlying.oracle.price;
      const basePrice = params.base.oracle.price;

      const strike = underlyingPrice / basePrice;
      const strike64x64 = fixedFromFloat(strike);

      let timestamp: number;

      time.revertToSnapshotAfterEach(async () => {
        timestamp = await time.now();
      });

      it("should revert if caller is !vault", async () => {
        await expect(
          auction.initialize({
            epoch: 0,
            strike64x64: strike64x64,
            longTokenId: BigNumber.from("1"),
            startTime: BigNumber.from(timestamp + 60),
            endTime: BigNumber.from(timestamp + 86400),
          })
        ).to.be.revertedWith("!vault");
      });

      it("should revert if auction is already initialized", async () => {
        const initAuction = {
          epoch: 0,
          strike64x64: strike64x64,
          longTokenId: BigNumber.from("1"),
          startTime: BigNumber.from(timestamp + 60),
          endTime: BigNumber.from(timestamp + 86400),
        };

        await auction.connect(signers.vault).initialize(initAuction);

        await expect(
          auction.connect(signers.vault).initialize(initAuction)
        ).to.be.revertedWith("auction !uninitialized");
      });

      it("should revert if endTime <= startTime", async () => {
        await expect(
          auction.connect(signers.vault).initialize({
            epoch: 0,
            strike64x64: strike64x64,
            longTokenId: BigNumber.from("1"),
            startTime: BigNumber.from(timestamp + 60),
            endTime: BigNumber.from(timestamp + 60),
          })
        ).to.be.revertedWith("endTime <= startTime");
      });

      it("should revert if block.timestamp < startTime", async () => {
        await expect(
          auction.connect(signers.vault).initialize({
            epoch: 0,
            strike64x64: strike64x64,
            longTokenId: BigNumber.from("1"),
            startTime: BigNumber.from(timestamp),
            endTime: BigNumber.from(timestamp + 86400),
          })
        ).to.be.revertedWith("start time too early");
      });

      it("should revert if strike price == 0", async () => {
        await expect(
          auction.connect(signers.vault).initialize({
            epoch: 0,
            strike64x64: BigNumber.from("0"),
            longTokenId: BigNumber.from("1"),
            startTime: BigNumber.from(timestamp + 60),
            endTime: BigNumber.from(timestamp + 86400),
          })
        ).to.be.revertedWith("strike price == 0");
      });

      it("should revert if long token id == 0", async () => {
        await expect(
          auction.connect(signers.vault).initialize({
            epoch: 0,
            strike64x64: strike64x64,
            longTokenId: BigNumber.from("0"),
            startTime: BigNumber.from(timestamp + 60),
            endTime: BigNumber.from(timestamp + 86400),
          })
        ).to.be.revertedWith("token id == 0");
      });

      it("should initialize new auction with correct state", async () => {
        const initAuction = {
          epoch: 0,
          strike64x64: strike64x64,
          longTokenId: BigNumber.from("1"),
          startTime: BigNumber.from(timestamp + 60),
          endTime: BigNumber.from(timestamp + 86400),
        };

        await auction.connect(signers.vault).initialize(initAuction);

        const data = await auction.getAuction(0);

        assert.equal(await auction.getStatus(0), Status.INITIALIZED);

        await assert.bnEqual(data.startTime, initAuction.startTime);
        await assert.bnEqual(data.endTime, initAuction.endTime);

        await assert.bnEqual(data.totalContracts, ethers.constants.Zero);
        await assert.bnEqual(data.totalContractsSold, ethers.constants.Zero);

        await assert.bnEqual(data.totalPremiums, ethers.constants.Zero);
        await assert.bnEqual(
          data.totalTime,
          initAuction.endTime.sub(initAuction.startTime)
        );

        await assert.bnEqual(data.lastPrice64x64, ethers.constants.Zero);
        await assert.bnEqual(data.longTokenId, initAuction.longTokenId);
      });
    });

    describe("#setAuctionPrices(uint64,int128,int128)", () => {
      describe("if not initialized", () => {
        it("should revert", async () => {
          await expect(
            auction
              .connect(signers.vault)
              .setAuctionPrices(0, maxPrice64x64, minPrice64x64)
          ).to.be.revertedWith("auction !initialized");
        });
      });

      describe("else if initialized", () => {
        let startTime: BigNumber;
        let epoch: BigNumber;

        time.revertToSnapshotAfterEach(async () => {
          [startTime, , epoch] = await knoxUtil.setAndInitializeAuction();
          await time.increaseTo(startTime);
        });

        it("should revert if caller is !vault", async () => {
          await expect(
            auction.setAuctionPrices(epoch, maxPrice64x64, minPrice64x64)
          ).to.be.revertedWith("!vault");
        });

        it("should set last price to int128.max if auction is cancelled (max price == 0, min price == 0, max price < min price)", async () => {
          await auction
            .connect(signers.vault)
            .setAuctionPrices(epoch, 0, fixedFromFloat(params.price.min));

          assert.bnEqual(
            await auction.lastPrice64x64(epoch),
            BigNumber.from("170141183460469231731687303715884105727") // max int128
          );
        });

        it("should finalize auction if maxPrice64x64 >= minPrice64x64", async () => {
          await auction
            .connect(signers.vault)
            .setAuctionPrices(epoch, minPrice64x64, maxPrice64x64);

          assert.equal(await auction.getStatus(epoch), Status.FINALIZED);
        });

        it("should finalize auction if maxPrice64x64 <= 0", async () => {
          await auction
            .connect(signers.vault)
            .setAuctionPrices(epoch, 0, minPrice64x64);

          assert.equal(await auction.getStatus(epoch), Status.FINALIZED);
        });

        it("should finalize auction if minPrice64x64 <= 0", async () => {
          await auction
            .connect(signers.vault)
            .setAuctionPrices(epoch, maxPrice64x64, 0);

          assert.equal(await auction.getStatus(epoch), Status.FINALIZED);
        });

        it("should set correct auction prices", async () => {
          await auction
            .connect(signers.vault)
            .setAuctionPrices(epoch, maxPrice64x64, minPrice64x64);

          const data = await auction.getAuction(epoch);

          await assert.bnEqual(data.maxPrice64x64, maxPrice64x64);
          await assert.bnEqual(data.minPrice64x64, minPrice64x64);
        });
      });
    });

    describe("#priceCurve64x64(uint64)", () => {
      describe("if not initialized", () => {
        it("should revert", async () => {
          await expect(auction.priceCurve64x64(0)).to.be.reverted;
        });
      });

      describe("else if initialized", () => {
        let startTime: BigNumber;
        let endTime: BigNumber;
        let epoch: BigNumber;

        time.revertToSnapshotAfterEach(async () => {
          [startTime, endTime, epoch] =
            await knoxUtil.setAndInitializeAuction();

          await auction
            .connect(signers.vault)
            .setAuctionPrices(epoch, maxPrice64x64, minPrice64x64);
        });

        it("should return max price", async () => {
          const priceBeforeAuctionStart = fixedToNumber(
            await auction.priceCurve64x64(epoch)
          );

          assert.equal(priceBeforeAuctionStart, fixedToNumber(maxPrice64x64));

          await time.increaseTo(startTime);
          const priceAtAuctionStart = fixedToNumber(
            await auction.priceCurve64x64(epoch)
          );

          assert.equal(priceAtAuctionStart, fixedToNumber(maxPrice64x64));
        });

        it("should return min price", async () => {
          await time.increaseTo(endTime);
          assert.bnEqual(await auction.priceCurve64x64(epoch), minPrice64x64);
        });
      });
    });

    describe("#addLimitOrder(uint64,uint256,uint256)", () => {
      describe("if not initialized", () => {
        it("should revert", async () => {
          await expect(
            auction.addLimitOrder(
              0,
              fixedFromFloat(params.price.max),
              params.size
            )
          ).to.be.revertedWith("end time is not set");
        });
      });

      describe("else if auction has not started", () => {
        let endTime: BigNumber;
        let epoch: BigNumber;

        time.revertToSnapshotAfterEach(async () => {
          [, endTime, epoch] = await knoxUtil.setAndInitializeAuction();
        });

        it("should revert if auction expires", async () => {
          await time.increaseTo(endTime.add(1));

          await expect(
            auction.addLimitOrder(
              epoch,
              fixedFromFloat(params.price.max),
              params.size
            )
          ).to.be.revertedWith("auction has ended");
        });

        it("should revert if order size is below min size", async () => {
          await expect(
            auction.addLimitOrder(
              epoch,
              fixedFromFloat(params.price.max),
              parseUnits("1", params.collateral.decimals - 2)
            )
          ).to.be.revertedWith("size < minimum");
        });

        it("should emit OrderAdded event if successful", async () => {
          await asset
            .connect(signers.buyer1)
            .approve(addresses.auction, ethers.constants.MaxUint256);

          const price = fixedFromFloat(params.price.max);

          await expect(auction.addLimitOrder(epoch, price, params.size))
            .to.emit(auction, "OrderAdded")
            .withArgs(0, 1, addresses.buyer1, price, params.size, true);
        });

        it("should send funds to Auction if successful", async () => {
          const auctionBalanceBefore = await asset.balanceOf(addresses.auction);
          const buyerBalanceBefore = await asset.balanceOf(addresses.buyer1);

          await asset
            .connect(signers.buyer1)
            .approve(addresses.auction, ethers.constants.MaxUint256);

          await auction.addLimitOrder(
            epoch,
            fixedFromFloat(params.price.max),
            params.size
          );

          const auctionBalanceAfter = await asset.balanceOf(addresses.auction);
          const buyerBalanceAfter = await asset.balanceOf(addresses.buyer1);

          const cost = math.bnToNumber(params.size) * params.price.max;

          assert.equal(
            math.bnToNumber(auctionBalanceAfter.sub(auctionBalanceBefore)),
            cost
          );

          assert.equal(
            math.bnToNumber(buyerBalanceBefore.sub(buyerBalanceAfter)),
            cost
          );
        });

        it("should add order to orderbook if successful", async () => {
          await asset
            .connect(signers.buyer1)
            .approve(addresses.auction, ethers.constants.MaxUint256);

          const tx = await auction.addLimitOrder(
            epoch,
            fixedFromFloat(params.price.max),
            params.size
          );

          const args = await getEventArgs(tx, "OrderAdded");
          const order = await auction.getOrderById(epoch, args.id);

          await assert.bnEqual(order.id, BigNumber.from("1"));
          await assert.bnEqual(
            order.price64x64,
            fixedFromFloat(params.price.max)
          );
          await assert.bnEqual(order.size, params.size);
          await assert.equal(order.buyer, addresses.buyer1);
        });

        it("should add epoch to buyer if successful", async () => {
          assert.isEmpty(await auction.epochsByBuyer(addresses.buyer1));

          await asset
            .connect(signers.buyer1)
            .approve(addresses.auction, ethers.constants.MaxUint256);

          await auction.addLimitOrder(
            epoch,
            fixedFromFloat(params.price.max),
            params.size
          );

          const epochByBuyer = await auction.epochsByBuyer(addresses.buyer1);

          assert.equal(epochByBuyer.length, 1);
          assert.bnEqual(epochByBuyer[0], epoch);
        });
      });

      describe("else if auction has started", () => {
        let startTime: BigNumber;
        let epoch: BigNumber;

        time.revertToSnapshotAfterEach(async () => {
          [startTime, , epoch] = await knoxUtil.setAndInitializeAuction();
          await time.fastForwardToFriday8AM();
          await knoxUtil.initializeNextEpoch();
        });

        it("should check if auction is finalized", async () => {
          await time.increaseTo(startTime);

          const totalContracts = await auction.getTotalContracts(epoch);

          await asset
            .connect(signers.buyer1)
            .approve(addresses.auction, ethers.constants.MaxUint256);

          await auction.addLimitOrder(
            epoch,
            fixedFromFloat(params.price.max),
            totalContracts
          );

          assert.equal(await auction.getStatus(epoch), Status.FINALIZED);
        });
      });

      describe("else if finalized", () => {
        time.revertToSnapshotAfterEach(async () => {
          const [, endTime, epoch] = await knoxUtil.setAndInitializeAuction();

          await time.fastForwardToFriday8AM();
          await knoxUtil.initializeNextEpoch();
          await time.increaseTo(endTime.add(1));
          await auction.finalizeAuction(epoch);
        });

        it("should revert", async () => {
          await expect(
            auction.addLimitOrder(
              0,
              fixedFromFloat(params.price.max),
              params.size
            )
          ).to.be.revertedWith("auction finalized");
        });
      });

      describe("else if processed", () => {
        time.revertToSnapshotAfterEach(async () => {
          await setupSimpleAuction(true);
        });

        it("should revert", async () => {
          await expect(
            auction.addLimitOrder(
              0,
              fixedFromFloat(params.price.max),
              params.size
            )
          ).to.be.revertedWith("auction processed");
        });
      });
    });

    describe("#cancelLimitOrder(uint64,uint256)", () => {
      describe("if not initialized", () => {
        it("should revert", async () => {
          await expect(
            auction.addLimitOrder(
              0,
              fixedFromFloat(params.price.max),
              params.size
            )
          ).to.be.revertedWith("end time is not set");
        });
      });

      describe("else if auction has not started", () => {
        let endTime: BigNumber;
        let epoch: BigNumber;

        time.revertToSnapshotAfterEach(async () => {
          [, endTime, epoch] = await knoxUtil.setAndInitializeAuction();
          await asset
            .connect(signers.buyer1)
            .approve(addresses.auction, ethers.constants.MaxUint256);

          await auction.addLimitOrder(
            epoch,
            fixedFromFloat(params.price.max),
            params.size
          );
        });

        it("should revert if auction expires", async () => {
          await time.increaseTo(endTime);
          await expect(auction.cancelLimitOrder(epoch, 1)).to.be.revertedWith(
            "auction has ended"
          );
        });

        it("should revert if order id is invalid", async () => {
          await expect(auction.cancelLimitOrder(epoch, 0)).to.be.revertedWith(
            "invalid order id"
          );
        });

        it("should revert if order is not in orderbook", async () => {
          await expect(auction.cancelLimitOrder(epoch, 2)).to.be.revertedWith(
            "order does not exist"
          );
        });

        it("should revert if buyer != sender", async () => {
          await expect(
            auction.connect(signers.buyer2).cancelLimitOrder(epoch, 1)
          ).to.be.revertedWith("buyer != msg.sender");
        });

        it("should issue refund if successful", async () => {
          const cost = math.bnToNumber(params.size) * params.price.max;

          const auctionBalanceBefore = await asset.balanceOf(addresses.auction);
          const buyerBalanceBefore = await asset.balanceOf(addresses.buyer1);

          await auction.cancelLimitOrder(epoch, 1);

          const auctionBalanceAfter = await asset.balanceOf(addresses.auction);
          const buyerBalanceAfter = await asset.balanceOf(addresses.buyer1);

          assert.equal(
            math.bnToNumber(auctionBalanceBefore.sub(auctionBalanceAfter)),
            cost
          );

          assert.equal(
            math.bnToNumber(buyerBalanceAfter.sub(buyerBalanceBefore)),
            cost
          );
        });

        it("should remove order from orderbook if successful", async () => {
          await auction.cancelLimitOrder(epoch, 1);

          const order = await auction.getOrderById(epoch, 1);

          await assert.bnEqual(order.id, ethers.constants.Zero);
          await assert.bnEqual(order.price64x64, ethers.constants.Zero);
          await assert.bnEqual(order.size, ethers.constants.Zero);
          await assert.equal(order.buyer, ethers.constants.AddressZero);
        });

        it("should remove claim from buyer if successful", async () => {
          await asset
            .connect(signers.buyer1)
            .approve(addresses.auction, ethers.constants.MaxUint256);

          await auction.addLimitOrder(
            epoch,
            fixedFromFloat(params.price.max),
            params.size
          );

          let epochByBuyer = await auction.epochsByBuyer(addresses.buyer1);
          assert.equal(epochByBuyer.length, 1);

          await auction.cancelLimitOrder(epoch, 1);

          epochByBuyer = await auction.epochsByBuyer(addresses.buyer1);
          assert.isEmpty(epochByBuyer);
        });
      });

      describe("else if auction has started", () => {
        let startTime: BigNumber;
        let epoch: BigNumber;

        time.revertToSnapshotAfterEach(async () => {
          [startTime, , epoch] = await knoxUtil.setAndInitializeAuction();
          await time.fastForwardToFriday8AM();
          await knoxUtil.initializeNextEpoch();
        });

        it("should check if auction is finalized", async () => {
          const totalContracts = await auction.getTotalContracts(epoch);

          await asset
            .connect(signers.buyer1)
            .approve(addresses.auction, ethers.constants.MaxUint256);

          await auction.addLimitOrder(
            epoch,
            fixedFromFloat(params.price.max),
            totalContracts
          );

          await asset
            .connect(signers.buyer2)
            .approve(addresses.auction, ethers.constants.MaxUint256);

          await auction
            .connect(signers.buyer2)
            .addLimitOrder(
              epoch,
              fixedFromFloat(params.price.max),
              totalContracts
            );

          await time.increaseTo(startTime);
          assert.equal(await auction.getStatus(epoch), Status.INITIALIZED);

          // Buyer 2 cancels order but utilization is >= 100%
          await auction.connect(signers.buyer1).cancelLimitOrder(epoch, 1);

          assert.equal(await auction.getStatus(epoch), Status.FINALIZED);
        });
      });

      describe("else if finalized", () => {
        time.revertToSnapshotAfterEach(async () => {
          const [, endTime, epoch] = await knoxUtil.setAndInitializeAuction();

          await asset
            .connect(signers.buyer1)
            .approve(addresses.auction, ethers.constants.MaxUint256);

          await auction.addLimitOrder(
            epoch,
            fixedFromFloat(params.price.max),
            params.size
          );

          await time.fastForwardToFriday8AM();
          await knoxUtil.initializeNextEpoch();
          await time.increaseTo(endTime.add(1));
          await auction.finalizeAuction(epoch);
        });

        it("should revert", async () => {
          await expect(auction.cancelLimitOrder(0, 1)).to.be.revertedWith(
            "auction finalized"
          );
        });
      });

      describe("else if processed", () => {
        time.revertToSnapshotAfterEach(async () => {
          await setupSimpleAuction(true);
        });

        it("should revert", async () => {
          await expect(auction.cancelLimitOrder(0, 1)).to.be.revertedWith(
            "auction processed"
          );
        });
      });
    });

    describe("#addMarketOrder(uint64,uint256)", () => {
      describe("if not initialized", () => {
        it("should revert", async () => {
          await expect(
            auction.addMarketOrder(0, params.size)
          ).to.be.revertedWith("start time is not set");
        });
      });

      describe("else if auction has not started", () => {
        time.revertToSnapshotAfterEach(async () => {
          await knoxUtil.setAndInitializeAuction();
          await time.fastForwardToFriday8AM();
          await knoxUtil.initializeNextEpoch();
        });

        it("should revert", async () => {
          await expect(
            auction.addMarketOrder(0, params.size)
          ).to.be.revertedWith("auction not started");
        });
      });

      describe("else if auction has started", () => {
        let startTime: BigNumber;
        let endTime: BigNumber;
        let epoch: BigNumber;

        time.revertToSnapshotAfterEach(async () => {
          [startTime, , epoch] = await knoxUtil.setAndInitializeAuction();
          await time.fastForwardToFriday8AM();
          await knoxUtil.initializeNextEpoch();
          await time.increaseTo(startTime);
        });

        it("should revert if auction has ended", async () => {
          it("should revert", async () => {
            await time.increaseTo(endTime);

            await expect(
              auction.addMarketOrder(0, params.size)
            ).to.be.revertedWith("auction has ended");
          });
        });

        it("should revert if order size is below min size", async () => {
          await expect(
            auction.addMarketOrder(
              epoch,
              parseUnits("1", params.collateral.decimals - 2)
            )
          ).to.be.revertedWith("size < minimum");
        });

        it("should set the totalContracts equal to Vault ERC20 balance if totalContracts is unset", async () => {
          let totalContracts = await auction.getTotalContracts(epoch);

          await asset
            .connect(signers.buyer1)
            .approve(addresses.auction, ethers.constants.MaxUint256);

          await auction.addMarketOrder(epoch, params.size);
          const data = await auction.getAuction(epoch);
          await assert.bnEqual(data.totalContracts, totalContracts);
        });

        it("should emit OrderAdded event if successful", async () => {
          await asset
            .connect(signers.buyer1)
            .approve(addresses.auction, ethers.constants.MaxUint256);

          const tx = await auction.addMarketOrder(epoch, params.size);
          const args = await getEventArgs(tx, "OrderAdded");

          await expect(tx).to.emit(auction, "OrderAdded").withArgs(
            0,
            1,
            addresses.buyer1,
            // Exact price depends on the time the tx was settled
            args.price64x64,
            params.size,
            false
          );
        });

        it("should send funds to Auction if successful", async () => {
          const auctionBalanceBefore = await asset.balanceOf(addresses.auction);
          const buyerBalanceBefore = await asset.balanceOf(addresses.buyer1);

          await asset
            .connect(signers.buyer1)
            .approve(addresses.auction, ethers.constants.MaxUint256);

          const tx = await auction.addMarketOrder(epoch, params.size);
          const args = await getEventArgs(tx, "OrderAdded");
          const cost = math.bnToNumber(
            params.size
              .mul(fixedToBn(args.price64x64))
              .div((10 ** params.collateral.decimals).toString())
          );

          const auctionBalanceAfter = await asset.balanceOf(addresses.auction);
          const buyerBalanceAfter = await asset.balanceOf(addresses.buyer1);

          assert.equal(
            math.bnToNumber(auctionBalanceAfter.sub(auctionBalanceBefore)),
            cost
          );

          assert.equal(
            math.bnToNumber(buyerBalanceBefore.sub(buyerBalanceAfter)),
            cost
          );
        });

        it("should add order to orderbook if successful", async () => {
          await asset
            .connect(signers.buyer1)
            .approve(addresses.auction, ethers.constants.MaxUint256);

          const tx = await auction.addMarketOrder(epoch, params.size);
          const args = await getEventArgs(tx, "OrderAdded");

          const order = await auction.getOrderById(epoch, args.id);

          await assert.bnEqual(order.id, BigNumber.from("1"));
          // Exact price depends on the time the tx was settled
          await assert.equal(order.price64x64.toString(), args.price64x64);
          await assert.bnEqual(order.size, params.size);
          await assert.equal(order.buyer, addresses.buyer1);
        });

        it("should add epoch to buyer if successful", async () => {
          assert.isEmpty(await auction.epochsByBuyer(addresses.buyer1));

          await asset
            .connect(signers.buyer1)
            .approve(addresses.auction, ethers.constants.MaxUint256);

          await auction.addMarketOrder(epoch, params.size);

          const epochByBuyer = await auction.epochsByBuyer(addresses.buyer1);

          assert.equal(epochByBuyer.length, 1);
          assert.bnEqual(epochByBuyer[0], epoch);
        });
      });

      describe("else if finalized", () => {
        time.revertToSnapshotAfterEach(async () => {
          const [, endTime, epoch] = await knoxUtil.setAndInitializeAuction();

          await asset
            .connect(signers.buyer1)
            .approve(addresses.auction, ethers.constants.MaxUint256);

          await auction.addLimitOrder(
            epoch,
            fixedFromFloat(params.price.max),
            params.size
          );

          await time.fastForwardToFriday8AM();
          await knoxUtil.initializeNextEpoch();
          await time.increaseTo(endTime.add(1));
          await auction.finalizeAuction(epoch);
        });

        it("should revert", async () => {
          await expect(
            auction.addMarketOrder(0, params.size)
          ).to.be.revertedWith("auction finalized");
        });
      });

      describe("else if processed", () => {
        time.revertToSnapshotAfterEach(async () => {
          await setupSimpleAuction(true);
        });

        it("should revert", async () => {
          await expect(
            auction.addMarketOrder(0, params.size)
          ).to.be.revertedWith("auction processed");
        });
      });
    });

    describe("#finalizeAuction(uint64)", () => {
      describe("if not initialized", () => {
        it("should revert", async () => {
          await expect(auction.finalizeAuction(0)).to.be.revertedWith(
            "start time is not set"
          );
        });
      });

      describe("else if auction has not started", () => {
        time.revertToSnapshotAfterEach(async () => {
          await knoxUtil.setAndInitializeAuction();
          await time.fastForwardToFriday8AM();
          await knoxUtil.initializeNextEpoch();
        });

        it("should revert", async () => {
          await expect(auction.finalizeAuction(0)).to.be.revertedWith(
            "auction not started"
          );
        });
      });

      describe("else if auction has started", () => {
        let startTime: BigNumber;
        let endTime: BigNumber;
        let epoch: BigNumber;

        time.revertToSnapshotAfterEach(async () => {
          [startTime, endTime, epoch] =
            await knoxUtil.setAndInitializeAuction();
        });

        it("should emit AuctionStatusSet event if utilization == %100", async () => {
          await time.fastForwardToFriday8AM();
          await knoxUtil.initializeNextEpoch();
          await time.increaseTo(startTime);

          const [txs] = await utilizeAllContractsMarketOrdersOnly(epoch);

          await expect(txs[2])
            .to.emit(auction, "AuctionStatusSet")
            .withArgs(0, Status.FINALIZED);
        });

        it("should emit AuctionStatusSet event if auction time limit has expired", async () => {
          await time.increaseTo(endTime.add(1));
          const tx = await auction.finalizeAuction(epoch);
          await expect(tx)
            .to.emit(auction, "AuctionStatusSet")
            .withArgs(0, Status.FINALIZED);
        });
      });

      describe("else if finalized", () => {
        time.revertToSnapshotAfterEach(async () => {
          const [, endTime] = await knoxUtil.setAndInitializeAuction();
          await time.fastForwardToFriday8AM();
          await knoxUtil.initializeNextEpoch();
          await time.increaseTo(endTime.add(1));
          await auction.finalizeAuction(0);
        });

        it("should revert", async () => {
          await expect(auction.finalizeAuction(0)).to.be.revertedWith(
            "auction finalized"
          );
        });
      });

      describe("else if processed", () => {
        time.revertToSnapshotAfterEach(async () => {
          await setupSimpleAuction(true);
        });

        it("should revert", async () => {
          await expect(auction.finalizeAuction(0)).to.be.revertedWith(
            "auction processed"
          );
        });
      });
    });

    describe("#transferPremium(uint64)", () => {
      describe("if not finalized", () => {
        it("should revert", async () => {
          await expect(
            auction.connect(signers.vault).transferPremium(0)
          ).to.be.revertedWith("!finalized");
        });
      });

      describe("else if utilization == 100%", () => {
        time.revertToSnapshotAfterEach(async () => {
          await setupSimpleAuction(false);
        });

        it("should revert if !vault", async () => {
          await expect(auction.transferPremium(0)).to.be.revertedWith("!vault");
        });

        it("should revert if premiums have been transferred", async () => {
          await auction.connect(signers.vault).transferPremium(0);

          await expect(
            auction.connect(signers.vault).transferPremium(0)
          ).to.be.revertedWith("premiums transferred");
        });

        it("should transfer premiums to Vault if successful", async () => {
          const auctionBalanceBefore = await asset.balanceOf(addresses.auction);
          const vaultBalanceBefore = await asset.balanceOf(addresses.vault);

          await auction.connect(signers.vault).transferPremium(0);
          const { totalPremiums } = await auction.getAuction(0);

          const auctionBalanceAfter = await asset.balanceOf(addresses.auction);
          const vaultBalanceAfter = await asset.balanceOf(addresses.vault);

          assert.bnEqual(
            auctionBalanceAfter,
            auctionBalanceBefore.sub(totalPremiums)
          );

          assert.bnEqual(
            vaultBalanceAfter,
            vaultBalanceBefore.add(totalPremiums)
          );
        });
      });

      describe("else if processed", () => {
        time.revertToSnapshotAfterEach(async () => {
          await setupSimpleAuction(true);
        });

        it("should revert", async () => {
          await expect(
            auction.connect(signers.vault).transferPremium(0)
          ).to.be.revertedWith("!finalized");
        });
      });
    });

    describe("#processAuction(uint64)", () => {
      describe("if not finalized", () => {
        it("should revert", async () => {
          await expect(
            auction.connect(signers.vault).transferPremium(0)
          ).to.be.revertedWith("!finalized");
        });
      });

      describe("else if auction has no orders", () => {
        let endTime: BigNumber;
        let epoch: BigNumber;

        time.revertToSnapshotAfterEach(async () => {
          [, endTime, epoch] = await knoxUtil.setAndInitializeAuction();

          await time.fastForwardToFriday8AM();
          await knoxUtil.initializeNextEpoch();

          await time.increaseTo(endTime.add(1));
          await auction.finalizeAuction(epoch);
        });

        it("should revert if !vault", async () => {
          await expect(auction.processAuction(0)).to.be.revertedWith("!vault");
        });

        it("should emit AuctionStatusSet event when processed", async () => {
          await expect(auction.connect(signers.vault).processAuction(0))
            .to.emit(auction, "AuctionStatusSet")
            .withArgs(0, Status.PROCESSED);
        });
      });

      describe("else if utilization == 100%", () => {
        time.revertToSnapshotAfterEach(async () => {
          await setupSimpleAuction(false);
        });

        it("should revert if premiums have not been transferred to Vault", async () => {
          await expect(
            auction.connect(signers.vault).processAuction(0)
          ).to.be.revertedWith("premiums not transferred");
        });

        it("should revert if long tokens have not been transferred to Auction", async () => {
          await auction.connect(signers.vault).transferPremium(0);
          await expect(
            auction.connect(signers.vault).processAuction(0)
          ).to.be.revertedWith("long tokens not transferred");
        });

        it("should emit AuctionStatusSet event when processed", async () => {
          await expect(vault.connect(signers.keeper).processAuction())
            .to.emit(auction, "AuctionStatusSet")
            .withArgs(0, Status.PROCESSED);
        });
      });

      describe("else if processed", () => {
        time.revertToSnapshotAfterEach(async () => {
          await setupSimpleAuction(true);
        });

        it("should revert", async () => {
          await expect(
            auction.connect(signers.vault).transferPremium(0)
          ).to.be.revertedWith("!finalized");
        });
      });
    });

    describe("#withdraw(uint64)", () => {
      const verifyBalancesAfterWithdraw = async (
        buyer: SignerWithAddress,
        estimatedRefund: BigNumber,
        estimatedFill: BigNumber,
        longTokenId: BigNumber
      ) => {
        const auctionERC20BalanceBefore = await asset.balanceOf(
          addresses.auction
        );

        const auctionERC1155BalanceBefore = await pool.balanceOf(
          addresses.auction,
          longTokenId
        );

        const buyerERC20BalanceBefore = await asset.balanceOf(buyer.address);
        const buyerERC1155BalanceBefore = await pool.balanceOf(
          buyer.address,
          longTokenId
        );

        await auction.connect(buyer).withdraw(0);

        const auctionERC20BalanceAfter = await asset.balanceOf(
          addresses.auction
        );

        const auctionERC1155BalanceAfter = await pool.balanceOf(
          addresses.auction,
          longTokenId
        );

        const buyerERC20BalanceAfter = await asset.balanceOf(buyer.address);

        const buyerERC1155BalanceAfter = await pool.balanceOf(
          buyer.address,
          longTokenId
        );

        expect(math.bnToNumber(auctionERC20BalanceAfter)).to.almost(
          math.bnToNumber(auctionERC20BalanceBefore.sub(estimatedRefund)),
          1
        );

        expect(math.bnToNumber(buyerERC20BalanceAfter)).to.almost(
          math.bnToNumber(buyerERC20BalanceBefore.add(estimatedRefund)),
          1
        );

        expect(math.bnToNumber(auctionERC1155BalanceAfter)).to.almost(
          math.bnToNumber(auctionERC1155BalanceBefore.sub(estimatedFill)),
          1
        );

        expect(math.bnToNumber(buyerERC1155BalanceAfter)).to.almost(
          math.bnToNumber(buyerERC1155BalanceBefore.add(estimatedFill)),
          1
        );
      };

      describe("if not processed", () => {
        time.revertToSnapshotAfterEach(async () => {
          await setupSimpleAuction(false);
        });

        it("should revert", async () => {
          await expect(
            auction.connect(signers.buyer1).withdraw(0)
          ).to.be.revertedWith("auction !processed");
        });
      });

      describe("else if cancelled", () => {
        let buyer1OrderSize1 = math.toUnits(40);
        let buyer1OrderSize2 = math.toUnits(1);
        let buyer2OrderSize = math.toUnits(20);
        let buyer3OrderSize = math.toUnits(10);

        let endTime: BigNumber;
        let epoch: BigNumber;

        let longTokenId: BigNumber;

        time.revertToSnapshotAfterEach(async () => {
          [, endTime, epoch] = await knoxUtil.setAndInitializeAuction();
          [, , longTokenId] = await vault.getOption(epoch);

          await asset
            .connect(signers.buyer1)
            .approve(addresses.auction, ethers.constants.MaxUint256);

          await auction.addLimitOrder(epoch, maxPrice64x64, buyer1OrderSize1);
          await auction.addLimitOrder(epoch, minPrice64x64, buyer1OrderSize2);

          await asset
            .connect(signers.buyer2)
            .approve(addresses.auction, ethers.constants.MaxUint256);

          await auction
            .connect(signers.buyer2)
            .addLimitOrder(epoch, minPrice64x64, buyer2OrderSize);

          await asset
            .connect(signers.buyer3)
            .approve(addresses.auction, ethers.constants.MaxUint256);

          await auction
            .connect(signers.buyer3)
            .addLimitOrder(epoch, maxPrice64x64, buyer3OrderSize);

          await time.fastForwardToFriday8AM();

          // initialize next epoch
          // prices are unset, auction is cancelled
          await vault.connect(signers.keeper).initializeNextEpoch();
          await auction.connect(signers.vault).setAuctionPrices(epoch, 0, 0);
          await vault.connect(signers.keeper).processAuction();
        });

        it("should send buyer1 refund, only", async () => {
          const estimatedRefund = math.toUnits(
            params.price.max * math.bnToNumber(buyer1OrderSize1) +
              params.price.min * math.bnToNumber(buyer1OrderSize2)
          );

          await verifyBalancesAfterWithdraw(
            signers.buyer1,
            estimatedRefund,
            BigNumber.from(0),
            longTokenId
          );
        });

        it("should send buyer2 refund, only", async () => {
          const estimatedRefund = math.toUnits(
            params.price.min * math.bnToNumber(buyer2OrderSize)
          );

          await verifyBalancesAfterWithdraw(
            signers.buyer2,
            estimatedRefund,
            BigNumber.from(0),
            longTokenId
          );
        });

        it("should send buyer3 refund, only", async () => {
          const estimatedRefund = math.toUnits(
            params.price.max * math.bnToNumber(buyer3OrderSize)
          );

          await verifyBalancesAfterWithdraw(
            signers.buyer3,
            estimatedRefund,
            BigNumber.from(0),
            longTokenId
          );
        });
      });

      describe("else if some orders are filled", () => {
        let advancedAuction;
        let longTokenId: BigNumber;
        let epoch = BigNumber.from(0);

        time.revertToSnapshotAfterEach(async () => {
          advancedAuction = await setupAdvancedAuction(true);
          [, , longTokenId] = await vault.getOption(epoch);
        });

        it("should send buyer1 fill and refund", async () => {
          const estimatedRefund = estimateRefund(
            advancedAuction.buyer1OrderSize,
            advancedAuction.buyer1OrderSize,
            params.price.max,
            fixedToNumber(advancedAuction.clearingPrice64x64)
          );

          const estimatedFill = advancedAuction.buyer1OrderSize;

          await verifyBalancesAfterWithdraw(
            signers.buyer1,
            estimatedRefund,
            estimatedFill,
            longTokenId
          );
        });

        it("should send buyer2 refund, only", async () => {
          const estimatedRefund = math.toUnits(
            params.price.min * math.bnToNumber(advancedAuction.buyer2OrderSize)
          );

          await verifyBalancesAfterWithdraw(
            signers.buyer2,
            estimatedRefund,
            BigNumber.from(0),
            longTokenId
          );
        });

        it("should send buyer3 partial fill, and refund", async () => {
          const estimatedFill = advancedAuction.buyer3OrderSize.div(2);
          const args = await getEventArgs(
            advancedAuction.marketOrder,
            "OrderAdded"
          );

          const estimatedRefund = estimateRefund(
            advancedAuction.buyer3OrderSize,
            estimatedFill,
            fixedToNumber(args.price64x64),
            fixedToNumber(advancedAuction.clearingPrice64x64)
          );

          await verifyBalancesAfterWithdraw(
            signers.buyer3,
            estimatedRefund,
            estimatedFill,
            longTokenId
          );
        });
      });

      describe("else if all orders are filled", () => {
        let simpleAuction;
        let longTokenId: BigNumber;
        let epoch = BigNumber.from(0);

        time.revertToSnapshotAfterEach(async () => {
          simpleAuction = await setupSimpleAuction(true);
          [, , longTokenId] = await vault.getOption(epoch);
        });

        it("should send buyer1 fill and refund", async () => {
          const args = await getEventArgs(simpleAuction.txs[0], "OrderAdded");

          const estimatedRefund = estimateRefund(
            simpleAuction.buyerOrderSize,
            simpleAuction.buyerOrderSize,
            fixedToNumber(args.price64x64),
            fixedToNumber(simpleAuction.clearingPrice64x64)
          );

          const estimatedFill = simpleAuction.buyerOrderSize;

          await verifyBalancesAfterWithdraw(
            signers.buyer1,
            estimatedRefund,
            estimatedFill,
            longTokenId
          );
        });

        it("should send buyer2 fill and refund", async () => {
          const args = await getEventArgs(simpleAuction.txs[1], "OrderAdded");

          const estimatedRefund = estimateRefund(
            simpleAuction.buyerOrderSize,
            simpleAuction.buyerOrderSize,
            fixedToNumber(args.price64x64),
            fixedToNumber(simpleAuction.clearingPrice64x64)
          );

          const estimatedFill = simpleAuction.buyerOrderSize;

          await verifyBalancesAfterWithdraw(
            signers.buyer2,
            estimatedRefund,
            estimatedFill,
            longTokenId
          );
        });

        it("should send buyer3 fill only", async () => {
          const estimatedRefund = BigNumber.from(0);
          const estimatedFill = simpleAuction.buyerOrderSize;

          await verifyBalancesAfterWithdraw(
            signers.buyer3,
            estimatedRefund,
            estimatedFill,
            longTokenId
          );
        });
      });

      describe("else if options have expired ITM", () => {
        let advancedAuction;
        let spot: number;
        let underlyingPrice = params.underlying.oracle.price;
        let intrinsicValue = underlyingPrice * 0.5;
        let expiry: BigNumber;
        let longTokenId: BigNumber;
        let epoch = BigNumber.from(0);

        time.revertToSnapshotAfterEach(async () => {
          advancedAuction = await setupAdvancedAuction(true);

          // Make sure options expire ITM
          spot = params.isCall
            ? underlyingPrice + intrinsicValue
            : underlyingPrice - intrinsicValue;

          await poolUtil.underlyingSpotPriceOracle.mock.latestAnswer.returns(
            spot
          );

          // fast-forward to maturity date
          [expiry, , longTokenId] = await vault.getOption(epoch);
          await time.increaseTo(expiry.add(1));
          await knoxUtil.processExpiredOptions();
        });

        it("should send buyer1 exercised amount for fill and refund", async () => {
          let estimatedRefund = math.toUnits(
            math.bnToNumber(BigNumber.from(intrinsicValue), 8) *
              math.bnToNumber(advancedAuction.buyer1OrderSize)
          );

          if (params.isCall) {
            // convert to underlying amount
            estimatedRefund = estimatedRefund.div(
              math.bnToNumber(BigNumber.from(spot), 8)
            );
          }

          await verifyBalancesAfterWithdraw(
            signers.buyer1,
            estimatedRefund,
            BigNumber.from(0),
            longTokenId
          );
        });

        it("should send buyer2 refund, only", async () => {
          const estimatedRefund = math.toUnits(
            params.price.min * math.bnToNumber(advancedAuction.buyer2OrderSize)
          );

          await verifyBalancesAfterWithdraw(
            signers.buyer2,
            estimatedRefund,
            BigNumber.from(0),
            longTokenId
          );
        });

        it("should send buyer3 exercised amount for partial fill and refund", async () => {
          const estimatedFill = advancedAuction.buyer3OrderSize.div(2);

          let estimatedRefund = estimateRefund(
            advancedAuction.buyer3OrderSize,
            estimatedFill,
            params.price.max,
            fixedToNumber(advancedAuction.clearingPrice64x64)
          );

          let exercisedAmount = math.toUnits(
            math.bnToNumber(BigNumber.from(intrinsicValue), 8) *
              math.bnToNumber(estimatedFill)
          );

          if (params.isCall) {
            // convert to underlying amount
            exercisedAmount = exercisedAmount.div(
              math.bnToNumber(BigNumber.from(spot), 8)
            );
          }

          estimatedRefund = estimatedRefund.add(exercisedAmount);

          await verifyBalancesAfterWithdraw(
            signers.buyer3,
            estimatedRefund,
            BigNumber.from(0),
            longTokenId
          );
        });
      });

      describe("else if options have expired ATM", () => {
        let advancedAuction;
        let expiry: BigNumber;
        let longTokenId: BigNumber;
        let epoch = BigNumber.from(0);

        time.revertToSnapshotAfterEach(async () => {
          advancedAuction = await setupAdvancedAuction(true);

          // fast-forward to maturity date
          [expiry, , longTokenId] = await vault.getOption(epoch);
          await time.increaseTo(expiry.add(1));
          await knoxUtil.processExpiredOptions();
        });

        it("should send buyer1 refund for fill", async () => {
          const estimatedRefund = estimateRefund(
            advancedAuction.buyer1OrderSize,
            advancedAuction.buyer1OrderSize,
            params.price.max,
            fixedToNumber(advancedAuction.clearingPrice64x64)
          );

          await verifyBalancesAfterWithdraw(
            signers.buyer1,
            estimatedRefund,
            BigNumber.from(0),
            longTokenId
          );
        });

        it("should send buyer2 refund, only", async () => {
          const estimatedRefund = math.toUnits(
            params.price.min * math.bnToNumber(advancedAuction.buyer2OrderSize)
          );

          await verifyBalancesAfterWithdraw(
            signers.buyer2,
            estimatedRefund,
            BigNumber.from(0),
            longTokenId
          );
        });

        it("should send buyer3 overpaid amount for partial fill and refund", async () => {
          const estimatedFill = advancedAuction.buyer3OrderSize.div(2);
          const args = await getEventArgs(
            advancedAuction.marketOrder,
            "OrderAdded"
          );

          const estimatedRefund = estimateRefund(
            advancedAuction.buyer3OrderSize,
            estimatedFill,
            fixedToNumber(args.price64x64),
            fixedToNumber(advancedAuction.clearingPrice64x64)
          );

          await verifyBalancesAfterWithdraw(
            signers.buyer3,
            estimatedRefund,
            BigNumber.from(0),
            longTokenId
          );
        });
      });

      describe("else", () => {
        let simpleAuction;
        let epoch = BigNumber.from(0);

        time.revertToSnapshotAfterEach(async () => {
          simpleAuction = await setupSimpleAuction(true);
        });

        it("should remove tx1 from order book", async () => {
          await auction.withdraw(epoch);

          const args = await getEventArgs(simpleAuction.txs[0], "OrderAdded");
          const order = await auction.getOrderById(epoch, args.id);

          await assert.bnEqual(order.id, ethers.constants.Zero);
          await assert.bnEqual(order.price64x64, ethers.constants.Zero);
          await assert.bnEqual(order.size, ethers.constants.Zero);
          await assert.equal(order.buyer, ethers.constants.AddressZero);
        });

        it("should remove tx2 from order book", async () => {
          await auction.connect(signers.buyer2).withdraw(epoch);

          const args = await getEventArgs(simpleAuction.txs[1], "OrderAdded");
          const order = await auction.getOrderById(epoch, args.id);

          await assert.bnEqual(order.id, ethers.constants.Zero);
          await assert.bnEqual(order.price64x64, ethers.constants.Zero);
          await assert.bnEqual(order.size, ethers.constants.Zero);
          await assert.equal(order.buyer, ethers.constants.AddressZero);
        });

        it("should remove tx3 from order book", async () => {
          await auction.connect(signers.buyer3).withdraw(epoch);

          const args = await getEventArgs(simpleAuction.txs[2], "OrderAdded");
          const order = await auction.getOrderById(epoch, args.id);

          await assert.bnEqual(order.id, ethers.constants.Zero);
          await assert.bnEqual(order.price64x64, ethers.constants.Zero);
          await assert.bnEqual(order.size, ethers.constants.Zero);
          await assert.equal(order.buyer, ethers.constants.AddressZero);
        });
      });
    });

    describe("#previewWithdraw(uint64)", () => {
      describe("if cancelled", () => {
        const underlyingPrice = params.underlying.oracle.price;
        const basePrice = params.base.oracle.price;

        const strike = underlyingPrice / basePrice;
        const strike64x64 = fixedFromFloat(strike);

        let buyer1OrderSize1 = math.toUnits(40);
        let buyer1OrderSize2 = math.toUnits(1);
        let buyer2OrderSize = math.toUnits(20);
        let buyer3OrderSize = math.toUnits(10);

        let epoch = BigNumber.from(0);

        time.revertToSnapshotAfterEach(async () => {
          let timestamp = await time.now();
          const startTime = BigNumber.from(timestamp + 60);
          const endTime = BigNumber.from(timestamp + 86400);

          await auction.connect(signers.vault).initialize({
            epoch: epoch,
            strike64x64: strike64x64,
            longTokenId: BigNumber.from("1"),
            startTime: startTime,
            endTime: endTime,
          });

          await asset
            .connect(signers.buyer1)
            .approve(addresses.auction, ethers.constants.MaxUint256);

          await auction.addLimitOrder(epoch, maxPrice64x64, buyer1OrderSize1);
          await auction.addLimitOrder(epoch, minPrice64x64, buyer1OrderSize2);

          await asset
            .connect(signers.buyer2)
            .approve(addresses.auction, ethers.constants.MaxUint256);

          await auction
            .connect(signers.buyer2)
            .addLimitOrder(epoch, minPrice64x64, buyer2OrderSize);

          await asset
            .connect(signers.buyer3)
            .approve(addresses.auction, ethers.constants.MaxUint256);

          await auction
            .connect(signers.buyer3)
            .addLimitOrder(epoch, maxPrice64x64, buyer3OrderSize);

          // auction prices are unset, auction is cancelled
          await auction.connect(signers.vault).setAuctionPrices(epoch, 0, 0);
        });

        it("should preview buyer1 refund, only", async () => {
          const estimatedRefund =
            params.price.max * math.bnToNumber(buyer1OrderSize1) +
            params.price.min * math.bnToNumber(buyer1OrderSize2);

          const [refund, fill] = await auction.callStatic[
            "previewWithdraw(uint64)"
          ](epoch);

          assert.isTrue(fill.isZero());
          assert.equal(math.bnToNumber(refund), estimatedRefund);
        });

        it("should preview buyer2 refund, only", async () => {
          const estimatedRefund =
            params.price.min * math.bnToNumber(buyer2OrderSize);

          const [refund, fill] = await auction
            .connect(signers.buyer2)
            .callStatic["previewWithdraw(uint64)"](epoch);

          assert.isTrue(fill.isZero());
          assert.equal(math.bnToNumber(refund), estimatedRefund);
        });

        it("should preview buyer3 refund, only", async () => {
          const estimatedRefund =
            params.price.max * math.bnToNumber(buyer3OrderSize);

          const [refund, fill] = await auction
            .connect(signers.buyer3)
            .callStatic["previewWithdraw(uint64)"](epoch);

          assert.isTrue(fill.isZero());
          assert.equal(math.bnToNumber(refund), estimatedRefund);
        });
      });

      describe("else if some orders are filled", () => {
        let advancedAuction;
        let epoch = BigNumber.from(0);

        time.revertToSnapshotAfterEach(async () => {
          advancedAuction = await setupAdvancedAuction(false);
        });

        it("should preview buyer1 with fill and refund", async () => {
          const paid = math.toUnits(
            params.price.max * math.bnToNumber(advancedAuction.buyer1OrderSize)
          );

          const cost = math.toUnits(
            fixedToNumber(advancedAuction.clearingPrice64x64) *
              math.bnToNumber(advancedAuction.buyer1OrderSize)
          );

          const estimatedRefund = paid.sub(cost);

          const [refund, fill] = await auction
            .connect(signers.buyer1)
            .callStatic["previewWithdraw(uint64)"](epoch);

          expect(math.bnToNumber(refund)).to.almost(
            math.bnToNumber(estimatedRefund),
            1
          );

          expect(math.bnToNumber(fill)).to.almost(
            math.bnToNumber(advancedAuction.buyer1OrderSize),
            1
          );
        });

        it("should preview buyer2 with refund only", async () => {
          const estimatedRefund =
            params.price.min * math.bnToNumber(advancedAuction.buyer2OrderSize);

          const [refund, fill] = await auction
            .connect(signers.buyer2)
            .callStatic["previewWithdraw(uint64)"](epoch);

          assert.isTrue(fill.isZero());
          expect(math.bnToNumber(refund)).to.almost(estimatedRefund, 1);
        });

        it("should preview buyer3 with partial fill and refund", async () => {
          const estimatedFill = advancedAuction.buyer3OrderSize.div(2);
          const remainder = math.bnToNumber(
            advancedAuction.buyer3OrderSize.sub(estimatedFill)
          );
          const estimatedRefund = params.price.max * remainder;

          const [refund, fill] = await auction
            .connect(signers.buyer3)
            .callStatic["previewWithdraw(uint64)"](epoch);

          expect(math.bnToNumber(fill)).to.almost(
            math.bnToNumber(estimatedFill),
            1
          );
          expect(math.bnToNumber(refund)).to.almost(estimatedRefund, 1);
        });
      });

      describe("else if all orders are filled", () => {
        let simpleAuction;
        let epoch = BigNumber.from(0);

        time.revertToSnapshotAfterEach(async () => {
          simpleAuction = await setupSimpleAuction(true);
        });

        it("should preview buyer1 with fill and refund", async () => {
          const args = await getEventArgs(simpleAuction.txs[0], "OrderAdded");

          const estimatedRefund = estimateRefund(
            simpleAuction.buyerOrderSize,
            simpleAuction.buyerOrderSize,
            fixedToNumber(args.price64x64),
            fixedToNumber(simpleAuction.clearingPrice64x64)
          );

          const [refund, fill] = await auction.callStatic[
            "previewWithdraw(uint64)"
          ](epoch);

          expect(math.bnToNumber(refund)).to.almost(
            math.bnToNumber(estimatedRefund),
            1
          );
          expect(math.bnToNumber(fill)).to.almost(
            math.bnToNumber(simpleAuction.buyerOrderSize),
            1
          );
        });

        it("should preview buyer2 with fill and refund", async () => {
          const args = await getEventArgs(simpleAuction.txs[1], "OrderAdded");

          const estimatedRefund = estimateRefund(
            simpleAuction.buyerOrderSize,
            simpleAuction.buyerOrderSize,
            fixedToNumber(args.price64x64),
            fixedToNumber(simpleAuction.clearingPrice64x64)
          );

          const [refund, fill] = await auction
            .connect(signers.buyer2)
            .callStatic["previewWithdraw(uint64)"](epoch);

          expect(math.bnToNumber(refund)).to.almost(
            math.bnToNumber(estimatedRefund),
            1
          );
          expect(math.bnToNumber(fill)).to.almost(
            math.bnToNumber(simpleAuction.buyerOrderSize),
            1
          );
        });

        it("should preview buyer3 with fill only", async () => {
          const [refund, fill] = await auction
            .connect(signers.buyer3)
            .callStatic["previewWithdraw(uint64)"](epoch);

          expect(math.bnToNumber(refund)).to.almost(0, 1);
          expect(math.bnToNumber(fill)).to.almost(
            math.bnToNumber(simpleAuction.buyerOrderSize),
            1
          );
        });
      });

      describe("else", () => {
        let simpleAuction;
        let epoch = BigNumber.from(0);

        time.revertToSnapshotAfterEach(async () => {
          simpleAuction = await setupSimpleAuction(true);
        });

        it("should not remove tx1 from order book", async () => {
          await auction["previewWithdraw(uint64)"](epoch);

          const args = await getEventArgs(simpleAuction.txs[0], "OrderAdded");
          const order = await auction.getOrderById(epoch, args.id);

          await assert.bnEqual(order.id, args.id);
          await assert.bnEqual(order.price64x64, args.price64x64);
          await assert.bnEqual(order.size, args.size);
          await assert.equal(order.buyer, args.buyer);
        });

        it("should not remove tx2 from order book", async () => {
          await auction
            .connect(signers.buyer2)
            ["previewWithdraw(uint64)"](epoch);

          const args = await getEventArgs(simpleAuction.txs[1], "OrderAdded");
          const order = await auction.getOrderById(epoch, args.id);

          await assert.bnEqual(order.id, args.id);
          await assert.bnEqual(order.price64x64, args.price64x64);
          await assert.bnEqual(order.size, args.size);
          await assert.equal(order.buyer, args.buyer);
        });

        it("should not remove tx3 from order book", async () => {
          await auction
            .connect(signers.buyer3)
            ["previewWithdraw(uint64)"](epoch);

          const args = await getEventArgs(simpleAuction.txs[2], "OrderAdded");
          const order = await auction.getOrderById(epoch, args.id);

          await assert.bnEqual(order.id, args.id);
          await assert.bnEqual(order.price64x64, args.price64x64);
          await assert.bnEqual(order.size, args.size);
          await assert.equal(order.buyer, args.buyer);
        });
      });
    });

    describe("#getTotalContracts(uint64)", () => {
      time.revertToSnapshotAfterEach(async () => {
        await knoxUtil.setAndInitializeAuction();
      });

      it("should return the total contracts available", async () => {
        let expectedTotalContracts =
          math.bnToNumber(params.mint) * (1 - params.reserveRate64x64);

        if (!params.isCall) {
          const price =
            params.underlying.oracle.price / params.base.oracle.price;

          expectedTotalContracts = expectedTotalContracts / price;
        }

        assert.equal(
          math.bnToNumber(await auction.getTotalContracts(0)),
          expectedTotalContracts
        );
      });
    });
  });
}
