import { ethers } from "hardhat";
import { BigNumber, ContractTransaction } from "ethers";
const { provider } = ethers;
const { parseUnits } = ethers.utils;

import { fixedFromFloat, fixedToNumber } from "@premia/utils";
import { deployMockContract } from "ethereum-waffle";

import chai, { expect } from "chai";
import chaiAlmost from "chai-almost";

chai.use(chaiAlmost());

import {
  Auction,
  AuctionProxy,
  MockERC20,
  Queue,
  QueueProxy,
  Auction__factory,
  AuctionProxy__factory,
  Queue__factory,
  QueueProxy__factory,
} from "../types";

import * as accounts from "./utils/accounts";
import * as assets from "./utils/assets";
import * as math from "./utils/math";
import * as time from "./utils/time";
import * as types from "./utils/types";

import { assert } from "./utils/assertions";

import { MockPremiaPoolUtil } from "./utils/MockUtil";
import { VaultUtil } from "./utils/VaultUtil";

import moment from "moment-timezone";
moment.tz.setDefault("UTC");

describe("Auction Tests", () => {
  behavesLikeAuction({
    name: "Auction (Put Options)",
    tokenName: `Knox ETH Delta Vault`,
    tokenSymbol: `kETH-DELTA-P`,
    tokenDecimals: 18,
    asset: assets.DAI,
    delta: 0.4,
    deltaOffset: 0.05,
    mint: parseUnits("1000000", assets.DAI.decimals),
    size: parseUnits("10", assets.ETH.decimals),
    maxTVL: parseUnits("1000000", assets.DAI.decimals),
    minSize: BigNumber.from("10").pow(assets.DAI.decimals - 1),
    performanceFee: BigNumber.from("20000000"),
    withdrawalFee: BigNumber.from("2000000"),
    isCall: false,
  });

  behavesLikeAuction({
    name: "Auction (Call Options)",
    tokenName: `Knox ETH Delta Vault`,
    tokenSymbol: `kETH-DELTA-C`,
    tokenDecimals: 18,
    asset: assets.ETH,
    delta: 0.4,
    deltaOffset: 0.05,
    mint: parseUnits("1000", assets.ETH.decimals),
    size: parseUnits("10", assets.ETH.decimals),
    maxTVL: parseUnits("100", assets.ETH.decimals),
    minSize: BigNumber.from("10").pow(assets.ETH.decimals - 1),
    performanceFee: BigNumber.from("20000000"),
    withdrawalFee: BigNumber.from("2000000"),
    isCall: true,
  });
});

interface Params extends types.VaultParams {
  name: string;
  isCall: boolean;
  mint: BigNumber;
  size: BigNumber;
  maxTVL: BigNumber;
}

function behavesLikeAuction(params: Params) {
  describe.only(params.name, () => {
    math.setDecimals(params.asset.decimals);

    let block;
    let asset: MockERC20;
    let queue: Queue;
    let queueProxy: QueueProxy;
    let instance: Auction;
    let auctionProxy: AuctionProxy;
    let mockPremiaPool: MockPremiaPoolUtil;
    let v: VaultUtil;
    let addresses: types.Addresses;
    let signers: types.Signers;

    let startTime;
    let endTime;

    let epoch = 1;

    let maxPrice = 0.1;
    let maxPrice64x64 = fixedFromFloat(maxPrice);

    let minPrice = 0.01;
    let minPrice64x64 = fixedFromFloat(minPrice);

    let strike = 2000;
    let strike64x64 = fixedFromFloat(strike);

    let expiry: BigNumber;
    let longTokenId: BigNumber;
    let shortTokenId: BigNumber;

    before(async () => {
      signers = await accounts.getSigners();
      addresses = await accounts.getAddresses(signers);

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

      v = await VaultUtil.deploy(params, signers, addresses);

      addresses.vault = v.vault.address;

      queue = await new Queue__factory(signers.deployer).deploy(
        params.isCall,
        addresses.pool,
        addresses.vault
      );

      queueProxy = await new QueueProxy__factory(signers.deployer).deploy(
        params.maxTVL,
        queue.address,
        addresses.vault
      );

      queue = Queue__factory.connect(queueProxy.address, signers.lp1);
      addresses.queue = queue.address;

      instance = await new Auction__factory(signers.deployer).deploy(
        params.isCall,
        addresses.pool,
        addresses.vault
      );

      auctionProxy = await new AuctionProxy__factory(signers.deployer).deploy(
        params.minSize,
        instance.address,
        addresses.deployer
      );

      instance = Auction__factory.connect(auctionProxy.address, signers.buyer1);
      addresses.auction = instance.address;

      const mockPricer = await deployMockContract(signers.deployer as any, [
        "function getDeltaStrikePrice64x64(bool,uint64,int128) external view returns (int128)",
        "function snapToGrid(bool,int128) external view returns (int128)",
      ]);

      await mockPricer.mock.getDeltaStrikePrice64x64.returns(strike64x64);
      await mockPricer.mock.snapToGrid.returns(strike64x64);

      addresses.pricer = mockPricer.address;

      const initImpl = {
        auction: addresses.auction,
        queue: addresses.queue,
        pricer: addresses.pricer,
      };

      await v.vault.connect(signers.deployer).initialize(initImpl);

      asset = v.asset;

      asset = params.isCall
        ? mockPremiaPool.underlyingAsset
        : mockPremiaPool.baseAsset;

      asset.connect(signers.deployer).mint(addresses.buyer1, params.mint);
      asset.connect(signers.deployer).mint(addresses.buyer2, params.mint);
      asset.connect(signers.deployer).mint(addresses.buyer3, params.mint);
      asset.connect(signers.deployer).mint(addresses.vault, params.mint);

      block = await provider.getBlock(await provider.getBlockNumber());
    });

    // Helper Functions
    const setupAuction = async (
      epoch: number,
      maxPrice64x64: BigNumber,
      minPrice64x64: BigNumber
    ): Promise<[BigNumber, BigNumber]> => {
      const [startTime, endTime] = await initializeAuction(epoch);

      await instance
        .connect(signers.deployer)
        .setAuctionPrices(epoch, maxPrice64x64, minPrice64x64);

      return [startTime, endTime];
    };

    const initializeAuction = async (
      epoch: number
    ): Promise<[BigNumber, BigNumber]> => {
      const startTime = BigNumber.from(block.timestamp + 60);
      const endTime = BigNumber.from(block.timestamp + 86400);

      await v.vault.connect(signers.keeper).setOptionParameters();

      [expiry, strike64x64, longTokenId, shortTokenId] =
        await v.vault.optionByEpoch(epoch);

      // Options expire ATM by default
      await mockPremiaPool.pool.setSpot64x64(strike64x64);

      await v.vault.connect(signers.keeper).setNextEpoch();

      await instance.connect(signers.deployer).initialize({
        epoch: epoch,
        strike64x64: strike64x64,
        longTokenId: longTokenId,
        startTime: startTime,
        endTime: endTime,
      });

      return [startTime, endTime];
    };

    const utilizeAllContracts = async (
      epoch: number
    ): Promise<[ContractTransaction[], BigNumber]> => {
      let totalContracts = await instance.totalContracts(epoch);
      const size = totalContracts.div(3).add(1);

      await asset
        .connect(signers.buyer1)
        .approve(addresses.auction, ethers.constants.MaxUint256);

      const tx1 = await instance.addMarketOrder(epoch, size);
      await time.increase(100);

      await asset
        .connect(signers.buyer2)
        .approve(addresses.auction, ethers.constants.MaxUint256);

      const tx2 = await instance
        .connect(signers.buyer2)
        .addMarketOrder(epoch, size);
      await time.increase(100);

      await asset
        .connect(signers.buyer3)
        .approve(addresses.auction, ethers.constants.MaxUint256);

      const tx3 = await instance
        .connect(signers.buyer3)
        .addMarketOrder(epoch, size);

      return [[tx1, tx2, tx3], totalContracts];
    };

    const calculateEstimatedRefund = (
      size,
      fill,
      pricePaid,
      clearingPrice64x64
    ) => {
      const paid = math.toUnits(pricePaid * math.bnToNumber(size));
      const cost = math.toUnits(clearingPrice64x64 * math.bnToNumber(fill));
      return paid.sub(cost);
    };

    describe("#constructor()", () => {
      time.revertToSnapshotAfterEach(async () => {});

      it("should initialize Auction with correct state", async () => {
        await assert.equal(await instance.ERC20(), asset.address);
        await assert.equal(await instance.Vault(), addresses.vault);
        // TODO: await assert.equal(await instance.getMinSize(), params.minSize);
      });
    });

    describe("#initialize(AuctionStorage.InitAuction)", () => {
      time.revertToSnapshotAfterEach(async () => {});

      it("should revert if caller is !vault", async () => {
        await expect(
          instance.initialize({
            epoch: epoch,
            strike64x64: strike64x64,
            longTokenId: BigNumber.from("1"),
            startTime: BigNumber.from(block.timestamp + 60),
            endTime: BigNumber.from(block.timestamp + 86400),
          })
        ).to.be.revertedWith("!vault");
      });

      it.skip("should revert if auction initialized", async () => {});

      it.skip("should revert if endTime < startTime", async () => {});

      it.skip("should revert if block.timestamp < startTime", async () => {});

      it("should initialize new auction with correct state", async () => {
        const initAuction = {
          epoch: epoch,
          strike64x64: strike64x64,
          longTokenId: BigNumber.from("1"),
          startTime: BigNumber.from(block.timestamp + 60),
          endTime: BigNumber.from(block.timestamp + 86400),
        };

        await instance.connect(signers.deployer).initialize(initAuction);

        const auction = await instance.getAuction(epoch);

        assert.equal(await instance.status(epoch), 0);

        await assert.bnEqual(auction.startTime, initAuction.startTime);
        await assert.bnEqual(auction.endTime, initAuction.endTime);

        await assert.bnEqual(auction.totalContracts, ethers.constants.Zero);
        await assert.bnEqual(auction.totalContractsSold, ethers.constants.Zero);

        await assert.bnEqual(auction.totalPremiums, ethers.constants.Zero);
        await assert.bnEqual(
          auction.totalTime,
          initAuction.endTime.sub(initAuction.startTime)
        );

        await assert.bnEqual(auction.lastPrice64x64, ethers.constants.Zero);
        await assert.bnEqual(auction.longTokenId, initAuction.longTokenId);
      });
    });

    describe("#setAuctionPrices(uint64,int128,int128)", () => {
      describe("if not initialized", () => {
        it.skip("should revert", async () => {});
      });

      describe("else", () => {
        time.revertToSnapshotAfterEach(async () => {
          await initializeAuction(epoch);
        });

        it("should revert if caller is !vault", async () => {
          await expect(
            instance.setAuctionPrices(epoch, maxPrice64x64, minPrice64x64)
          ).to.be.revertedWith("!vault");
        });

        it.skip("should revert if auction initialized", async () => {});

        it("should cancel auction if maxPrice64x64 >= minPrice64x64", async () => {
          await instance
            .connect(signers.deployer)
            .setAuctionPrices(epoch, minPrice64x64, maxPrice64x64);

          assert.equal(await instance.status(epoch), 3);
        });

        it("should cancel auction if maxPrice64x64 <= 0", async () => {
          await instance
            .connect(signers.deployer)
            .setAuctionPrices(epoch, 0, minPrice64x64);

          assert.equal(await instance.status(epoch), 3);
        });

        it("should cancel auction if minPrice64x64 <= 0", async () => {
          await instance
            .connect(signers.deployer)
            .setAuctionPrices(epoch, maxPrice64x64, 0);

          assert.equal(await instance.status(epoch), 3);
        });

        it("should set correct auction prices", async () => {
          await instance
            .connect(signers.deployer)
            .setAuctionPrices(epoch, maxPrice64x64, minPrice64x64);

          const auction = await instance.getAuction(epoch);

          await assert.bnEqual(auction.maxPrice64x64, maxPrice64x64);
          await assert.bnEqual(auction.minPrice64x64, minPrice64x64);
        });
      });
    });

    describe("#priceCurve64x64(uint64)", () => {
      describe("if not initialized", () => {
        it.skip("should revert", async () => {});
      });

      describe("else", () => {
        time.revertToSnapshotAfterEach(async () => {
          [startTime, endTime] = await initializeAuction(epoch);

          await instance
            .connect(signers.deployer)
            .setAuctionPrices(epoch, maxPrice64x64, minPrice64x64);
        });

        it("should return max price", async () => {
          const priceBeforeAuctionStart = fixedToNumber(
            await instance.priceCurve64x64(epoch)
          );

          expect(priceBeforeAuctionStart).to.almost(
            fixedToNumber(maxPrice64x64),
            0.01
          );

          await time.increaseTo(startTime);

          const priceAtAuctionStart = fixedToNumber(
            await instance.priceCurve64x64(epoch)
          );

          expect(priceAtAuctionStart).to.almost(
            fixedToNumber(maxPrice64x64),
            0.01
          );
        });

        it("should return min price", async () => {
          await time.increaseTo(endTime);
          assert.bnEqual(await instance.priceCurve64x64(epoch), minPrice64x64);
        });
      });
    });

    describe("#addLimitOrder(uint64,uint256,uint256)", () => {
      describe("if not initialized", () => {
        it.skip("should revert", async () => {});
      });

      describe("else", () => {
        const cost = params.size.div(10);

        time.revertToSnapshotAfterEach(async () => {
          await initializeAuction(epoch);
        });

        it.skip("should revert if auction is finalized", async () => {});

        it.skip("should revert if price <= 0", async () => {});

        it("should revert if order size is below min size", async () => {
          await expect(
            instance.addLimitOrder(
              epoch,
              fixedFromFloat("0.1"),
              parseUnits("1", params.asset.decimals - 2)
            )
          ).to.be.revertedWith("size < minimum");
        });

        it.skip("should revert auction finalizes", async () => {});

        it("should emit OrderAdded event if successful", async () => {
          await asset.connect(signers.buyer1).approve(addresses.auction, cost);

          const price = fixedFromFloat("0.1");

          await expect(instance.addLimitOrder(epoch, price, params.size))
            .to.emit(instance, "OrderAdded")
            .withArgs(1, addresses.buyer1, price, params.size, true);
        });

        it("should send funds to Auction if successful", async () => {
          const auctionBalanceBefore = await asset.balanceOf(addresses.auction);
          const buyerBalanceBefore = await asset.balanceOf(addresses.buyer1);

          await asset.connect(signers.buyer1).approve(addresses.auction, cost);

          await instance.addLimitOrder(
            epoch,
            fixedFromFloat("0.1"),
            params.size
          );

          const auctionBalanceAfter = await asset.balanceOf(addresses.auction);
          const buyerBalanceAfter = await asset.balanceOf(addresses.buyer1);

          expect(math.bnToNumber(auctionBalanceAfter)).to.almost(
            math.bnToNumber(auctionBalanceBefore.add(cost)),
            1
          );

          expect(math.bnToNumber(buyerBalanceAfter)).to.almost(
            math.bnToNumber(buyerBalanceBefore.sub(cost)),
            1
          );
        });

        it("should add order to orderbook if successful", async () => {
          await asset.connect(signers.buyer1).approve(addresses.auction, cost);

          const tx = await instance.addLimitOrder(
            epoch,
            fixedFromFloat("0.1"),
            params.size
          );

          const args = await getEventArgs(tx, "OrderAdded");
          const order = await instance.getOrderById(epoch, args.id);

          await assert.bnEqual(order[0], BigNumber.from("1"));
          await assert.bnEqual(order[1], fixedFromFloat("0.1"));
          await assert.bnEqual(order[2], params.size);
          await assert.equal(order[3], addresses.buyer1);
        });

        it.skip("should add claim to claim by buyer if successful", async () => {});
      });
    });

    describe("#cancelLimitOrder(uint64,uint256)", () => {
      describe("if not initialized", () => {
        it.skip("should revert", async () => {});
      });

      describe("else", () => {
        const cost = params.size.div(10);

        time.revertToSnapshotAfterEach(async () => {
          await initializeAuction(epoch);
          await asset.connect(signers.buyer1).approve(addresses.auction, cost);

          await instance.addLimitOrder(
            epoch,
            fixedFromFloat("0.1"),
            params.size
          );
        });

        it("should revert if order id is invalid", async () => {
          await expect(instance.cancelLimitOrder(epoch, 0)).to.be.revertedWith(
            "invalid order id"
          );
        });

        it("should revert if order is not in orderbook", async () => {
          await expect(instance.cancelLimitOrder(epoch, 2)).to.be.revertedWith(
            "order does not exist"
          );
        });

        it("should revert if buyer != sender", async () => {
          await expect(
            instance.connect(signers.buyer2).cancelLimitOrder(epoch, 1)
          ).to.be.revertedWith("buyer != msg.sender");
        });

        it.skip("should revert if auction is finalized", async () => {});

        it.skip("should revert auction finalizes", async () => {});

        it("should issue refund if successful", async () => {
          const auctionBalanceBefore = await asset.balanceOf(addresses.auction);
          const buyerBalanceBefore = await asset.balanceOf(addresses.buyer1);

          await instance.cancelLimitOrder(epoch, 1);

          const auctionBalanceAfter = await asset.balanceOf(addresses.auction);
          const buyerBalanceAfter = await asset.balanceOf(addresses.buyer1);

          expect(math.bnToNumber(auctionBalanceAfter)).to.almost(
            math.bnToNumber(auctionBalanceBefore.sub(cost)),
            1
          );

          expect(math.bnToNumber(buyerBalanceAfter)).to.almost(
            math.bnToNumber(buyerBalanceBefore.add(cost)),
            1
          );
        });

        it("should remove order from orderbook if successful", async () => {
          await instance.cancelLimitOrder(epoch, 1);

          const order = await instance.getOrderById(epoch, 1);

          await assert.bnEqual(order[0], ethers.constants.Zero);
          await assert.bnEqual(order[1], ethers.constants.Zero);
          await assert.bnEqual(order[2], ethers.constants.Zero);
          await assert.equal(order[3], ethers.constants.AddressZero);
        });

        it.skip("should remove claim from claim by buyer if successful", async () => {});
      });
    });

    describe("#addMarketOrder(uint64,uint256)", () => {
      describe("if not initialized", () => {
        it.skip("should revert", async () => {});
      });

      describe("else", () => {
        time.revertToSnapshotAfterEach(async () => {
          [startTime, endTime] = await initializeAuction(epoch);

          await instance
            .connect(signers.deployer)
            .setAuctionPrices(epoch, maxPrice64x64, minPrice64x64);
        });

        it.skip("should revert if auction has not started", async () => {});

        it.skip("should revert if auction is finalized", async () => {});

        it.skip("should revert if auction is cancelled", async () => {});

        it("should revert if order size is below min size", async () => {
          await expect(
            instance.addMarketOrder(
              epoch,
              parseUnits("1", params.asset.decimals - 2)
            )
          ).to.be.revertedWith("size < minimum");
        });

        it.skip("should revert auction finalizes", async () => {});

        it("should set the totalContracts equal to Vault ERC20 balance if totalContracts is unset", async () => {
          await time.increaseTo(startTime);

          let totalContracts = await instance.totalContracts(epoch);

          const price64x64 = await instance.priceCurve64x64(epoch);
          const price = fixedToNumber(price64x64);
          const cost = price * math.bnToNumber(params.size);
          const bnCost = math.toUnits(cost);

          await asset
            .connect(signers.buyer1)
            .approve(addresses.auction, bnCost);

          await instance.addMarketOrder(epoch, params.size);
          const auction = await instance.getAuction(epoch);
          await assert.bnEqual(auction.totalContracts, totalContracts);
        });

        it("should emit OrderAdded event if successful", async () => {
          await time.increaseTo(startTime);

          const price64x64 = await instance.priceCurve64x64(epoch);
          const price = fixedToNumber(price64x64);
          const cost = price * math.bnToNumber(params.size);
          const bnCost = math.toUnits(cost);

          await asset
            .connect(signers.buyer1)
            .approve(addresses.auction, bnCost);

          const tx = await instance.addMarketOrder(epoch, params.size);
          const args = await getEventArgs(tx, "OrderAdded");

          await expect(tx).to.emit(instance, "OrderAdded").withArgs(
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

          await time.increaseTo(startTime);

          const price = fixedToNumber(await instance.priceCurve64x64(epoch));
          const cost = price * math.bnToNumber(params.size);
          const bnCost = math.toUnits(cost);

          await asset
            .connect(signers.buyer1)
            .approve(addresses.auction, bnCost);

          await instance.addMarketOrder(epoch, params.size);

          const auctionBalanceAfter = await asset.balanceOf(addresses.auction);
          const buyerBalanceAfter = await asset.balanceOf(addresses.buyer1);

          expect(math.bnToNumber(auctionBalanceAfter)).to.almost(
            math.bnToNumber(auctionBalanceBefore.add(bnCost)),
            1
          );

          expect(math.bnToNumber(buyerBalanceAfter)).to.almost(
            math.bnToNumber(buyerBalanceBefore.sub(bnCost)),
            1
          );
        });

        it("should add order to orderbook if successful", async () => {
          await time.increaseTo(startTime);

          const price64x64 = await instance.priceCurve64x64(epoch);
          const price = fixedToNumber(price64x64);
          const cost = price * math.bnToNumber(params.size);
          const bnCost = math.toUnits(cost);

          await asset
            .connect(signers.buyer1)
            .approve(addresses.auction, bnCost);

          const tx = await instance.addMarketOrder(epoch, params.size);
          const args = await getEventArgs(tx, "OrderAdded");

          const order = await instance.getOrderById(epoch, args.id);

          await assert.bnEqual(order[0], BigNumber.from("1"));

          // Exact price depends on the time the tx was settled
          await assert.equal(order[1].toString(), args.price64x64);

          await assert.bnEqual(order[2], params.size);
          await assert.equal(order[3], addresses.buyer1);
        });

        it.skip("should add claim to claim by buyer if successful", async () => {});
      });
    });

    describe("#processOrders(uint64)", () => {
      describe("if not initialized", () => {
        it.skip("should revert", async () => {});
      });

      describe("else", () => {
        time.revertToSnapshotAfterEach(async () => {
          [startTime] = await setupAuction(epoch, maxPrice64x64, minPrice64x64);
        });

        it.skip("should revert if auction has not started", async () => {});

        it.skip("should revert if auction is finalized", async () => {});

        it.skip("should revert if auction is cancelled", async () => {});

        it("should return true if vault utilization == 100%", async () => {
          await time.increaseTo(startTime);

          const [txs, totalContractsSold] = await utilizeAllContracts(epoch);

          // Gets args of last tx
          const args = await getEventArgs(txs[2], "OrderAdded");

          await instance.processOrders(epoch);

          assert.isTrue(await instance.callStatic.processOrders(epoch));

          assert.bnEqual(
            await instance.totalContractsSold(epoch),
            totalContractsSold
          );

          assert.bnEqual(await instance.lastPrice64x64(epoch), args.price64x64);
        });

        it("should return false if vault utilization < 100%", async () => {
          await time.increaseTo(startTime);

          await asset
            .connect(signers.buyer1)
            .approve(addresses.auction, ethers.constants.MaxUint256);

          const tx = await instance
            .connect(signers.buyer1)
            .addMarketOrder(epoch, params.size);

          const args = await getEventArgs(tx, "OrderAdded");

          await instance.processOrders(epoch);
          assert.isFalse(await instance.callStatic.processOrders(epoch));

          assert.bnEqual(await instance.totalContractsSold(epoch), params.size);
          assert.bnEqual(await instance.lastPrice64x64(epoch), args.price64x64);
        });

        it("should only process orders where price > clearing price", async () => {
          await asset
            .connect(signers.buyer1)
            .approve(addresses.auction, ethers.constants.MaxUint256);

          await instance.addLimitOrder(
            epoch,
            fixedFromFloat("0.05"),
            params.size
          );

          await asset
            .connect(signers.buyer1)
            .approve(addresses.auction, ethers.constants.MaxUint256);

          await instance.addLimitOrder(
            epoch,
            fixedFromFloat("0.03"),
            params.size
          );

          await asset
            .connect(signers.buyer1)
            .approve(addresses.auction, ethers.constants.MaxUint256);

          await instance.addLimitOrder(
            epoch,
            fixedFromFloat("0.01"),
            params.size
          );

          await time.increaseTo(startTime);

          await asset
            .connect(signers.buyer1)
            .approve(addresses.auction, ethers.constants.MaxUint256);

          // All limit orders fail to fill
          const tx = await instance.addMarketOrder(epoch, params.size);
          const args = await getEventArgs(tx, "OrderAdded");

          await instance.processOrders(epoch);

          assert.isFalse(await instance.callStatic.processOrders(epoch));
          assert.bnEqual(await instance.totalContractsSold(epoch), params.size);
          assert.bnEqual(await instance.lastPrice64x64(epoch), args.price64x64);
        });
      });
    });

    describe("#finalizeAuction(uint64)", () => {
      describe("if not initialized", () => {
        it.skip("should revert", async () => {});
      });

      describe("else if auction price is not set", () => {
        time.revertToSnapshotAfterEach(async () => {
          await initializeAuction(epoch);
        });

        it("should return false if max price == 0", async () => {
          await instance
            .connect(signers.deployer)
            .setAuctionPrices(epoch, 0, fixedFromFloat("0.01"));
          assert.isFalse(await instance.callStatic.finalizeAuction(epoch));
        });

        it("should return false if min price == 0", async () => {
          await instance
            .connect(signers.deployer)
            .setAuctionPrices(epoch, fixedFromFloat("0.1"), 0);
          assert.isFalse(await instance.callStatic.finalizeAuction(epoch));
        });

        it("should emit AuctionStatus event when cancelled", async () => {
          await instance
            .connect(signers.deployer)
            .setAuctionPrices(epoch, 0, 0);

          const tx = await instance.finalizeAuction(epoch);
          await expect(tx).to.emit(instance, "AuctionStatus").withArgs(3);
        });
      });

      describe("else", () => {
        time.revertToSnapshotAfterEach(async () => {
          [startTime, endTime] = await setupAuction(
            epoch,
            maxPrice64x64,
            minPrice64x64
          );
        });

        it.skip("should revert if auction has not started", async () => {});

        it.skip("should revert if auction is finalized", async () => {});

        it.skip("should revert if auction is cancelled", async () => {});

        it("should return false if auction is not finalized", async () => {
          assert.isFalse(await instance.callStatic.finalizeAuction(epoch));
        });

        it("should return true if auction utilization == 100%", async () => {
          await time.increaseTo(startTime);
          const [, totalContractsSold] = await utilizeAllContracts(epoch);
          assert.isTrue(await instance.callStatic.finalizeAuction(epoch));
        });

        it("should return true if auction timer has expired", async () => {
          await time.increaseTo(endTime.add(1));
          assert.isTrue(await instance.callStatic.finalizeAuction(epoch));
        });

        it("should emit AuctionStatus event when finalized", async () => {
          await time.increaseTo(endTime.add(1));
          const tx = await instance.finalizeAuction(epoch);
          await expect(tx).to.emit(instance, "AuctionStatus").withArgs(1);
        });
      });
    });

    describe("#transferPremium(uint64)", () => {
      describe("if not finalized", () => {
        it.skip("should revert", async () => {});
      });

      describe("else if utilization == 100%", () => {
        time.revertToSnapshotAfterEach(async () => {
          [, endTime] = await setupAuction(epoch, maxPrice64x64, minPrice64x64);
          await utilizeAllContracts(epoch);
          await time.increaseTo(endTime.add(1));
          await instance.finalizeAuction(epoch);
        });

        it.skip("should revert if auction is processed", async () => {});

        it.skip("should revert if auction is cancelled", async () => {});

        it("should revert if premiums have been transferred", async () => {
          await instance.transferPremium(epoch);
          await expect(instance.transferPremium(epoch)).to.be.revertedWith(
            "premiums transferred"
          );
        });

        it("should transfer premiums to Vault if successful", async () => {
          const auctionBalanceBefore = await asset.balanceOf(addresses.auction);
          const vaultBalanceBefore = await asset.balanceOf(addresses.vault);

          await instance.transferPremium(epoch);
          const { totalPremiums } = await instance.getAuction(epoch);

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
    });

    describe("#processAuction(uint64)", () => {
      describe("if not finalized", () => {
        it.skip("should revert", async () => {});
      });

      describe("else if auction has no orders", () => {
        time.revertToSnapshotAfterEach(async () => {
          [, endTime] = await setupAuction(epoch, maxPrice64x64, minPrice64x64);

          await time.increaseTo(endTime.add(1));
          await instance.finalizeAuction(epoch);
        });

        it("should emit AuctionStatus event when processed", async () => {
          const tx = await instance.processAuction(epoch);
          await expect(tx).to.emit(instance, "AuctionStatus").withArgs(2);
        });
      });

      describe("else if utilization == 100%", () => {
        time.revertToSnapshotAfterEach(async () => {
          [, endTime] = await setupAuction(epoch, maxPrice64x64, minPrice64x64);

          await utilizeAllContracts(epoch);
          await time.increaseTo(endTime.add(1));
          await instance.finalizeAuction(epoch);
        });

        it.skip("should revert if auction is processed", async () => {});

        it.skip("should revert if auction is cancelled", async () => {});

        it("should revert if premiums have not been transferred to Vault", async () => {
          await expect(instance.processAuction(epoch)).to.be.revertedWith(
            "premiums not transferred"
          );
        });

        it("should revert if long tokens have not been transferred to Auction", async () => {
          await instance.transferPremium(epoch);
          await expect(instance.processAuction(epoch)).to.be.revertedWith(
            "long tokens not transferred"
          );
        });

        it("should emit AuctionStatus event when processed", async () => {
          await expect(v.vault.processAuction())
            .to.emit(instance, "AuctionStatus")
            .withArgs(2);
        });
      });
    });

    describe("#withdraw(uin64)", () => {
      describe("if not processed", () => {
        it.skip("should revert", async () => {});
      });

      describe("else if cancelled", () => {
        let buyer1OrderSize1 = math.toUnits(40);
        let buyer1OrderSize2 = math.toUnits(1);
        let buyer2OrderSize = math.toUnits(20);
        let buyer3OrderSize = math.toUnits(10);

        let longTokenId = BigNumber.from("1");

        time.revertToSnapshotAfterEach(async () => {
          const startTime = BigNumber.from(block.timestamp + 60);
          const endTime = BigNumber.from(block.timestamp + 86400);

          await instance.connect(signers.deployer).initialize({
            epoch: epoch,
            strike64x64: strike64x64,
            longTokenId: longTokenId,
            startTime: startTime,
            endTime: endTime,
          });

          await asset
            .connect(signers.buyer1)
            .approve(addresses.auction, ethers.constants.MaxUint256);

          await instance.addLimitOrder(epoch, maxPrice64x64, buyer1OrderSize1);
          await instance.addLimitOrder(epoch, minPrice64x64, buyer1OrderSize2);

          await asset
            .connect(signers.buyer2)
            .approve(addresses.auction, ethers.constants.MaxUint256);

          await instance
            .connect(signers.buyer2)
            .addLimitOrder(epoch, minPrice64x64, buyer2OrderSize);

          await asset
            .connect(signers.buyer3)
            .approve(addresses.auction, ethers.constants.MaxUint256);

          await instance
            .connect(signers.buyer3)
            .addLimitOrder(epoch, maxPrice64x64, buyer3OrderSize);

          await instance
            .connect(signers.deployer)
            .setAuctionPrices(epoch, 0, 0);

          await instance.finalizeAuction(epoch);
          await v.vault.processAuction();
        });

        it("should send buyer1 refund, only", async () => {
          const estimatedRefund = math.toUnits(
            maxPrice * math.bnToNumber(buyer1OrderSize1) +
              minPrice * math.bnToNumber(buyer1OrderSize2)
          );

          const auctionERC20BalanceBefore = await asset.balanceOf(
            addresses.auction
          );

          const auctionERC1155BalanceBefore =
            await mockPremiaPool.pool.balanceOf(addresses.auction, longTokenId);

          const buyerERC20BalanceBefore = await asset.balanceOf(
            addresses.buyer1
          );

          const buyerERC1155BalanceBefore = await mockPremiaPool.pool.balanceOf(
            addresses.buyer1,
            longTokenId
          );

          await instance.withdraw(epoch);

          const auctionERC20BalanceAfter = await asset.balanceOf(
            addresses.auction
          );

          const auctionERC1155BalanceAfter =
            await mockPremiaPool.pool.balanceOf(addresses.auction, longTokenId);

          const buyerERC20BalanceAfter = await asset.balanceOf(
            addresses.buyer1
          );

          const buyerERC1155BalanceAfter = await mockPremiaPool.pool.balanceOf(
            addresses.buyer1,
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

          assert.bnEqual(
            auctionERC1155BalanceAfter,
            auctionERC1155BalanceBefore
          );

          assert.bnEqual(buyerERC1155BalanceAfter, buyerERC1155BalanceBefore);
        });

        it("should send buyer2 refund, only", async () => {
          const estimatedRefund = math.toUnits(
            minPrice * math.bnToNumber(buyer2OrderSize)
          );

          const auctionERC20BalanceBefore = await asset.balanceOf(
            addresses.auction
          );

          const auctionERC1155BalanceBefore =
            await mockPremiaPool.pool.balanceOf(addresses.auction, longTokenId);

          const buyerERC20BalanceBefore = await asset.balanceOf(
            addresses.buyer2
          );

          const buyerERC1155BalanceBefore = await mockPremiaPool.pool.balanceOf(
            addresses.buyer2,
            longTokenId
          );

          await instance.connect(signers.buyer2).withdraw(epoch);

          const auctionERC20BalanceAfter = await asset.balanceOf(
            addresses.auction
          );

          const auctionERC1155BalanceAfter =
            await mockPremiaPool.pool.balanceOf(addresses.auction, longTokenId);

          const buyerERC20BalanceAfter = await asset.balanceOf(
            addresses.buyer2
          );

          const buyerERC1155BalanceAfter = await mockPremiaPool.pool.balanceOf(
            addresses.buyer2,
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

          assert.bnEqual(
            auctionERC1155BalanceAfter,
            auctionERC1155BalanceBefore
          );

          assert.bnEqual(buyerERC1155BalanceAfter, buyerERC1155BalanceBefore);
        });

        it("should send buyer3 refund, only", async () => {
          const estimatedRefund = math.toUnits(
            maxPrice * math.bnToNumber(buyer3OrderSize)
          );

          const auctionERC20BalanceBefore = await asset.balanceOf(
            addresses.auction
          );

          const auctionERC1155BalanceBefore =
            await mockPremiaPool.pool.balanceOf(addresses.auction, longTokenId);

          const buyerERC20BalanceBefore = await asset.balanceOf(
            addresses.buyer3
          );

          const buyerERC1155BalanceBefore = await mockPremiaPool.pool.balanceOf(
            addresses.buyer3,
            longTokenId
          );

          await instance.connect(signers.buyer3).withdraw(epoch);

          const auctionERC20BalanceAfter = await asset.balanceOf(
            addresses.auction
          );

          const auctionERC1155BalanceAfter =
            await mockPremiaPool.pool.balanceOf(addresses.auction, longTokenId);

          const buyerERC20BalanceAfter = await asset.balanceOf(
            addresses.buyer3
          );

          const buyerERC1155BalanceAfter = await mockPremiaPool.pool.balanceOf(
            addresses.buyer3,
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

          assert.bnEqual(
            auctionERC1155BalanceAfter,
            auctionERC1155BalanceBefore
          );

          assert.bnEqual(buyerERC1155BalanceAfter, buyerERC1155BalanceBefore);
        });
      });

      describe("else if some orders are filled", () => {
        let buyer1OrderSize;
        let buyer2OrderSize;
        let buyer3OrderSize;
        let tx3;
        let clearingPrice64x64;

        time.revertToSnapshotAfterEach(async () => {
          [startTime, endTime] = await setupAuction(
            epoch,
            maxPrice64x64,
            minPrice64x64
          );

          const totalContracts = await instance.totalContracts(epoch);

          buyer1OrderSize = totalContracts.sub(totalContracts.div(10));
          buyer2OrderSize = totalContracts;
          buyer3OrderSize = totalContracts.div(10).mul(2);

          await asset
            .connect(signers.buyer1)
            .approve(addresses.auction, ethers.constants.MaxUint256);

          await instance.addLimitOrder(epoch, maxPrice64x64, buyer1OrderSize);

          await asset
            .connect(signers.buyer2)
            .approve(addresses.auction, ethers.constants.MaxUint256);

          await instance
            .connect(signers.buyer2)
            .addLimitOrder(epoch, minPrice64x64, buyer2OrderSize);

          await time.increaseTo(startTime);

          await asset
            .connect(signers.buyer3)
            .approve(addresses.auction, ethers.constants.MaxUint256);

          tx3 = await instance
            .connect(signers.buyer3)
            .addMarketOrder(epoch, buyer3OrderSize);

          await instance.finalizeAuction(epoch);
          await v.vault.processAuction();

          clearingPrice64x64 = await instance.clearingPrice64x64(epoch);
        });

        it("should send buyer1 fill and refund", async () => {
          const estimatedFill = buyer1OrderSize;
          const estimatedRefund = calculateEstimatedRefund(
            buyer1OrderSize,
            buyer1OrderSize,
            maxPrice,
            fixedToNumber(clearingPrice64x64)
          );

          const auctionERC20BalanceBefore = await asset.balanceOf(
            addresses.auction
          );

          const auctionERC1155BalanceBefore =
            await mockPremiaPool.pool.balanceOf(addresses.auction, longTokenId);

          const buyerERC20BalanceBefore = await asset.balanceOf(
            addresses.buyer1
          );

          const buyerERC1155BalanceBefore = await mockPremiaPool.pool.balanceOf(
            addresses.buyer1,
            longTokenId
          );

          await instance.withdraw(epoch);

          const auctionERC20BalanceAfter = await asset.balanceOf(
            addresses.auction
          );

          const auctionERC1155BalanceAfter =
            await mockPremiaPool.pool.balanceOf(addresses.auction, longTokenId);

          const buyerERC20BalanceAfter = await asset.balanceOf(
            addresses.buyer1
          );

          const buyerERC1155BalanceAfter = await mockPremiaPool.pool.balanceOf(
            addresses.buyer1,
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
        });

        it("should send buyer2 refund, only", async () => {
          const estimatedRefund = math.toUnits(
            minPrice * math.bnToNumber(buyer2OrderSize)
          );

          const auctionERC20BalanceBefore = await asset.balanceOf(
            addresses.auction
          );

          const auctionERC1155BalanceBefore =
            await mockPremiaPool.pool.balanceOf(addresses.auction, longTokenId);

          const buyerERC20BalanceBefore = await asset.balanceOf(
            addresses.buyer2
          );

          const buyerERC1155BalanceBefore = await mockPremiaPool.pool.balanceOf(
            addresses.buyer2,
            longTokenId
          );

          await instance.connect(signers.buyer2).withdraw(epoch);

          const auctionERC20BalanceAfter = await asset.balanceOf(
            addresses.auction
          );

          const auctionERC1155BalanceAfter =
            await mockPremiaPool.pool.balanceOf(addresses.auction, longTokenId);

          const buyerERC20BalanceAfter = await asset.balanceOf(
            addresses.buyer2
          );

          const buyerERC1155BalanceAfter = await mockPremiaPool.pool.balanceOf(
            addresses.buyer2,
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

          assert.bnEqual(
            auctionERC1155BalanceAfter,
            auctionERC1155BalanceBefore
          );

          assert.bnEqual(buyerERC1155BalanceAfter, buyerERC1155BalanceBefore);
        });

        it("should send buyer3 partial fill, and refund", async () => {
          const estimatedFill = buyer3OrderSize.div(2);
          const args = await getEventArgs(tx3, "OrderAdded");

          const estimatedRefund = calculateEstimatedRefund(
            buyer3OrderSize,
            estimatedFill,
            fixedToNumber(args.price64x64),
            fixedToNumber(clearingPrice64x64)
          );

          const auctionERC20BalanceBefore = await asset.balanceOf(
            addresses.auction
          );

          const auctionERC1155BalanceBefore =
            await mockPremiaPool.pool.balanceOf(addresses.auction, longTokenId);

          const buyerERC20BalanceBefore = await asset.balanceOf(
            addresses.buyer3
          );

          const buyerERC1155BalanceBefore = await mockPremiaPool.pool.balanceOf(
            addresses.buyer3,
            longTokenId
          );

          await instance.connect(signers.buyer3).withdraw(epoch);

          const auctionERC20BalanceAfter = await asset.balanceOf(
            addresses.auction
          );

          const auctionERC1155BalanceAfter =
            await mockPremiaPool.pool.balanceOf(addresses.auction, longTokenId);

          const buyerERC20BalanceAfter = await asset.balanceOf(
            addresses.buyer3
          );

          const buyerERC1155BalanceAfter = await mockPremiaPool.pool.balanceOf(
            addresses.buyer3,
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
        });
      });

      describe("else if all orders are filled", () => {
        let buyerOrderSize;
        let txs;
        let totalContractsSold;
        let clearingPrice64x64;
        time.revertToSnapshotAfterEach(async () => {
          [startTime, endTime] = await setupAuction(
            epoch,
            maxPrice64x64,
            minPrice64x64
          );

          [txs, totalContractsSold] = await utilizeAllContracts(epoch);
          buyerOrderSize = totalContractsSold.div(3);

          await time.increaseTo(endTime.add(1));
          await instance.finalizeAuction(epoch);
          await v.vault.processAuction();

          clearingPrice64x64 = await instance.clearingPrice64x64(epoch);
        });

        it("should send buyer1 fill and refund", async () => {
          const args = await getEventArgs(txs[0], "OrderAdded");
          // const paid = math.toUnits(pricePaid * buyerOrderSize);
          // const cost = math.toUnits(
          //   fixedToNumber(clearingPrice64x64) * buyerOrderSize
          // );

          // const amountOverpaid = paid.sub(cost);

          const estimatedRefund = calculateEstimatedRefund(
            buyerOrderSize,
            buyerOrderSize,
            fixedToNumber(args.price64x64),
            fixedToNumber(clearingPrice64x64)
          );

          const auctionERC20BalanceBefore = await asset.balanceOf(
            addresses.auction
          );

          const auctionERC1155BalanceBefore =
            await mockPremiaPool.pool.balanceOf(addresses.auction, longTokenId);

          const buyerERC20BalanceBefore = await asset.balanceOf(
            addresses.buyer1
          );

          const buyerERC1155BalanceBefore = await mockPremiaPool.pool.balanceOf(
            addresses.buyer1,
            longTokenId
          );

          await instance.withdraw(epoch);

          const auctionERC20BalanceAfter = await asset.balanceOf(
            addresses.auction
          );

          const auctionERC1155BalanceAfter =
            await mockPremiaPool.pool.balanceOf(addresses.auction, longTokenId);

          const buyerERC20BalanceAfter = await asset.balanceOf(
            addresses.buyer1
          );

          const buyerERC1155BalanceAfter = await mockPremiaPool.pool.balanceOf(
            addresses.buyer1,
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
            math.bnToNumber(auctionERC1155BalanceBefore.sub(buyerOrderSize)),
            1
          );

          expect(math.bnToNumber(buyerERC1155BalanceAfter)).to.almost(
            math.bnToNumber(buyerERC1155BalanceBefore.add(buyerOrderSize)),
            1
          );
        });

        it("should send buyer2 fill and refund", async () => {
          const args = await getEventArgs(txs[1], "OrderAdded");

          const estimatedRefund = calculateEstimatedRefund(
            buyerOrderSize,
            buyerOrderSize,
            fixedToNumber(args.price64x64),
            fixedToNumber(clearingPrice64x64)
          );

          const auctionERC20BalanceBefore = await asset.balanceOf(
            addresses.auction
          );

          const auctionERC1155BalanceBefore =
            await mockPremiaPool.pool.balanceOf(addresses.auction, longTokenId);

          const buyerERC20BalanceBefore = await asset.balanceOf(
            addresses.buyer2
          );

          const buyerERC1155BalanceBefore = await mockPremiaPool.pool.balanceOf(
            addresses.buyer2,
            longTokenId
          );

          await instance.connect(signers.buyer2).withdraw(epoch);

          const auctionERC20BalanceAfter = await asset.balanceOf(
            addresses.auction
          );

          const auctionERC1155BalanceAfter =
            await mockPremiaPool.pool.balanceOf(addresses.auction, longTokenId);

          const buyerERC20BalanceAfter = await asset.balanceOf(
            addresses.buyer2
          );

          const buyerERC1155BalanceAfter = await mockPremiaPool.pool.balanceOf(
            addresses.buyer2,
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
            math.bnToNumber(auctionERC1155BalanceBefore.sub(buyerOrderSize)),
            1
          );

          expect(math.bnToNumber(buyerERC1155BalanceAfter)).to.almost(
            math.bnToNumber(buyerERC1155BalanceBefore.add(buyerOrderSize)),
            1
          );
        });

        it("should send buyer3 fill and refund", async () => {
          const args = await getEventArgs(txs[2], "OrderAdded");
          const estimatedRefund = calculateEstimatedRefund(
            buyerOrderSize,
            buyerOrderSize,
            fixedToNumber(args.price64x64),
            fixedToNumber(clearingPrice64x64)
          );

          const auctionERC20BalanceBefore = await asset.balanceOf(
            addresses.auction
          );

          const auctionERC1155BalanceBefore =
            await mockPremiaPool.pool.balanceOf(addresses.auction, longTokenId);

          const buyerERC20BalanceBefore = await asset.balanceOf(
            addresses.buyer3
          );

          const buyerERC1155BalanceBefore = await mockPremiaPool.pool.balanceOf(
            addresses.buyer3,
            longTokenId
          );

          await instance.connect(signers.buyer3).withdraw(epoch);

          const auctionERC20BalanceAfter = await asset.balanceOf(
            addresses.auction
          );

          const auctionERC1155BalanceAfter =
            await mockPremiaPool.pool.balanceOf(addresses.auction, longTokenId);

          const buyerERC20BalanceAfter = await asset.balanceOf(
            addresses.buyer3
          );

          const buyerERC1155BalanceAfter = await mockPremiaPool.pool.balanceOf(
            addresses.buyer3,
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
            math.bnToNumber(auctionERC1155BalanceBefore.sub(buyerOrderSize)),
            1
          );

          expect(math.bnToNumber(buyerERC1155BalanceAfter)).to.almost(
            math.bnToNumber(buyerERC1155BalanceBefore.add(buyerOrderSize)),
            1
          );
        });
      });

      describe("else if options have expired ITM", () => {
        let buyer1OrderSize;
        let buyer2OrderSize;
        let buyer3OrderSize;
        let intrinsicValue = 100;
        let exerciseValue;
        let clearingPrice64x64;

        time.revertToSnapshotAfterEach(async () => {
          [startTime, endTime] = await setupAuction(
            epoch,
            maxPrice64x64,
            minPrice64x64
          );

          const totalContracts = await instance.totalContracts(epoch);

          buyer1OrderSize = totalContracts.sub(totalContracts.div(10));
          buyer2OrderSize = totalContracts;
          buyer3OrderSize = totalContracts.div(10).mul(2);

          await asset
            .connect(signers.buyer1)
            .approve(addresses.auction, ethers.constants.MaxUint256);

          await instance.addLimitOrder(epoch, maxPrice64x64, buyer1OrderSize);

          await asset
            .connect(signers.buyer2)
            .approve(addresses.auction, ethers.constants.MaxUint256);

          await instance
            .connect(signers.buyer2)
            .addLimitOrder(epoch, minPrice64x64, buyer2OrderSize);

          await time.increaseTo(startTime);

          await asset
            .connect(signers.buyer3)
            .approve(addresses.auction, ethers.constants.MaxUint256);

          await instance
            .connect(signers.buyer3)
            .addMarketOrder(epoch, buyer3OrderSize);

          await instance.finalizeAuction(epoch);

          // Make sure options expire ITM
          const spot = params.isCall
            ? strike + intrinsicValue
            : strike - intrinsicValue;

          exerciseValue = params.isCall
            ? intrinsicValue / spot
            : intrinsicValue;

          await mockPremiaPool.pool.setSpot64x64(fixedFromFloat(spot));
          await v.vault.processAuction();

          await time.increaseTo(expiry.add(1));
          await mockPremiaPool.pool.processExpired(longTokenId, 0);

          clearingPrice64x64 = await instance.clearingPrice64x64(epoch);
        });

        it("should send buyer1 exercised amount for fill and refund", async () => {
          const exercisedAmount = math.toUnits(
            exerciseValue * math.bnToNumber(buyer1OrderSize)
          );

          let estimatedRefund = calculateEstimatedRefund(
            buyer1OrderSize,
            buyer1OrderSize,
            maxPrice,
            fixedToNumber(clearingPrice64x64)
          );

          estimatedRefund = estimatedRefund.add(exercisedAmount);

          const auctionERC20BalanceBefore = await asset.balanceOf(
            addresses.auction
          );

          const auctionERC1155BalanceBefore =
            await mockPremiaPool.pool.balanceOf(addresses.auction, longTokenId);

          const buyerERC20BalanceBefore = await asset.balanceOf(
            addresses.buyer1
          );

          const buyerERC1155BalanceBefore = await mockPremiaPool.pool.balanceOf(
            addresses.buyer1,
            longTokenId
          );

          await instance.withdraw(epoch);

          const auctionERC20BalanceAfter = await asset.balanceOf(
            addresses.auction
          );

          const auctionERC1155BalanceAfter =
            await mockPremiaPool.pool.balanceOf(addresses.auction, longTokenId);

          const buyerERC20BalanceAfter = await asset.balanceOf(
            addresses.buyer1
          );

          const buyerERC1155BalanceAfter = await mockPremiaPool.pool.balanceOf(
            addresses.buyer1,
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

          assert.bnEqual(
            auctionERC1155BalanceAfter,
            auctionERC1155BalanceBefore
          );

          assert.bnEqual(buyerERC1155BalanceAfter, buyerERC1155BalanceBefore);
        });

        it("should send buyer2 refund, only", async () => {
          const estimatedRefund = math.toUnits(
            minPrice * math.bnToNumber(buyer2OrderSize)
          );

          const auctionERC20BalanceBefore = await asset.balanceOf(
            addresses.auction
          );

          const auctionERC1155BalanceBefore =
            await mockPremiaPool.pool.balanceOf(addresses.auction, longTokenId);

          const buyerERC20BalanceBefore = await asset.balanceOf(
            addresses.buyer2
          );

          const buyerERC1155BalanceBefore = await mockPremiaPool.pool.balanceOf(
            addresses.buyer2,
            longTokenId
          );

          await instance.connect(signers.buyer2).withdraw(epoch);

          const auctionERC20BalanceAfter = await asset.balanceOf(
            addresses.auction
          );

          const auctionERC1155BalanceAfter =
            await mockPremiaPool.pool.balanceOf(addresses.auction, longTokenId);

          const buyerERC20BalanceAfter = await asset.balanceOf(
            addresses.buyer2
          );

          const buyerERC1155BalanceAfter = await mockPremiaPool.pool.balanceOf(
            addresses.buyer2,
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

          assert.bnEqual(
            auctionERC1155BalanceAfter,
            auctionERC1155BalanceBefore
          );

          assert.bnEqual(buyerERC1155BalanceAfter, buyerERC1155BalanceBefore);
        });

        it("should send buyer3 exercised amount for partial fill and refund", async () => {
          const estimatedFill = buyer3OrderSize.div(2);

          const exercisedAmount = math.toUnits(
            exerciseValue * math.bnToNumber(estimatedFill)
          );

          let estimatedRefund = calculateEstimatedRefund(
            buyer3OrderSize,
            estimatedFill,
            maxPrice,
            fixedToNumber(clearingPrice64x64)
          );

          estimatedRefund = estimatedRefund.add(exercisedAmount);

          const auctionERC20BalanceBefore = await asset.balanceOf(
            addresses.auction
          );

          const auctionERC1155BalanceBefore =
            await mockPremiaPool.pool.balanceOf(addresses.auction, longTokenId);

          const buyerERC20BalanceBefore = await asset.balanceOf(
            addresses.buyer3
          );

          const buyerERC1155BalanceBefore = await mockPremiaPool.pool.balanceOf(
            addresses.buyer3,
            longTokenId
          );

          await instance.connect(signers.buyer3).withdraw(epoch);

          const auctionERC20BalanceAfter = await asset.balanceOf(
            addresses.auction
          );

          const auctionERC1155BalanceAfter =
            await mockPremiaPool.pool.balanceOf(addresses.auction, longTokenId);

          const buyerERC20BalanceAfter = await asset.balanceOf(
            addresses.buyer3
          );

          const buyerERC1155BalanceAfter = await mockPremiaPool.pool.balanceOf(
            addresses.buyer3,
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

          assert.bnEqual(
            auctionERC1155BalanceAfter,
            auctionERC1155BalanceBefore
          );

          assert.bnEqual(buyerERC1155BalanceAfter, buyerERC1155BalanceBefore);
        });
      });

      describe("else if options have expired ATM", () => {
        let buyer1OrderSize;
        let buyer2OrderSize;
        let buyer3OrderSize;
        let clearingPrice64x64;
        let tx3;

        time.revertToSnapshotAfterEach(async () => {
          [startTime, endTime] = await setupAuction(
            epoch,
            maxPrice64x64,
            minPrice64x64
          );

          const totalContracts = await instance.totalContracts(epoch);

          buyer1OrderSize = totalContracts.sub(totalContracts.div(10));
          buyer2OrderSize = totalContracts;
          buyer3OrderSize = totalContracts.div(10).mul(2);

          await asset
            .connect(signers.buyer1)
            .approve(addresses.auction, ethers.constants.MaxUint256);

          await instance.addLimitOrder(epoch, maxPrice64x64, buyer1OrderSize);

          await asset
            .connect(signers.buyer2)
            .approve(addresses.auction, ethers.constants.MaxUint256);

          await instance
            .connect(signers.buyer2)
            .addLimitOrder(epoch, minPrice64x64, buyer2OrderSize);

          await time.increaseTo(startTime);

          await asset
            .connect(signers.buyer3)
            .approve(addresses.auction, ethers.constants.MaxUint256);

          tx3 = await instance
            .connect(signers.buyer3)
            .addMarketOrder(epoch, buyer3OrderSize);

          await instance.finalizeAuction(epoch);

          await mockPremiaPool.pool.setSpot64x64(fixedFromFloat(strike));
          await v.vault.processAuction();

          await time.increaseTo(expiry.add(1));
          await mockPremiaPool.pool.processExpired(longTokenId, 0);

          clearingPrice64x64 = await instance.clearingPrice64x64(epoch);
        });

        it("should send buyer1 refund for fill", async () => {
          const estimatedRefund = calculateEstimatedRefund(
            buyer1OrderSize,
            buyer1OrderSize,
            maxPrice,
            fixedToNumber(clearingPrice64x64)
          );

          const auctionERC20BalanceBefore = await asset.balanceOf(
            addresses.auction
          );

          const auctionERC1155BalanceBefore =
            await mockPremiaPool.pool.balanceOf(addresses.auction, longTokenId);

          const buyerERC20BalanceBefore = await asset.balanceOf(
            addresses.buyer1
          );

          const buyerERC1155BalanceBefore = await mockPremiaPool.pool.balanceOf(
            addresses.buyer1,
            longTokenId
          );

          await instance.withdraw(epoch);

          const auctionERC20BalanceAfter = await asset.balanceOf(
            addresses.auction
          );

          const auctionERC1155BalanceAfter =
            await mockPremiaPool.pool.balanceOf(addresses.auction, longTokenId);

          const buyerERC20BalanceAfter = await asset.balanceOf(
            addresses.buyer1
          );

          const buyerERC1155BalanceAfter = await mockPremiaPool.pool.balanceOf(
            addresses.buyer1,
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

          assert.bnEqual(
            auctionERC1155BalanceAfter,
            auctionERC1155BalanceBefore
          );

          assert.bnEqual(buyerERC1155BalanceAfter, buyerERC1155BalanceBefore);
        });

        it("should send buyer2 refund, only", async () => {
          const estimatedRefund = math.toUnits(
            minPrice * math.bnToNumber(buyer2OrderSize)
          );

          const auctionERC20BalanceBefore = await asset.balanceOf(
            addresses.auction
          );

          const auctionERC1155BalanceBefore =
            await mockPremiaPool.pool.balanceOf(addresses.auction, longTokenId);

          const buyerERC20BalanceBefore = await asset.balanceOf(
            addresses.buyer2
          );

          const buyerERC1155BalanceBefore = await mockPremiaPool.pool.balanceOf(
            addresses.buyer2,
            longTokenId
          );

          await instance.connect(signers.buyer2).withdraw(epoch);

          const auctionERC20BalanceAfter = await asset.balanceOf(
            addresses.auction
          );

          const auctionERC1155BalanceAfter =
            await mockPremiaPool.pool.balanceOf(addresses.auction, longTokenId);

          const buyerERC20BalanceAfter = await asset.balanceOf(
            addresses.buyer2
          );

          const buyerERC1155BalanceAfter = await mockPremiaPool.pool.balanceOf(
            addresses.buyer2,
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

          assert.bnEqual(
            auctionERC1155BalanceAfter,
            auctionERC1155BalanceBefore
          );

          assert.bnEqual(buyerERC1155BalanceAfter, buyerERC1155BalanceBefore);
        });

        it("should send buyer3 overpaid amount for partial fill and refund", async () => {
          const estimatedFill = buyer3OrderSize.div(2);
          const args = await getEventArgs(tx3, "OrderAdded");

          const estimatedRefund = calculateEstimatedRefund(
            buyer3OrderSize,
            estimatedFill,
            fixedToNumber(args.price64x64),
            fixedToNumber(clearingPrice64x64)
          );

          const auctionERC20BalanceBefore = await asset.balanceOf(
            addresses.auction
          );

          const auctionERC1155BalanceBefore =
            await mockPremiaPool.pool.balanceOf(addresses.auction, longTokenId);

          const buyerERC20BalanceBefore = await asset.balanceOf(
            addresses.buyer3
          );

          const buyerERC1155BalanceBefore = await mockPremiaPool.pool.balanceOf(
            addresses.buyer3,
            longTokenId
          );

          await instance.connect(signers.buyer3).withdraw(epoch);

          const auctionERC20BalanceAfter = await asset.balanceOf(
            addresses.auction
          );

          const auctionERC1155BalanceAfter =
            await mockPremiaPool.pool.balanceOf(addresses.auction, longTokenId);

          const buyerERC20BalanceAfter = await asset.balanceOf(
            addresses.buyer3
          );

          const buyerERC1155BalanceAfter = await mockPremiaPool.pool.balanceOf(
            addresses.buyer3,
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

          assert.bnEqual(
            auctionERC1155BalanceAfter,
            auctionERC1155BalanceBefore
          );

          assert.bnEqual(buyerERC1155BalanceAfter, buyerERC1155BalanceBefore);
        });
      });

      describe("else", () => {
        let txs;

        time.revertToSnapshotAfterEach(async () => {
          [startTime, endTime] = await setupAuction(
            epoch,
            maxPrice64x64,
            minPrice64x64
          );

          [txs] = await utilizeAllContracts(epoch);

          await time.increaseTo(endTime.add(1));
          await instance.finalizeAuction(epoch);
          await v.vault.processAuction();
        });

        it("should remove tx1 from order book", async () => {
          await instance.withdraw(epoch);

          const args = await getEventArgs(txs[0], "OrderAdded");
          const order = await instance.getOrderById(epoch, args.id);

          await assert.bnEqual(order[0], ethers.constants.Zero);
          await assert.bnEqual(order[1], ethers.constants.Zero);
          await assert.bnEqual(order[2], ethers.constants.Zero);
          await assert.equal(order[3], ethers.constants.AddressZero);
        });

        it("should remove tx2 from order book", async () => {
          await instance.connect(signers.buyer2).withdraw(epoch);

          const args = await getEventArgs(txs[1], "OrderAdded");
          const order = await instance.getOrderById(epoch, args.id);

          await assert.bnEqual(order[0], ethers.constants.Zero);
          await assert.bnEqual(order[1], ethers.constants.Zero);
          await assert.bnEqual(order[2], ethers.constants.Zero);
          await assert.equal(order[3], ethers.constants.AddressZero);
        });

        it("should remove tx3 from order book", async () => {
          await instance.connect(signers.buyer3).withdraw(epoch);

          const args = await getEventArgs(txs[2], "OrderAdded");
          const order = await instance.getOrderById(epoch, args.id);

          await assert.bnEqual(order[0], ethers.constants.Zero);
          await assert.bnEqual(order[1], ethers.constants.Zero);
          await assert.bnEqual(order[2], ethers.constants.Zero);
          await assert.equal(order[3], ethers.constants.AddressZero);
        });
      });
    });

    describe("#previewWithdraw(uin64)", () => {
      describe("if cancelled", () => {
        let buyer1OrderSize1 = math.toUnits(40);
        let buyer1OrderSize2 = math.toUnits(1);
        let buyer2OrderSize = math.toUnits(20);
        let buyer3OrderSize = math.toUnits(10);

        time.revertToSnapshotAfterEach(async () => {
          const startTime = BigNumber.from(block.timestamp + 60);
          const endTime = BigNumber.from(block.timestamp + 86400);

          await instance.connect(signers.deployer).initialize({
            epoch: epoch,
            strike64x64: strike64x64,
            longTokenId: BigNumber.from("1"),
            startTime: startTime,
            endTime: endTime,
          });

          await asset
            .connect(signers.buyer1)
            .approve(addresses.auction, ethers.constants.MaxUint256);

          await instance.addLimitOrder(epoch, maxPrice64x64, buyer1OrderSize1);
          await instance.addLimitOrder(epoch, minPrice64x64, buyer1OrderSize2);

          await asset
            .connect(signers.buyer2)
            .approve(addresses.auction, ethers.constants.MaxUint256);

          await instance
            .connect(signers.buyer2)
            .addLimitOrder(epoch, minPrice64x64, buyer2OrderSize);

          await asset
            .connect(signers.buyer3)
            .approve(addresses.auction, ethers.constants.MaxUint256);

          await instance
            .connect(signers.buyer3)
            .addLimitOrder(epoch, maxPrice64x64, buyer3OrderSize);

          await instance
            .connect(signers.deployer)
            .setAuctionPrices(epoch, 0, 0);

          await instance.finalizeAuction(epoch);
        });

        it("should preview buyer1 refund, only", async () => {
          const estimatedRefund =
            maxPrice * math.bnToNumber(buyer1OrderSize1) +
            minPrice * math.bnToNumber(buyer1OrderSize2);

          const [refund, fill] = await instance.callStatic.previewWithdraw(
            epoch
          );

          assert.isTrue(fill.isZero());
          expect(math.bnToNumber(refund)).to.almost(estimatedRefund, 1);
        });

        it("should preview buyer2 refund, only", async () => {
          const estimatedRefund = minPrice * math.bnToNumber(buyer2OrderSize);

          const [refund, fill] = await instance
            .connect(signers.buyer2)
            .callStatic.previewWithdraw(epoch);

          assert.isTrue(fill.isZero());
          expect(math.bnToNumber(refund)).to.almost(estimatedRefund, 1);
        });

        it("should preview buyer3 refund, only", async () => {
          const estimatedRefund = maxPrice * math.bnToNumber(buyer3OrderSize);

          const [refund, fill] = await instance
            .connect(signers.buyer3)
            .callStatic.previewWithdraw(epoch);

          assert.isTrue(fill.isZero());
          expect(math.bnToNumber(refund)).to.almost(estimatedRefund, 1);
        });
      });

      describe("else if some orders are filled", () => {
        let buyer1OrderSize;
        let buyer2OrderSize;
        let buyer3OrderSize;
        let clearingPrice64x64;

        time.revertToSnapshotAfterEach(async () => {
          [startTime, endTime] = await setupAuction(
            epoch,
            maxPrice64x64,
            minPrice64x64
          );

          const totalContracts = await instance.totalContracts(epoch);

          buyer1OrderSize = totalContracts.sub(totalContracts.div(10));
          buyer2OrderSize = totalContracts;
          buyer3OrderSize = totalContracts.div(10).mul(2);

          await asset
            .connect(signers.buyer1)
            .approve(addresses.auction, ethers.constants.MaxUint256);

          await instance.addLimitOrder(epoch, maxPrice64x64, buyer1OrderSize);

          await asset
            .connect(signers.buyer2)
            .approve(addresses.auction, ethers.constants.MaxUint256);

          await instance
            .connect(signers.buyer2)
            .addLimitOrder(epoch, minPrice64x64, buyer2OrderSize);

          await time.increaseTo(startTime);

          await asset
            .connect(signers.buyer3)
            .approve(addresses.auction, ethers.constants.MaxUint256);

          await instance
            .connect(signers.buyer3)
            .addMarketOrder(epoch, buyer3OrderSize);

          await instance.finalizeAuction(epoch);

          clearingPrice64x64 = await instance.clearingPrice64x64(epoch);
        });

        it("should preview buyer1 with fill and refund", async () => {
          const paid = math.toUnits(
            maxPrice * math.bnToNumber(buyer1OrderSize)
          );

          const cost = math.toUnits(
            fixedToNumber(clearingPrice64x64) * math.bnToNumber(buyer1OrderSize)
          );

          const estimatedRefund = paid.sub(cost);

          const [refund, fill] = await instance
            .connect(signers.buyer1)
            .callStatic.previewWithdraw(epoch);

          expect(math.bnToNumber(refund)).to.almost(
            math.bnToNumber(estimatedRefund),
            1
          );

          expect(math.bnToNumber(fill)).to.almost(
            math.bnToNumber(buyer1OrderSize),
            1
          );
        });

        it("should preview buyer2 with refund only", async () => {
          const estimatedRefund = minPrice * math.bnToNumber(buyer2OrderSize);

          const [refund, fill] = await instance
            .connect(signers.buyer2)
            .callStatic.previewWithdraw(epoch);

          assert.isTrue(fill.isZero());
          expect(math.bnToNumber(refund)).to.almost(estimatedRefund, 1);
        });

        it("should preview buyer3 with partial fill and refund", async () => {
          const estimatedFill = buyer3OrderSize.div(2);
          const remainder = math.bnToNumber(buyer3OrderSize.sub(estimatedFill));
          const estimatedRefund = maxPrice * remainder;

          const [refund, fill] = await instance
            .connect(signers.buyer3)
            .callStatic.previewWithdraw(epoch);

          expect(math.bnToNumber(fill)).to.almost(
            math.bnToNumber(estimatedFill),
            1
          );
          expect(math.bnToNumber(refund)).to.almost(estimatedRefund, 1);
        });
      });

      describe("else if all orders are filled", () => {
        let buyerOrderSize;
        let txs;
        let totalContractsSold;
        let clearingPrice64x64;

        time.revertToSnapshotAfterEach(async () => {
          [startTime, endTime] = await setupAuction(
            epoch,
            maxPrice64x64,
            minPrice64x64
          );

          [txs, totalContractsSold] = await utilizeAllContracts(epoch);
          buyerOrderSize = math.bnToNumber(totalContractsSold.div(3));

          await time.increaseTo(endTime.add(1));
          await instance.finalizeAuction(epoch);
          await v.vault.processAuction();

          clearingPrice64x64 = await instance.clearingPrice64x64(epoch);
        });

        it("should preview buyer1 with fill and refund", async () => {
          const args = await getEventArgs(txs[0], "OrderAdded");
          const pricePaid = fixedToNumber(args.price64x64);
          const paid = math.toUnits(pricePaid * buyerOrderSize);
          const cost = math.toUnits(
            fixedToNumber(clearingPrice64x64) * buyerOrderSize
          );

          const estimatedRefund = math.bnToNumber(paid.sub(cost));

          const [refund, fill] = await instance.callStatic.previewWithdraw(
            epoch
          );

          expect(math.bnToNumber(refund)).to.almost(estimatedRefund, 1);
          expect(math.bnToNumber(fill)).to.almost(buyerOrderSize, 1);
        });

        it("should preview buyer2 with fill and refund", async () => {
          const args = await getEventArgs(txs[1], "OrderAdded");
          const pricePaid = fixedToNumber(args.price64x64);
          const paid = math.toUnits(pricePaid * buyerOrderSize);
          const cost = math.toUnits(
            fixedToNumber(clearingPrice64x64) * buyerOrderSize
          );

          const estimatedRefund = math.bnToNumber(paid.sub(cost));

          const [refund, fill] = await instance
            .connect(signers.buyer2)
            .callStatic.previewWithdraw(epoch);

          expect(math.bnToNumber(refund)).to.almost(estimatedRefund, 1);
          expect(math.bnToNumber(fill)).to.almost(buyerOrderSize, 1);
        });

        it("should preview buyer3 with fill and refund", async () => {
          const args = await getEventArgs(txs[2], "OrderAdded");
          const pricePaid = fixedToNumber(args.price64x64);
          const paid = math.toUnits(pricePaid * buyerOrderSize);
          const cost = math.toUnits(
            fixedToNumber(clearingPrice64x64) * buyerOrderSize
          );

          const estimatedRefund = math.bnToNumber(paid.sub(cost));

          const [refund, fill] = await instance
            .connect(signers.buyer3)
            .callStatic.previewWithdraw(epoch);

          expect(math.bnToNumber(refund)).to.almost(estimatedRefund, 1);
          expect(math.bnToNumber(fill)).to.almost(buyerOrderSize, 1);
        });
      });

      describe("else", () => {
        let txs;

        time.revertToSnapshotAfterEach(async () => {
          [startTime, endTime] = await setupAuction(
            epoch,
            maxPrice64x64,
            minPrice64x64
          );

          [txs] = await utilizeAllContracts(epoch);

          await time.increaseTo(endTime.add(1));
          await instance.finalizeAuction(epoch);
          await v.vault.processAuction();
        });

        it("should not remove tx1 from order book", async () => {
          await instance.previewWithdraw(epoch);

          const args = await getEventArgs(txs[0], "OrderAdded");
          const order = await instance.getOrderById(epoch, args.id);

          await assert.bnEqual(order[0], args.id);
          await assert.bnEqual(order[1], args.price64x64);
          await assert.bnEqual(order[2], args.size);
          await assert.equal(order[3], args.buyer);
        });

        it("should not remove tx2 from order book", async () => {
          await instance.connect(signers.buyer2).previewWithdraw(epoch);

          const args = await getEventArgs(txs[1], "OrderAdded");
          const order = await instance.getOrderById(epoch, args.id);

          await assert.bnEqual(order[0], args.id);
          await assert.bnEqual(order[1], args.price64x64);
          await assert.bnEqual(order[2], args.size);
          await assert.equal(order[3], args.buyer);
        });

        it("should not remove tx3 from order book", async () => {
          await instance.connect(signers.buyer3).previewWithdraw(epoch);

          const args = await getEventArgs(txs[2], "OrderAdded");
          const order = await instance.getOrderById(epoch, args.id);

          await assert.bnEqual(order[0], args.id);
          await assert.bnEqual(order[1], args.price64x64);
          await assert.bnEqual(order[2], args.size);
          await assert.equal(order[3], args.buyer);
        });
      });
    });

    describe.skip("#totalContracts(uint64)", () => {
      time.revertToSnapshotAfterEach(async () => {});

      it("", async () => {});
    });
  });
}

async function getEvent(tx: any, event: string) {
  let receipt = await tx.wait();
  return receipt.events?.filter((x) => {
    return x.event == event;
  });
}

async function getEventArgs(tx: any, event: string) {
  return (await getEvent(tx, event))[0].args;
}
