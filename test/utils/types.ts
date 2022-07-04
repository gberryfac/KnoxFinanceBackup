import { BigNumber } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

export type Pool = {
  address: string;
  base: Asset;
  underlying: Asset;
};

export type Asset = {
  address: string;
  decimals: number;
  spotOracle: string;
  buyer: string;
};

export type Signers = {
  deployer: SignerWithAddress;
  lp1: SignerWithAddress;
  lp2: SignerWithAddress;
  lp3: SignerWithAddress;
  owner: SignerWithAddress;
  keeper: SignerWithAddress;
  feeRecipient: SignerWithAddress;
  buyer?: SignerWithAddress;
  queue?: SignerWithAddress;
};

export type Addresses = {
  deployer: string;
  lp1: string;
  lp2: string;
  lp3: string;
  owner: string;
  keeper: string;
  feeRecipient: string;
  buyer?: string;
  pool?: string;
  helpers?: string;
  pricer?: string;
  queue?: string;
  vault?: string;
  spotOracle?: string;
  volatilityOracle?: string;
};

export type Params = {
  name: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimals: number;
  asset: Asset;
  delta: number;
  pool: Pool;
  depositAmount: BigNumber;
  maxTVL: BigNumber;
  minimumSupply: string;
  minimumContractSize: string;
  performanceFee: BigNumber;
  withdrawalFee: BigNumber;
  isCall: boolean;
};
