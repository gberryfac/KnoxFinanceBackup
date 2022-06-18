import { ethers } from "hardhat";
const { BigNumber, provider } = ethers;

import {
  MockPremiaPool,
  MockSpotPriceOracle,
  MockVolatilityOracle,
  Pricer,
  MockPremiaPool__factory,
  MockSpotPriceOracle__factory,
  MockVolatilityOracle__factory,
  Pricer__factory,
} from "../types";

import { fixedFromFloat, fixedToNumber } from "@premia/utils";

import * as assets from "./utils/assets";
import * as time from "./utils/time";

import { expect } from "chai";
import { assert } from "./utils/assertions";

import { ADDRESS_ZERO } from "../constants";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

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

let mockPremiaPool: MockPremiaPool;
let mockBaseSpotPriceOracle: MockSpotPriceOracle;
let mockUnderlyingSpotPriceOracle: MockSpotPriceOracle;
let mockVolatilityOracle: MockVolatilityOracle;
let standardDeltaPricer: Pricer;
let signer: SignerWithAddress;

describe.only("Standard Delta Pricer Unit Tests", () => {
  before(async () => {
    [signer] = await ethers.getSigners();

    mockBaseSpotPriceOracle = await new MockSpotPriceOracle__factory(
      signer
    ).deploy(8, 100000000);

    mockUnderlyingSpotPriceOracle = await new MockSpotPriceOracle__factory(
      signer
    ).deploy(8, 200000000);

    mockPremiaPool = await new MockPremiaPool__factory(signer).deploy(
      params.underlying.address,
      params.base.address,
      mockUnderlyingSpotPriceOracle.address,
      mockBaseSpotPriceOracle.address
    );

    mockVolatilityOracle = await new MockVolatilityOracle__factory(
      signer
    ).deploy(fixedFromFloat("0.9"));

    standardDeltaPricer = await new Pricer__factory(signer).deploy(
      mockPremiaPool.address,
      mockVolatilityOracle.address
    );

    block = await provider.getBlock(await provider.getBlockNumber());
  });

  describe("#constructor", () => {
    time.revertToSnapshotAfterEach(async () => {});

    it("should revert if pool address is 0x0", async () => {
      await expect(
        new Pricer__factory(signer).deploy(
          ADDRESS_ZERO,
          mockVolatilityOracle.address
        )
      ).to.be.revertedWith("0");
    });

    it("should revert if volatility oracle address is 0x0", async () => {
      await expect(
        new Pricer__factory(signer).deploy(mockPremiaPool.address, ADDRESS_ZERO)
      ).to.be.revertedWith("0");
    });

    it("should revert if base and underlying decimals do not match", async () => {
      const mockBaseSpotPriceOracle = await new MockSpotPriceOracle__factory(
        signer
      ).deploy(18, 100000000);

      const mockUnderlyingSpotPriceOracle =
        await new MockSpotPriceOracle__factory(signer).deploy(8, 200000000);

      const mockPremiaPool = await new MockPremiaPool__factory(signer).deploy(
        ADDRESS_ZERO,
        ADDRESS_ZERO,
        mockUnderlyingSpotPriceOracle.address,
        mockBaseSpotPriceOracle.address
      );

      await expect(
        new Pricer__factory(signer).deploy(
          mockPremiaPool.address,
          mockVolatilityOracle.address
        )
      ).to.be.revertedWith("oracle decimals must match");
    });

    it("should initialize Pricer with correct values", async () => {
      // Check Addresses
      assert.equal(
        await standardDeltaPricer.IVolOracle(),
        mockVolatilityOracle.address
      );

      assert.equal(
        await standardDeltaPricer.BaseSpotOracle(),
        mockBaseSpotPriceOracle.address
      );

      assert.equal(
        await standardDeltaPricer.UnderlyingSpotOracle(),
        mockUnderlyingSpotPriceOracle.address
      );

      // Check Asset Properties
      const { base, underlying } = await standardDeltaPricer.assetProperties();

      assert.equal(base, params.base.address);
      assert.equal(underlying, params.underlying.address);
    });
  });

  describe("#latestAnswer64x64", () => {
    time.revertToSnapshotAfterEach(async () => {});

    it("should convert price correctly", async () => {
      assert.equal(
        fixedToNumber(await standardDeltaPricer.latestAnswer64x64()),
        2
      );
    });
  });

  describe("#getTimeToMaturity64x64", () => {
    time.revertToSnapshotAfterEach(async () => {});

    it("should revert if block timestamp >= expiry", async () => {
      assert.bnEqual(
        await standardDeltaPricer.getTimeToMaturity64x64(block.timestamp),
        BigNumber.from("0")
      );
    });

    it("should convert time to maurity correctly", async () => {
      const expected = (params.expiry - block.timestamp) / 31536000;

      // truncates the last 3 digits of timestamp
      assert.bnEqual(
        (await standardDeltaPricer.getTimeToMaturity64x64(params.expiry)).div(
          1000
        ),
        fixedFromFloat(expected).div(1000)
      );
    });
  });

  describe("#getDeltaStrikePrice64x64", () => {
    time.revertToSnapshotAfterEach(async () => {});

    it("should revert if iv_atm <= 0", async () => {
      const mockVolatilityOracle = await new MockVolatilityOracle__factory(
        signer
      ).deploy(0);

      const testPricer = await new Pricer__factory(signer).deploy(
        mockPremiaPool.address,
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
        standardDeltaPricer.getDeltaStrikePrice64x64(
          params.isCall,
          block.timestamp,
          params.delta64x64
        )
      ).to.be.revertedWith("tau <= 0");
    });

    it("should calculate delta strike price for call option", async () => {
      const strike = await standardDeltaPricer.getDeltaStrikePrice64x64(
        params.isCall,
        params.expiry,
        params.delta64x64
      );

      assert.isFalse(strike.isZero());
    });

    it("should calculate delta strike price for put option", async () => {
      const strike = await standardDeltaPricer.getDeltaStrikePrice64x64(
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
      assert.equal(
        fixedToNumber(await standardDeltaPricer.snapToGrid(true, n)),
        answer
      );
    });

    it("should round up if call option", async () => {
      const n = fixedFromFloat(4401);
      const answer = 4500;
      assert.equal(
        fixedToNumber(await standardDeltaPricer.snapToGrid(true, n)),
        answer
      );
    });

    it("should round down if put option", async () => {
      const n = fixedFromFloat(4599);
      const answer = 4500;
      assert.equal(
        fixedToNumber(await standardDeltaPricer.snapToGrid(false, n)),
        answer
      );
    });
  });
});
