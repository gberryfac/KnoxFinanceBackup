import { ethers } from "hardhat";
import { BigNumber, ContractTransaction } from "ethers";
const { provider } = ethers;
const { parseUnits } = ethers.utils;

import { fixedFromFloat, fixedToNumber } from "@premia/utils";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Block } from "@ethersproject/abstract-provider";

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

    // Test Suite Globals
    let block: Block;

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

      asset.connect(signers.deployer).mint(addresses.buyer1, params.mint);
      asset.connect(signers.deployer).mint(addresses.buyer2, params.mint);
      asset.connect(signers.deployer).mint(addresses.buyer3, params.mint);
      asset.connect(signers.deployer).mint(addresses.vault, params.mint);

      block = await provider.getBlock(await provider.getBlockNumber());
      signers.vault = await accounts.impersonateVault(signers, addresses);
    });

    const setupSimpleAuction = async (processAuction: boolean) => {
      const [startTime, endTime, epoch] = await knoxUtil.initializeAuction();

      await knoxUtil.fastForwardToFriday8AM();
      await knoxUtil.initializeNextEpoch();
      await time.increaseTo(startTime.add(1));

      const [txs, totalContractsSold] =
        await utilizeAllContractsMarketOrdersOnly(epoch);

      const buyerOrderSize = totalContractsSold.div(3);

      await time.increaseTo(endTime.add(1));
      await auction.finalizeAuction(epoch);

      if (processAuction) {
        await vault.connect(signers.keeper).processAuction();
      }

      const clearingPrice64x64 = await auction.clearingPrice64x64(epoch);

      return { txs, totalContractsSold, buyerOrderSize, clearingPrice64x64 };
    };

    const setupAdvancedAuction = async (processAuction: boolean) => {
      const [startTime, endTime] = await knoxUtil.initializeAuction();

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

      await knoxUtil.fastForwardToFriday8AM();
      await knoxUtil.initializeNextEpoch();

      await time.increaseTo(startTime.add(1));

      await asset
        .connect(signers.buyer3)
        .approve(addresses.auction, ethers.constants.MaxUint256);

      const marketOrder = await auction
        .connect(signers.buyer3)
        .addMarketOrder(epoch, buyer3OrderSize);

      await time.increaseTo(endTime.add(1));
      await auction.finalizeAuction(epoch);

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

      time.revertToSnapshotAfterEach(async () => {});

      it("should revert if caller is !vault", async () => {
        await expect(
          auction.initialize({
            epoch: 0,
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
          epoch: 0,
          strike64x64: strike64x64,
          longTokenId: BigNumber.from("1"),
          startTime: BigNumber.from(block.timestamp + 60),
          endTime: BigNumber.from(block.timestamp + 86400),
        };

        await auction.connect(signers.vault).initialize(initAuction);

        const data = await auction.getAuction(0);

        assert.equal(await auction.getStatus(0), 0);

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
        it.skip("should revert", async () => {});
      });

      describe("else", () => {
        let epoch: BigNumber;
        time.revertToSnapshotAfterEach(async () => {
          [, , epoch] = await knoxUtil.initializeAuction();
        });

        it("should revert if caller is !vault", async () => {
          await expect(
            auction.setAuctionPrices(epoch, maxPrice64x64, minPrice64x64)
          ).to.be.revertedWith("!vault");
        });

        it.skip("should revert if auction initialized", async () => {});

        it("should cancel auction if maxPrice64x64 >= minPrice64x64", async () => {
          await auction
            .connect(signers.vault)
            .setAuctionPrices(epoch, minPrice64x64, maxPrice64x64);

          assert.equal(await auction.getStatus(epoch), 1);
        });

        it("should cancel auction if maxPrice64x64 <= 0", async () => {
          await auction
            .connect(signers.vault)
            .setAuctionPrices(epoch, 0, minPrice64x64);

          assert.equal(await auction.getStatus(epoch), 1);
        });

        it("should cancel auction if minPrice64x64 <= 0", async () => {
          await auction
            .connect(signers.vault)
            .setAuctionPrices(epoch, maxPrice64x64, 0);

          assert.equal(await auction.getStatus(epoch), 1);
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
        it.skip("should revert", async () => {});
      });

      describe("else", () => {
        let startTime: BigNumber;
        let endTime: BigNumber;
        let epoch: BigNumber;

        time.revertToSnapshotAfterEach(async () => {
          [startTime, endTime, epoch] = await knoxUtil.initializeAuction();

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
        it.skip("should revert", async () => {});
      });

      describe("else", () => {
        let epoch: BigNumber;
        const cost = params.size.div(10);

        time.revertToSnapshotAfterEach(async () => {
          [, , epoch] = await knoxUtil.initializeAuction();
        });

        it.skip("should revert if auction is finalized", async () => {});

        it.skip("should revert if price <= 0", async () => {});

        it("should revert if order size is below min size", async () => {
          await expect(
            auction.addLimitOrder(
              epoch,
              fixedFromFloat("0.1"),
              parseUnits("1", params.collateral.decimals - 2)
            )
          ).to.be.revertedWith("size < minimum");
        });

        it.skip("should revert auction finalizes", async () => {});

        it("should emit OrderAdded event if successful", async () => {
          await asset.connect(signers.buyer1).approve(addresses.auction, cost);

          const price = fixedFromFloat("0.1");

          await expect(auction.addLimitOrder(epoch, price, params.size))
            .to.emit(auction, "OrderAdded")
            .withArgs(1, addresses.buyer1, price, params.size, true);
        });

        it("should send funds to Auction if successful", async () => {
          const auctionBalanceBefore = await asset.balanceOf(addresses.auction);
          const buyerBalanceBefore = await asset.balanceOf(addresses.buyer1);

          await asset.connect(signers.buyer1).approve(addresses.auction, cost);

          await auction.addLimitOrder(
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

          const tx = await auction.addLimitOrder(
            epoch,
            fixedFromFloat("0.1"),
            params.size
          );

          const args = await getEventArgs(tx, "OrderAdded");
          const order = await auction.getOrderById(epoch, args.id);

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
        let epoch: BigNumber;
        const cost = params.size.div(10);

        time.revertToSnapshotAfterEach(async () => {
          [, , epoch] = await knoxUtil.initializeAuction();
          await asset.connect(signers.buyer1).approve(addresses.auction, cost);

          await auction.addLimitOrder(
            epoch,
            fixedFromFloat("0.1"),
            params.size
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

        it.skip("should revert if auction is finalized", async () => {});

        it.skip("should revert auction finalizes", async () => {});

        it("should issue refund if successful", async () => {
          const auctionBalanceBefore = await asset.balanceOf(addresses.auction);
          const buyerBalanceBefore = await asset.balanceOf(addresses.buyer1);

          await auction.cancelLimitOrder(epoch, 1);

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
          await auction.cancelLimitOrder(epoch, 1);

          const order = await auction.getOrderById(epoch, 1);

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
        let startTime: BigNumber;
        let epoch: BigNumber;

        time.revertToSnapshotAfterEach(async () => {
          [startTime, , epoch] = await knoxUtil.initializeAuction();

          await knoxUtil.fastForwardToFriday8AM();
          await knoxUtil.initializeNextEpoch();
          await time.increaseTo(startTime.add(1));
        });

        it.skip("should revert if auction has not started", async () => {});

        it.skip("should revert if auction is finalized", async () => {});

        it.skip("should revert if auction is cancelled", async () => {});

        it("should revert if order size is below min size", async () => {
          await expect(
            auction.addMarketOrder(
              epoch,
              parseUnits("1", params.collateral.decimals - 2)
            )
          ).to.be.revertedWith("size < minimum");
        });

        it.skip("should revert auction finalizes", async () => {});

        it("should set the totalContracts equal to Vault ERC20 balance if totalContracts is unset", async () => {
          let totalContracts = await auction.getTotalContracts(epoch);

          const price64x64 = await auction.priceCurve64x64(epoch);
          const price = fixedToNumber(price64x64);
          const cost = price * math.bnToNumber(params.size);
          const bnCost = math.toUnits(cost);

          await asset
            .connect(signers.buyer1)
            .approve(addresses.auction, bnCost);

          await auction.addMarketOrder(epoch, params.size);
          const data = await auction.getAuction(epoch);
          await assert.bnEqual(data.totalContracts, totalContracts);
        });

        it("should emit OrderAdded event if successful", async () => {
          const price64x64 = await auction.priceCurve64x64(epoch);
          const price = fixedToNumber(price64x64);
          const cost = price * math.bnToNumber(params.size);
          const bnCost = math.toUnits(cost);

          await asset
            .connect(signers.buyer1)
            .approve(addresses.auction, bnCost);

          const tx = await auction.addMarketOrder(epoch, params.size);
          const args = await getEventArgs(tx, "OrderAdded");

          await expect(tx).to.emit(auction, "OrderAdded").withArgs(
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

          const price = fixedToNumber(await auction.priceCurve64x64(epoch));
          const cost = price * math.bnToNumber(params.size);
          const bnCost = math.toUnits(cost);

          await asset
            .connect(signers.buyer1)
            .approve(addresses.auction, bnCost);

          await auction.addMarketOrder(epoch, params.size);

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
          const price64x64 = await auction.priceCurve64x64(epoch);
          const price = fixedToNumber(price64x64);
          const cost = price * math.bnToNumber(params.size);
          const bnCost = math.toUnits(cost);

          await asset
            .connect(signers.buyer1)
            .approve(addresses.auction, bnCost);

          const tx = await auction.addMarketOrder(epoch, params.size);
          const args = await getEventArgs(tx, "OrderAdded");

          const order = await auction.getOrderById(epoch, args.id);

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
        let startTime: BigNumber;
        let epoch: BigNumber;

        time.revertToSnapshotAfterEach(async () => {
          [startTime, , epoch] = await knoxUtil.initializeAuction();

          await knoxUtil.fastForwardToFriday8AM();
          await knoxUtil.initializeNextEpoch();
        });

        it.skip("should revert if auction has not started", async () => {});

        it.skip("should revert if auction is finalized", async () => {});

        it.skip("should revert if auction is cancelled", async () => {});

        it("should return true if vault utilization == 100%", async () => {
          await time.increaseTo(startTime.add(1));

          const [txs, totalContractsSold] =
            await utilizeAllContractsMarketOrdersOnly(epoch);

          // Gets args of last tx
          const args = await getEventArgs(txs[2], "OrderAdded");

          await auction.processOrders(epoch);

          assert.isTrue(await auction.callStatic.processOrders(epoch));

          assert.bnEqual(
            await auction.getTotalContractsSold(epoch),
            totalContractsSold
          );

          assert.bnEqual(await auction.lastPrice64x64(epoch), args.price64x64);
        });

        it("should return false if vault utilization < 100%", async () => {
          await time.increaseTo(startTime.add(1));

          await asset
            .connect(signers.buyer1)
            .approve(addresses.auction, ethers.constants.MaxUint256);

          const tx = await auction
            .connect(signers.buyer1)
            .addMarketOrder(epoch, params.size);

          const args = await getEventArgs(tx, "OrderAdded");

          await auction.processOrders(epoch);
          assert.isFalse(await auction.callStatic.processOrders(epoch));

          assert.bnEqual(
            await auction.getTotalContractsSold(epoch),
            params.size
          );
          assert.bnEqual(await auction.lastPrice64x64(epoch), args.price64x64);
        });

        it("should only process orders where price > clearing price", async () => {
          await asset
            .connect(signers.buyer1)
            .approve(addresses.auction, ethers.constants.MaxUint256);

          await auction.addLimitOrder(
            epoch,
            fixedFromFloat("0.05"),
            params.size
          );

          await asset
            .connect(signers.buyer1)
            .approve(addresses.auction, ethers.constants.MaxUint256);

          await auction.addLimitOrder(
            epoch,
            fixedFromFloat("0.03"),
            params.size
          );

          await asset
            .connect(signers.buyer1)
            .approve(addresses.auction, ethers.constants.MaxUint256);

          await auction.addLimitOrder(
            epoch,
            fixedFromFloat("0.01"),
            params.size
          );

          await time.increaseTo(startTime.add(1));

          await asset
            .connect(signers.buyer1)
            .approve(addresses.auction, ethers.constants.MaxUint256);

          // All limit orders fail to fill
          const tx = await auction.addMarketOrder(epoch, params.size);
          const args = await getEventArgs(tx, "OrderAdded");

          await auction.processOrders(epoch);

          assert.isFalse(await auction.callStatic.processOrders(epoch));
          assert.bnEqual(
            await auction.getTotalContractsSold(epoch),
            params.size
          );
          assert.bnEqual(await auction.lastPrice64x64(epoch), args.price64x64);
        });
      });
    });

    describe("#finalizeAuction(uint64)", () => {
      describe("if not initialized", () => {
        it.skip("should revert", async () => {});
      });

      describe("else if auction price is not set", () => {
        let epoch: BigNumber;

        time.revertToSnapshotAfterEach(async () => {
          [, , epoch] = await knoxUtil.initializeAuction();
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

        it("should return emit AuctionStatus if max price == 0", async () => {
          await auction
            .connect(signers.vault)
            .setAuctionPrices(epoch, 0, fixedFromFloat(params.price.min));

          const tx = await auction.finalizeAuction(epoch);
          await expect(tx).to.emit(auction, "AuctionStatus").withArgs(1);
        });

        it("should return emit AuctionStatus if min price == 0", async () => {
          await auction
            .connect(signers.vault)
            .setAuctionPrices(epoch, fixedFromFloat(params.price.max), 0);

          const tx = await auction.finalizeAuction(epoch);
          await expect(tx).to.emit(auction, "AuctionStatus").withArgs(1);
        });
      });

      describe("else", () => {
        let startTime: BigNumber;
        let endTime: BigNumber;
        let epoch: BigNumber;

        time.revertToSnapshotAfterEach(async () => {
          [startTime, endTime, epoch] = await knoxUtil.initializeAuction();
        });

        it.skip("should revert if auction has not started", async () => {});

        it.skip("should revert if auction is finalized", async () => {});

        it("should emit AuctionStatus event if utilization == %100", async () => {
          await knoxUtil.fastForwardToFriday8AM();
          await knoxUtil.initializeNextEpoch();
          await time.increaseTo(startTime.add(1));

          await utilizeAllContractsMarketOrdersOnly(epoch);

          const tx = await auction.finalizeAuction(epoch);
          await expect(tx).to.emit(auction, "AuctionStatus").withArgs(1);
        });

        it("should emit AuctionStatus event if auction time limit has expired", async () => {
          await time.increaseTo(endTime.add(1));
          const tx = await auction.finalizeAuction(epoch);
          await expect(tx).to.emit(auction, "AuctionStatus").withArgs(1);
        });
      });
    });

    describe("#transferPremium(uint64)", () => {
      describe("if not finalized", () => {
        it.skip("should revert", async () => {});
      });

      describe("else if utilization == 100%", () => {
        time.revertToSnapshotAfterEach(async () => {
          await setupSimpleAuction(false);
        });

        it.skip("should revert if auction is processed", async () => {});

        it.skip("should revert if auction is cancelled", async () => {});

        it("should revert if premiums have been transferred", async () => {
          await auction.transferPremium(0);

          await expect(auction.transferPremium(0)).to.be.revertedWith(
            "premiums transferred"
          );
        });

        it("should transfer premiums to Vault if successful", async () => {
          const auctionBalanceBefore = await asset.balanceOf(addresses.auction);
          const vaultBalanceBefore = await asset.balanceOf(addresses.vault);

          await auction.transferPremium(0);
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
    });

    describe("#processAuction(uint64)", () => {
      describe("if not finalized", () => {
        it.skip("should revert", async () => {});
      });

      describe("else if auction has no orders", () => {
        let endTime: BigNumber;
        let epoch: BigNumber;

        time.revertToSnapshotAfterEach(async () => {
          [, endTime, epoch] = await knoxUtil.initializeAuction();

          await knoxUtil.fastForwardToFriday8AM();
          await knoxUtil.initializeNextEpoch();

          await time.increaseTo(endTime.add(1));
          await auction.finalizeAuction(epoch);
        });

        it("should emit AuctionStatus event when processed", async () => {
          const tx = await auction.processAuction(epoch);
          await expect(tx).to.emit(auction, "AuctionStatus").withArgs(2);
        });
      });

      describe("else if utilization == 100%", () => {
        time.revertToSnapshotAfterEach(async () => {
          await setupSimpleAuction(false);
        });

        it.skip("should revert if auction is processed", async () => {});

        it.skip("should revert if auction is cancelled", async () => {});

        it("should revert if premiums have not been transferred to Vault", async () => {
          await expect(auction.processAuction(0)).to.be.revertedWith(
            "premiums not transferred"
          );
        });

        it("should revert if long tokens have not been transferred to Auction", async () => {
          await auction.transferPremium(0);
          await expect(auction.processAuction(0)).to.be.revertedWith(
            "long tokens not transferred"
          );
        });

        it("should emit AuctionStatus event when processed", async () => {
          await expect(vault.processAuction())
            .to.emit(auction, "AuctionStatus")
            .withArgs(2);
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
        it.skip("should revert", async () => {});
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
          [, endTime, epoch] = await knoxUtil.initializeAuction();
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

          await knoxUtil.fastForwardToFriday8AM();

          // initialize next epoch
          await vault.connect(signers.keeper).depositQueuedToVault();
          await auction.connect(signers.vault).setAuctionPrices(epoch, 0, 0);
          await vault.connect(signers.keeper).setNextEpoch();

          await time.increaseTo(endTime.add(1));
          await auction.finalizeAuction(epoch);

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
        let intrinsicValue = underlyingPrice / 2;
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
          await vault.connect(signers.keeper).processExpired();
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

          await vault.connect(signers.keeper).processExpired();
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

          await assert.bnEqual(order[0], ethers.constants.Zero);
          await assert.bnEqual(order[1], ethers.constants.Zero);
          await assert.bnEqual(order[2], ethers.constants.Zero);
          await assert.equal(order[3], ethers.constants.AddressZero);
        });

        it("should remove tx2 from order book", async () => {
          await auction.connect(signers.buyer2).withdraw(epoch);

          const args = await getEventArgs(simpleAuction.txs[1], "OrderAdded");
          const order = await auction.getOrderById(epoch, args.id);

          await assert.bnEqual(order[0], ethers.constants.Zero);
          await assert.bnEqual(order[1], ethers.constants.Zero);
          await assert.bnEqual(order[2], ethers.constants.Zero);
          await assert.equal(order[3], ethers.constants.AddressZero);
        });

        it("should remove tx3 from order book", async () => {
          await auction.connect(signers.buyer3).withdraw(epoch);

          const args = await getEventArgs(simpleAuction.txs[2], "OrderAdded");
          const order = await auction.getOrderById(epoch, args.id);

          await assert.bnEqual(order[0], ethers.constants.Zero);
          await assert.bnEqual(order[1], ethers.constants.Zero);
          await assert.bnEqual(order[2], ethers.constants.Zero);
          await assert.equal(order[3], ethers.constants.AddressZero);
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
          const startTime = BigNumber.from(block.timestamp + 60);
          const endTime = BigNumber.from(block.timestamp + 86400);

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

          await auction.connect(signers.vault).setAuctionPrices(epoch, 0, 0);

          await auction.finalizeAuction(epoch);
        });

        it("should preview buyer1 refund, only", async () => {
          const estimatedRefund =
            params.price.max * math.bnToNumber(buyer1OrderSize1) +
            params.price.min * math.bnToNumber(buyer1OrderSize2);

          const [refund, fill] = await auction.callStatic[
            "previewWithdraw(uint64)"
          ](epoch);

          assert.isTrue(fill.isZero());
          expect(math.bnToNumber(refund)).to.almost(estimatedRefund, 1);
        });

        it("should preview buyer2 refund, only", async () => {
          const estimatedRefund =
            params.price.min * math.bnToNumber(buyer2OrderSize);

          const [refund, fill] = await auction
            .connect(signers.buyer2)
            .callStatic["previewWithdraw(uint64)"](epoch);

          assert.isTrue(fill.isZero());
          expect(math.bnToNumber(refund)).to.almost(estimatedRefund, 1);
        });

        it("should preview buyer3 refund, only", async () => {
          const estimatedRefund =
            params.price.max * math.bnToNumber(buyer3OrderSize);

          const [refund, fill] = await auction
            .connect(signers.buyer3)
            .callStatic["previewWithdraw(uint64)"](epoch);

          assert.isTrue(fill.isZero());
          expect(math.bnToNumber(refund)).to.almost(estimatedRefund, 1);
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
          const estimatedRefund = 0;

          const [refund, fill] = await auction
            .connect(signers.buyer3)
            .callStatic["previewWithdraw(uint64)"](epoch);

          expect(math.bnToNumber(refund)).to.almost(estimatedRefund, 1);

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

          await assert.bnEqual(order[0], args.id);
          await assert.bnEqual(order[1], args.price64x64);
          await assert.bnEqual(order[2], args.size);
          await assert.equal(order[3], args.buyer);
        });

        it("should not remove tx2 from order book", async () => {
          await auction
            .connect(signers.buyer2)
            ["previewWithdraw(uint64)"](epoch);

          const args = await getEventArgs(simpleAuction.txs[1], "OrderAdded");
          const order = await auction.getOrderById(epoch, args.id);

          await assert.bnEqual(order[0], args.id);
          await assert.bnEqual(order[1], args.price64x64);
          await assert.bnEqual(order[2], args.size);
          await assert.equal(order[3], args.buyer);
        });

        it("should not remove tx3 from order book", async () => {
          await auction
            .connect(signers.buyer3)
            ["previewWithdraw(uint64)"](epoch);

          const args = await getEventArgs(simpleAuction.txs[2], "OrderAdded");
          const order = await auction.getOrderById(epoch, args.id);

          await assert.bnEqual(order[0], args.id);
          await assert.bnEqual(order[1], args.price64x64);
          await assert.bnEqual(order[2], args.size);
          await assert.equal(order[3], args.buyer);
        });
      });
    });

    describe.skip("#getTotalContracts(uint64)", () => {
      time.revertToSnapshotAfterEach(async () => {});

      it("", async () => {});
    });
  });
}
