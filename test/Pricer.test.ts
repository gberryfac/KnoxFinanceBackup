import { ethers } from "hardhat";
const { provider } = ethers;
import { BigNumber } from "ethers";

import { fixedFromFloat, fixedToNumber } from "@premia/utils";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { deployMockContract, MockContract } from "ethereum-waffle";
import { expect } from "chai";

import { Pricer, Pricer__factory } from "../types";

import { assert } from "./utils/assertions";
import * as time from "./utils/time";
import { MockPremiaPoolUtil } from "./utils/MockUtil";

import { ADDRESS_ZERO } from "../constants";

import moment from "moment-timezone";
moment.tz.setDefault("UTC");

describe("Pricer Unit Tests", () => {
  behavesLikePricer({
    name: "Pricer (Put Options)",
    isCall: false,
    expiry: 1653033600, // 8AM GMT, Friday after block 14765000
    delta64x64: fixedFromFloat(0.25),
  });

  behavesLikePricer({
    name: "Pricer (Call Options)",
    isCall: true,
    expiry: 1653033600, // 8AM GMT, Friday after block 14765000
    delta64x64: fixedFromFloat(0.4),
  });
});

type Params = {
  name: string;
  isCall: boolean;
  expiry: number;
  delta64x64: BigNumber;
};

function behavesLikePricer(params: Params) {
  describe.only(params.name, () => {
    let block;
    let mockPremiaPool: MockPremiaPoolUtil;
    let mockVolatilityOracle: MockContract;
    let pricer: Pricer;
    let deployer: SignerWithAddress;

    before(async () => {
      [deployer] = await ethers.getSigners();

      mockPremiaPool = await MockPremiaPoolUtil.deploy(
        {
          decimals: 8,
          price: 200000000,
        },
        {
          decimals: 8,
          price: 100000000,
        },
        deployer
      );

      mockVolatilityOracle = await deployMockContract(deployer as any, [
        "function getAnnualizedVolatility64x64(address,address,int128,int128,int128) external view returns (int128)",
      ]);

      await mockVolatilityOracle.mock.getAnnualizedVolatility64x64.returns(
        fixedFromFloat("0.9")
      );

      pricer = await new Pricer__factory(deployer).deploy(
        mockPremiaPool.pool.address,
        mockVolatilityOracle.address
      );

      block = await provider.getBlock(await provider.getBlockNumber());
    });

    describe("#constructor()", () => {
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

        assert.equal(base, mockPremiaPool.baseAsset.address);
        assert.equal(underlying, mockPremiaPool.underlyingAsset.address);
      });

      it("should revert if base and underlying decimals do not match", async () => {
        const mockPremiaPool = await MockPremiaPoolUtil.deploy(
          {
            decimals: 8,
            price: 200000000,
          },
          {
            decimals: 18,
            price: 100000000,
          },
          deployer
        );

        await expect(
          new Pricer__factory(deployer).deploy(
            mockPremiaPool.pool.address,
            mockVolatilityOracle.address
          )
        ).to.be.revertedWith("oracle decimals must match");
      });
    });

    describe("#latestAnswer64x64()", () => {
      time.revertToSnapshotAfterEach(async () => {});

      it("should convert price correctly", async () => {
        assert.equal(fixedToNumber(await pricer.latestAnswer64x64()), 2);
      });
    });

    describe("#getTimeToMaturity64x64(uint64)", () => {
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

    describe("#getDeltaStrikePrice64x64(bool,uint64,int128)", () => {
      time.revertToSnapshotAfterEach(async () => {});

      it("should revert if iv_atm <= 0", async () => {
        const mockVolatilityOracle = await deployMockContract(deployer as any, [
          "function getAnnualizedVolatility64x64(address,address,int128,int128,int128) external view returns (int128)",
        ]);

        await mockVolatilityOracle.mock.getAnnualizedVolatility64x64.returns(0);

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

    describe("#snapToGrid(bool,int128)", () => {
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
}
