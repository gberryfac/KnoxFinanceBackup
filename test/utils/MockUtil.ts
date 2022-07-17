import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { deployMockContract, MockContract } from "ethereum-waffle";

import {
  MockERC20,
  MockPremiaPool,
  MockERC20__factory,
  MockPremiaPool__factory,
} from "../../types";

interface MockPremiaPoolUtilArgs {
  pool: MockPremiaPool;
  underlyingSpotPriceOracle: MockContract;
  baseSpotPriceOracle: MockContract;
  underlyingAsset: MockERC20;
  baseAsset: MockERC20;
}

export class MockPremiaPoolUtil {
  pool: MockPremiaPool;
  underlyingSpotPriceOracle: MockContract;
  baseSpotPriceOracle: MockContract;
  underlyingAsset: MockERC20;
  baseAsset: MockERC20;

  constructor(props: MockPremiaPoolUtilArgs) {
    this.pool = props.pool;
    this.baseSpotPriceOracle = props.baseSpotPriceOracle;
    this.underlyingSpotPriceOracle = props.underlyingSpotPriceOracle;
    this.underlyingAsset = props.underlyingAsset;
    this.baseAsset = props.baseAsset;
  }

  static async deploy(
    underlying: {
      decimals: number;
      price: number;
    },
    base: {
      decimals: number;
      price: number;
    },
    deployer: SignerWithAddress
  ) {
    const underlyingSpotPriceOracle = await deployMockContract(
      deployer as any,
      [
        "function decimals() external view returns (uint8)",
        "function latestRoundData() external view returns (uint80,int256,uint256,uint256,uint80)",
      ]
    );

    await underlyingSpotPriceOracle.mock.decimals.returns(underlying.decimals);
    await underlyingSpotPriceOracle.mock.latestRoundData.returns(
      0,
      underlying.price,
      0,
      0,
      0
    );

    const baseSpotPriceOracle = await deployMockContract(deployer as any, [
      "function decimals() external view returns (uint8)",
      "function latestRoundData() external view returns (uint80,int256,uint256,uint256,uint80)",
    ]);

    await baseSpotPriceOracle.mock.decimals.returns(base.decimals);
    await baseSpotPriceOracle.mock.latestRoundData.returns(
      0,
      base.price,
      0,
      0,
      0
    );

    // TODO: add ERC20 tokens as arguement, if they're undefined deploy MockERC20
    const underlyingAsset = await new MockERC20__factory(deployer).deploy(
      "",
      18
    );

    const baseAsset = await new MockERC20__factory(deployer).deploy("", 18);

    const pool = await new MockPremiaPool__factory(deployer).deploy(
      underlyingAsset.address,
      baseAsset.address,
      underlyingSpotPriceOracle.address,
      baseSpotPriceOracle.address
    );

    return new MockPremiaPoolUtil({
      pool,
      underlyingSpotPriceOracle,
      baseSpotPriceOracle,
      underlyingAsset,
      baseAsset,
    });
  }
}
