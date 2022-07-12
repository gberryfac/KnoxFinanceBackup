import * as types from "./types";

import {
  MockPremiaPool,
  MockSpotPriceOracle,
  MockPremiaPool__factory,
  MockSpotPriceOracle__factory,
} from "../../types";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

interface MockPremiaPoolUtilArgs {
  pool: MockPremiaPool;
  baseSpotPriceOracle: MockSpotPriceOracle;
  underlyingSpotPriceOracle: MockSpotPriceOracle;
}

export class MockPremiaPoolUtil {
  pool: MockPremiaPool;
  baseSpotPriceOracle: MockSpotPriceOracle;
  underlyingSpotPriceOracle: MockSpotPriceOracle;

  constructor(props: MockPremiaPoolUtilArgs) {
    this.pool = props.pool;
    this.baseSpotPriceOracle = props.baseSpotPriceOracle;
    this.underlyingSpotPriceOracle = props.underlyingSpotPriceOracle;
  }

  static async deploy(
    underlying: {
      oracleDecimals: number;
      oraclePrice: number;
      asset: types.Asset;
    },
    base: {
      oracleDecimals: number;
      oraclePrice: number;
      asset: types.Asset;
    },
    deployer: SignerWithAddress
  ) {
    const underlyingSpotPriceOracle = await new MockSpotPriceOracle__factory(
      deployer
    ).deploy(underlying.oracleDecimals, underlying.oraclePrice);

    const baseSpotPriceOracle = await new MockSpotPriceOracle__factory(
      deployer
    ).deploy(base.oracleDecimals, base.oraclePrice);

    const pool = await new MockPremiaPool__factory(deployer).deploy(
      underlying.asset.address,
      base.asset.address,
      underlyingSpotPriceOracle.address,
      baseSpotPriceOracle.address
    );

    return new MockPremiaPoolUtil({
      pool,
      underlyingSpotPriceOracle,
      baseSpotPriceOracle,
    });
  }
}
