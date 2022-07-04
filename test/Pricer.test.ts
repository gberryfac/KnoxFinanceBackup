import { ethers } from "hardhat";
const { BigNumber, provider } = ethers;

import { fixedFromFloat, fixedToNumber } from "@premia/utils";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";

import {
  MockVolatilityOracle,
  Pricer,
  MockPremiaPool__factory,
  MockSpotPriceOracle__factory,
  MockVolatilityOracle__factory,
  Pricer__factory,
} from "../types";

import * as assets from "./utils/assets";
import { assert } from "./utils/assertions";
import * as time from "./utils/time";
import { MockPremiaPoolUtil } from "./utils/MockUtil";

import { ADDRESS_ZERO } from "../constants";

import moment from "moment-timezone";
moment.tz.setDefault("UTC");

const params = {
  isCall: true,
  expiry: 1653033600, // 8AM GMT, Friday after block 14765000
  delta64x64: fixedFromFloat(0.25),
  base: assets.DAI,
  underlying: assets.ETH,
};

let block;

let mockPremiaPool: MockPremiaPoolUtil;
let mockVolatilityOracle: MockVolatilityOracle;
let pricer: Pricer;
let deployer: SignerWithAddress;

describe.only("Pricer Unit Tests", () => {
  before(async () => {
    [deployer] = await ethers.getSigners();

    mockPremiaPool = await MockPremiaPoolUtil.deploy(
      {
        oracleDecimals: 8,
        oraclePrice: 200000000,
        asset: params.underlying,
      },
      {
        oracleDecimals: 8,
        oraclePrice: 100000000,
        asset: params.base,
      },
      deployer
    );

    mockVolatilityOracle = await new MockVolatilityOracle__factory(
      deployer
    ).deploy(fixedFromFloat("0.9"));

    pricer = await new Pricer__factory(deployer).deploy(
      mockPremiaPool.pool.address,
      mockVolatilityOracle.address
    );

    block = await provider.getBlock(await provider.getBlockNumber());
  });

  describe("#constructor", () => {
    time.revertToSnapshotAfterEach(async () => {});

    it("should revert if pool address is 0x0", async () => {
      await expect(
        new Pricer__factory(deployer).deploy(
          ADDRESS_ZERO,
          mockVolatilityOracle.address
        )
      ).to.be.revertedWith("address not provided");
    });

    it("should revert if volatility oracle address is 0x0", async () => {
      await expect(
        new Pricer__factory(deployer).deploy(
          mockPremiaPool.pool.address,
          ADDRESS_ZERO
        )
      ).to.be.revertedWith("address not provided");
    });

    it("should initialize Pricer with correct values", async () => {
      // Check Addresses
      assert.equal(await pricer.IVolOracle(), mockVolatilityOracle.address);

      assert.equal(
        await pricer.BaseSpotOracle(),
        mockPremiaPool.baseSpotPriceOracle.address
      );

      assert.equal(
        await pricer.UnderlyingSpotOracle(),
        mockPremiaPool.underlyingSpotPriceOracle.address
      );

      // Check Asset Properties
      const base = await pricer.base();
      const underlying = await pricer.underlying();

      assert.equal(base, params.base.address);
      assert.equal(underlying, params.underlying.address);
    });

    it("should revert if base and underlying decimals do not match", async () => {
      const mockBaseSpotPriceOracle = await new MockSpotPriceOracle__factory(
        deployer
      ).deploy(18, 100000000);

      const mockUnderlyingSpotPriceOracle =
        await new MockSpotPriceOracle__factory(deployer).deploy(8, 200000000);

      const mockPremiaPool = await new MockPremiaPool__factory(deployer).deploy(
        ADDRESS_ZERO,
        ADDRESS_ZERO,
        mockUnderlyingSpotPriceOracle.address,
        mockBaseSpotPriceOracle.address
      );

      await expect(
        new Pricer__factory(deployer).deploy(
          mockPremiaPool.address,
          mockVolatilityOracle.address
        )
      ).to.be.revertedWith("oracle decimals must match");
    });
  });

  describe("#latestAnswer64x64", () => {
    time.revertToSnapshotAfterEach(async () => {});

    it("should convert price correctly", async () => {
      assert.equal(fixedToNumber(await pricer.latestAnswer64x64()), 2);
    });
  });

  describe("#getTimeToMaturity64x64", () => {
    time.revertToSnapshotAfterEach(async () => {});

    it("should revert if block timestamp >= expiry", async () => {
      assert.bnEqual(
        await pricer.getTimeToMaturity64x64(block.timestamp),
        BigNumber.from("0")
      );
    });

    it("should convert time to maurity correctly", async () => {
      const expected = (params.expiry - block.timestamp) / 31536000;

      // truncates the last 3 digits of timestamp
      assert.bnEqual(
        (await pricer.getTimeToMaturity64x64(params.expiry)).div(1000),
        fixedFromFloat(expected).div(1000)
      );
    });
  });

  describe("#getDeltaStrikePrice64x64", () => {
    time.revertToSnapshotAfterEach(async () => {});

    it("should revert if iv_atm <= 0", async () => {
      const mockVolatilityOracle = await new MockVolatilityOracle__factory(
        deployer
      ).deploy(0);

      const testPricer = await new Pricer__factory(deployer).deploy(
        mockPremiaPool.pool.address,
        mockVolatilityOracle.address
      );

      await expect(
        testPricer.getDeltaStrikePrice64x64(
          params.isCall,
          params.expiry,
          params.delta64x64
        )
      ).to.be.revertedWith("iv_atm <= 0");
    });

    it("should revert if tau <= 0", async () => {
      await expect(
        pricer.getDeltaStrikePrice64x64(
          params.isCall,
          block.timestamp,
          params.delta64x64
        )
      ).to.be.revertedWith("tau <= 0");
    });

    it("should calculate delta strike price for call option", async () => {
      const strike = await pricer.getDeltaStrikePrice64x64(
        params.isCall,
        params.expiry,
        params.delta64x64
      );

      assert.isFalse(strike.isZero());
    });

    it("should calculate delta strike price for put option", async () => {
      const strike = await pricer.getDeltaStrikePrice64x64(
        !params.isCall,
        params.expiry,
        fixedFromFloat(0.25)
      );

      assert.isFalse(strike.isZero());
    });
  });

  describe("#snapToGrid", () => {
    time.revertToSnapshotAfterEach(async () => {});

    it("should not round if already round", async () => {
      const n = fixedFromFloat(4500);
      const answer = 4500;
      assert.equal(fixedToNumber(await pricer.snapToGrid(true, n)), answer);
    });

    it("should round up if call option", async () => {
      const n = fixedFromFloat(4401);
      const answer = 4500;
      assert.equal(fixedToNumber(await pricer.snapToGrid(true, n)), answer);
    });

    it("should round down if put option", async () => {
      const n = fixedFromFloat(4599);
      const answer = 4500;
      assert.equal(fixedToNumber(await pricer.snapToGrid(false, n)), answer);
    });
  });
});
