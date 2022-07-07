import { ethers } from "hardhat";
const { provider } = ethers;
const { parseUnits } = ethers.utils;

import { fixedFromFloat } from "@premia/utils";
import { deployMockContract } from "ethereum-waffle";

import chai, { expect } from "chai";
const chaiAlmost = require("chai-almost");
chai.use(chaiAlmost(1));

import {
  Auction,
  AuctionProxy,
  MockERC20,
  Auction__factory,
  AuctionProxy__factory,
  Pricer__factory,
} from "../types";

import * as accounts from "./utils/accounts";
import * as assets from "./utils/assets";
import * as math from "./utils/math";
import * as time from "./utils/time";
import * as types from "./utils/types";

import { assert } from "./utils/assertions";

import { MockPremiaPoolUtil } from "./utils/MockUtil";
import { VaultUtil } from "./utils/VaultUtil";

import { BigNumber } from "ethers";
import { ADDRESS_ONE } from "../constants";

import moment from "moment-timezone";
import { start } from "repl";
moment.tz.setDefault("UTC");

describe("Auction Unit Tests", () => {
  behavesLikeAuction({
    name: "Auction (Put Options)",
    tokenName: `Knox ETH Delta Vault`,
    tokenSymbol: `kETH-DELTA-P`,
    tokenDecimals: 18,
    asset: assets.DAI,
    delta: 0.4,
    deltaOffset: 0.05,
    pool: assets.PREMIA.WETH_DAI,
    mint: parseUnits("1000", assets.DAI.decimals),
    deposit: parseUnits("10", assets.DAI.decimals),
    maxTVL: parseUnits("100", assets.DAI.decimals),
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
    pool: assets.PREMIA.WETH_DAI,
    mint: parseUnits("1000", assets.ETH.decimals),
    deposit: parseUnits("10", assets.ETH.decimals),
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
  deposit: BigNumber;
  maxTVL: BigNumber;
}

function behavesLikeAuction(params: Params) {
  describe.only(params.name, () => {
    let block;
    let asset: MockERC20;
    let instance: Auction;
    let mockPremiaPool: MockPremiaPoolUtil;
    let proxy: AuctionProxy;
    let v: VaultUtil;
    let addresses: types.Addresses;
    let signers: types.Signers;

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

      instance = await new Auction__factory(signers.deployer).deploy(
        params.isCall,
        addresses.pool,
        addresses.vault
      );

      proxy = await new AuctionProxy__factory(signers.deployer).deploy(
        params.minSize,
        instance.address,
        addresses.deployer
      );

      instance = Auction__factory.connect(proxy.address, signers.buyer1);
      addresses.auction = instance.address;

      const mockVolatilityOracle = await deployMockContract(
        signers.deployer as any,
        [
          "function getAnnualizedVolatility64x64(address,address,int128,int128,int128) external view returns (int128)",
        ]
      );

      await mockVolatilityOracle.mock.getAnnualizedVolatility64x64.returns(
        fixedFromFloat("0.5")
      );

      const pricer = await new Pricer__factory(signers.deployer).deploy(
        mockPremiaPool.pool.address,
        mockVolatilityOracle.address
      );

      addresses.pricer = pricer.address;

      const initImpl = {
        auction: addresses.auction,
        queue: ADDRESS_ONE,
        pricer: addresses.pricer,
      };

      await v.vault.connect(signers.deployer).initialize(initImpl);

      asset = v.asset;

      asset = params.isCall
        ? mockPremiaPool.underlyingAsset
        : mockPremiaPool.baseAsset;

      asset.connect(signers.buyer1).mint(addresses.buyer1, params.mint);
      asset.connect(signers.buyer1).mint(addresses.vault, params.mint);

      block = await provider.getBlock(await provider.getBlockNumber());
    });

    describe("#constructor()", () => {
      time.revertToSnapshotAfterEach(async () => {});

      it("should initialize Auction with correct state", async () => {
        await assert.equal(await instance.ERC20(), asset.address);
        await assert.equal(await instance.Vault(), addresses.vault);
        // TODO: await assert.equal(await instance.getMinSize(), params.minSize);
      });
    });

    describe("#initialize(AuctionStorage.InitAuction)", () => {
      const epoch = 0;
      time.revertToSnapshotAfterEach(async () => {});

      it("should revert if caller is !vault", async () => {
        await expect(
          instance.initialize({
            epoch: epoch,
            startTime: BigNumber.from(block.timestamp + 7200),
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
          startTime: BigNumber.from(block.timestamp + 7200),
          endTime: BigNumber.from(block.timestamp + 86400),
        };

        await instance.connect(signers.deployer).initialize(initAuction);

        const auction = await instance.getAuction(0);

        assert.equal(await instance.status(epoch), 0);

        await assert.bnEqual(auction.startTime, initAuction.startTime);
        await assert.bnEqual(auction.endTime, initAuction.endTime);

        await assert.bnEqual(auction.totalCollateral, ethers.constants.Zero);
        await assert.bnEqual(
          auction.totalCollateralUsed,
          ethers.constants.Zero
        );

        await assert.bnEqual(auction.totalPremiums, ethers.constants.Zero);
        await assert.bnEqual(
          auction.totalTime,
          initAuction.endTime.sub(initAuction.startTime)
        );

        await assert.bnEqual(auction.lastPrice64x64, ethers.constants.Zero);
        await assert.bnEqual(auction.longTokenId, ethers.constants.Zero);
      });
    });

    describe("#setAuctionPrices(uint64,int128,int128)", () => {
      describe("if uninitialized", () => {
        it.skip("should revert", async () => {});
      });

      describe("else", () => {
        const epoch = 0;
        const maxPrice64x64 = fixedFromFloat("0.1");
        const minPrice64x64 = fixedFromFloat("0.01");

        time.revertToSnapshotAfterEach(async () => {
          await instance.connect(signers.deployer).initialize({
            epoch: epoch,
            startTime: BigNumber.from(block.timestamp + 7200),
            endTime: BigNumber.from(block.timestamp + 86400),
          });
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

          const auction = await instance.getAuction(0);

          await assert.bnEqual(auction.maxPrice64x64, maxPrice64x64);
          await assert.bnEqual(auction.minPrice64x64, minPrice64x64);
        });
      });
    });

    describe("#addLimitOrder(uint64,uint256,uint256)", () => {
      describe("if uninitialized", () => {
        it.skip("should revert", async () => {});
      });

      describe("else", () => {
        const epoch = 0;
        const cost = params.deposit.div(10);

        time.revertToSnapshotAfterEach(async () => {
          await instance.connect(signers.deployer).initialize({
            epoch: epoch,
            startTime: BigNumber.from(block.timestamp + 7200),
            endTime: BigNumber.from(block.timestamp + 86400),
          });
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

        it.skip("should return 0 if call finalizes auction", async () => {});

        it("should return order id if successful", async () => {});

        it("should send funds to Auction if successful", async () => {
          const auctionBalanceBefore = await asset.balanceOf(addresses.auction);

          await asset.connect(signers.buyer1).approve(addresses.auction, cost);

          await instance.addLimitOrder(
            epoch,
            fixedFromFloat("0.1"),
            params.deposit
          );

          const auctionBalanceAfter = await asset.balanceOf(addresses.auction);

          expect(math.bnToNumber(auctionBalanceBefore)).to.almost(
            math.bnToNumber(auctionBalanceAfter.sub(cost))
          );
        });

        it("should add order to orderbook if successful", async () => {
          await asset.connect(signers.buyer1).approve(addresses.auction, cost);

          await instance.addLimitOrder(
            epoch,
            fixedFromFloat("0.1"),
            params.deposit
          );

          const order = await instance.getOrderById(epoch, 1);

          await assert.bnEqual(order[0], BigNumber.from("1"));
          await assert.bnEqual(order[1], fixedFromFloat("0.1"));
          await assert.bnEqual(order[2], params.deposit);
          await assert.equal(order[3], addresses.buyer1);
        });
      });
    });

    describe("#cancelLimitOrder(uint64,uint256)", () => {
      describe("if uninitialized", () => {
        it.skip("should revert", async () => {});
      });

      describe("else", () => {
        const epoch = 0;
        const cost = params.deposit.div(10);

        time.revertToSnapshotAfterEach(async () => {
          await instance.connect(signers.deployer).initialize({
            epoch: 0,
            startTime: BigNumber.from(block.timestamp + 7200),
            endTime: BigNumber.from(block.timestamp + 86400),
          });

          await asset.connect(signers.buyer1).approve(addresses.auction, cost);

          await instance.addLimitOrder(
            epoch,
            fixedFromFloat("0.1"),
            params.deposit
          );
        });
        it("should revert if order id is invalid", async () => {
          await expect(
            instance.connect(signers.buyer1).cancelLimitOrder(epoch, 0)
          ).to.be.revertedWith("invalid order id");
        });

        it("should revert if order is not in orderbook", async () => {
          await expect(
            instance.connect(signers.buyer1).cancelLimitOrder(epoch, 2)
          ).to.be.revertedWith("order does not exist");
        });

        it("should revert if buyer != sender", async () => {
          await expect(
            instance.connect(signers.buyer2).cancelLimitOrder(epoch, 1)
          ).to.be.revertedWith("buyer != msg.sender");
        });

        it.skip("should revert if auction is finalized", async () => {});

        it.skip("should return false if call finalizes auction", async () => {});

        it("should issue refund if successful", async () => {
          const buyerBalanceBefore = await asset.balanceOf(addresses.buyer1);
          await instance.connect(signers.buyer1).cancelLimitOrder(epoch, 1);
          const buyerBalanceAfter = await asset.balanceOf(addresses.buyer1);

          expect(math.bnToNumber(buyerBalanceBefore)).to.almost(
            math.bnToNumber(buyerBalanceAfter.sub(cost))
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
      });
    });

    describe("#addOrder(uint64,uint256)", () => {
      describe("if uninitialized", () => {
        it.skip("should revert", async () => {});
      });

      describe("else", () => {
        let startTime;
        const epoch = 0;
        const cost = params.deposit.div(10);
        const maxPrice64x64 = fixedFromFloat("0.1");
        const minPrice64x64 = fixedFromFloat("0.01");

        time.revertToSnapshotAfterEach(async () => {
          startTime = BigNumber.from(block.timestamp + 60);

          await instance.connect(signers.deployer).initialize({
            epoch: epoch,
            startTime: startTime,
            endTime: BigNumber.from(block.timestamp + 86400),
          });

          await instance
            .connect(signers.deployer)
            .setAuctionPrices(epoch, maxPrice64x64, minPrice64x64);
        });

        it.skip("should revert if auction is finalized", async () => {});

        it("should revert if order size is below min size", async () => {
          await expect(
            instance.addOrder(epoch, parseUnits("1", params.asset.decimals - 2))
          ).to.be.revertedWith("size < minimum");
        });

        it.skip("should return 0 if call finalizes auction", async () => {});

        it("should return order id if successful", async () => {});

        it.skip("should send funds to Auction if successful", async () => {
          time.increaseTo(startTime);

          const auctionBalanceBefore = await asset.balanceOf(addresses.auction);
          console.log(await instance.priceCurve(epoch));

          // await asset.connect(signers.buyer1).approve(addresses.auction, cost);

          // await instance.addOrder(epoch, params.deposit);

          // const auctionBalanceAfter = await asset.balanceOf(addresses.auction);

          // expect(math.bnToNumber(auctionBalanceBefore)).to.almost(
          //   math.bnToNumber(auctionBalanceAfter.sub(cost))
          // );
        });

        it.skip("should add order to orderbook if successful", async () => {
          await asset.connect(signers.buyer1).approve(addresses.auction, cost);

          await instance.addOrder(epoch, params.deposit);

          const order = await instance.getOrderById(epoch, 1);

          await assert.bnEqual(order[0], BigNumber.from("1"));
          await assert.bnEqual(order[1], fixedFromFloat("0.1"));
          await assert.bnEqual(order[2], params.deposit);
          await assert.equal(order[3], addresses.buyer1);
        });
      });
    });

    describe.skip("", () => {
      time.revertToSnapshotAfterEach(async () => {});

      it("", async () => {});
    });
  });
}
