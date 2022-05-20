import { ethers } from "hardhat";
import { BigNumber, Contract } from "ethers";

const { getContractFactory, provider } = ethers;

import { fixedFromFloat, fixedToNumber } from "@premia/utils";

import { expect } from "chai";
import moment from "moment-timezone";

import * as assets from "./helpers/assets";
import * as time from "./helpers/time";

import { assert } from "./helpers/assertions";

import {
  ADDRESS_ZERO,
  ADDRESS_ONE,
  NEXT_FRIDAY,
  PREMIA_VOLATILITY_SURFACE_ORACLE,
  WETH_DAI_POOL,
} from "../constants";

const chainId = 1; // ETH Mainnet

moment.tz.setDefault("UTC");

const params = {
  sFactor: 100,
  pool: WETH_DAI_POOL[chainId],
  volatilityOracle: PREMIA_VOLATILITY_SURFACE_ORACLE[chainId],
  isCall: true,
  expiry: NEXT_FRIDAY,
  delta64x64: fixedFromFloat(0.25),
  base: assets.DAI,
  underlying: assets.ETH,
};

let block;

describe("Standard Delta Pricer Unit Tests", () => {
  let standardDeltaPricer: Contract;

  before(async () => {
    standardDeltaPricer = await getContractFactory("StandardDeltaPricer").then(
      (contract) =>
        contract.deploy(params.sFactor, params.pool, params.volatilityOracle)
    );

    block = await provider.getBlock(await provider.getBlockNumber());
  });

  describe("#constructor", () => {
    time.revertToSnapshotAfterEach(async () => {});

    it("should revert if pool address is 0x0", async () => {
      await expect(
        getContractFactory("StandardDeltaPricer").then((contract) =>
          contract.deploy(params.sFactor, ADDRESS_ZERO, params.volatilityOracle)
        )
      ).to.be.revertedWith("0");
    });

    it("should revert if sFactor is 0", async () => {
      await expect(
        getContractFactory("StandardDeltaPricer").then((contract) =>
          contract.deploy(0, params.pool, params.volatilityOracle)
        )
      ).to.be.revertedWith("sFactor <= 0");
    });

    it("should revert if sFactor is not divisible by 10", async () => {
      await expect(
        getContractFactory("StandardDeltaPricer").then((contract) =>
          contract.deploy(11, params.pool, params.volatilityOracle)
        )
      ).to.be.revertedWith("not divisible by 10");
    });

    it("should revert if volatility oracle address is 0x0", async () => {
      await expect(
        getContractFactory("StandardDeltaPricer").then((contract) =>
          contract.deploy(params.sFactor, params.pool, ADDRESS_ZERO)
        )
      ).to.be.revertedWith("0");
    });

    it("should revert if base and underlying decimals do not match", async () => {
      const premiaPool = await getContractFactory("MockPremiaPool").then(
        (contract) =>
          contract.deploy(
            ADDRESS_ONE,
            ADDRESS_ONE,
            "0x194a9AaF2e0b67c35915cD01101585A33Fe25CAa",
            "0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419"
          )
      );

      // queries an invalid Premia pool (AAVE/DAI).
      await expect(
        getContractFactory("StandardDeltaPricer").then((contract) =>
          contract.deploy(
            params.sFactor,
            premiaPool.address,
            params.volatilityOracle
          )
        )
      ).to.be.revertedWith("oracle decimals must match");
    });

    it("should initialize StandardDeltaPricer with correct values", async () => {
      // Check Addresses
      assert.equal(
        await standardDeltaPricer.IVolOracle(),
        params.volatilityOracle
      );

      assert.equal(
        await standardDeltaPricer.BaseSpotOracle(),
        params.base.spotOracle
      );

      assert.equal(
        await standardDeltaPricer.UnderlyingSpotOracle(),
        params.underlying.spotOracle
      );

      // Check Asset Properties
      const { base, underlying } = await standardDeltaPricer.assetProperties();

      assert.equal(base, params.base.address);
      assert.equal(underlying, params.underlying.address);

      // Check Strategy Properties
      assert.equal(await standardDeltaPricer.sFactor(), params.sFactor);
    });
  });

  describe("#latestAnswer", () => {
    time.revertToSnapshotAfterEach(async () => {});

    it("should convert price correctly", async () => {
      // test is valid for block 14765000 (ETH Mainnet)

      assert.equal(
        fixedToNumber(await standardDeltaPricer.latestAnswer()),
        2085.703677825
      );
    });
  });

  describe("#getTimeToMaturity64x64", () => {
    time.revertToSnapshotAfterEach(async () => {});

    it("should return 0 if block timestamp >= expiry", async () => {
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

  describe("#getAnnualizedVolatility64x64", () => {
    time.revertToSnapshotAfterEach(async () => {});

    it("should calculate annualized volatility", async () => {
      const spot64x64 = fixedFromFloat(2000);
      const tau64x64 = fixedFromFloat(
        (params.expiry - block.timestamp) / 31536000
      );

      const annualizedVolatility =
        await standardDeltaPricer.getAnnualizedVolatility64x64(
          tau64x64,
          spot64x64
        );

      // test is valid for block 14765000 (ETH Mainnet)
      assert.equal(fixedToNumber(annualizedVolatility), 0.9433906272);
    });
  });

  describe("#getDeltaStrikePrice64x64", () => {
    time.revertToSnapshotAfterEach(async () => {});

    it("should revert if iv_atm <= 0", async () => {
      const premiaPool = await getContractFactory("MockPremiaPool").then(
        (contract) =>
          contract.deploy(
            "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9",
            params.base.address,
            params.underlying.spotOracle,
            params.base.spotOracle
          )
      );

      // queries an invalid Premia pool (AAVE/DAI).
      const testStandardDeltaPricer = await getContractFactory(
        "StandardDeltaPricer"
      ).then((contract) =>
        contract.deploy(
          params.sFactor,
          premiaPool.address,
          params.volatilityOracle
        )
      );

      await expect(
        testStandardDeltaPricer.getDeltaStrikePrice64x64(
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

      // test is valid for block 14765000 (ETH Mainnet)
      assert.equal(fixedToNumber(strike), 2300.6191817106);
    });

    it("should calculate delta strike price for put option", async () => {
      const strike = await standardDeltaPricer.getDeltaStrikePrice64x64(
        !params.isCall,
        params.expiry,
        fixedFromFloat(0.25)
      );

      // test is valid for block 14765000 (ETH Mainnet)
      assert.equal(fixedToNumber(strike), 1924.3135783038);
    });
  });

  describe("#snapToGrid", () => {
    time.revertToSnapshotAfterEach(async () => {});

    it("should not round if n < sFactor", async () => {
      const n = fixedFromFloat(99);
      const answer = 99;
      assert.equal(
        fixedToNumber(await standardDeltaPricer.snapToGrid(n)),
        answer
      );
    });

    it("should not round if n is already rounded", async () => {
      const n = fixedFromFloat(4500);
      const answer = 4500;
      assert.equal(
        fixedToNumber(await standardDeltaPricer.snapToGrid(n)),
        answer
      );
    });

    it("should round down to the nearest 100", async () => {
      const n = fixedFromFloat(4501);
      const answer = 4500;
      assert.equal(
        fixedToNumber(await standardDeltaPricer.snapToGrid(n)),
        answer
      );
    });

    it("should round down to the nearest 100", async () => {
      const n = fixedFromFloat(4549);
      const answer = 4500;
      assert.equal(
        fixedToNumber(await standardDeltaPricer.snapToGrid(n)),
        answer
      );
    });

    it("should round up to the nearest 100", async () => {
      const n = fixedFromFloat(4550);
      const answer = 4600;
      assert.equal(
        fixedToNumber(await standardDeltaPricer.snapToGrid(n)),
        answer
      );
    });

    it("should round up to the nearest 100", async () => {
      const n = fixedFromFloat(4551);
      const answer = 4600;
      assert.equal(
        fixedToNumber(await standardDeltaPricer.snapToGrid(n)),
        answer
      );
    });

    it("should round up to the nearest 100", async () => {
      const n = fixedFromFloat(455699);
      const answer = 455700;
      assert.equal(
        fixedToNumber(await standardDeltaPricer.snapToGrid(n)),
        answer
      );
    });
  });
});
