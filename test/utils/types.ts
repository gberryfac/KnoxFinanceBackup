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
  keeper: SignerWithAddress;
  feeRecipient: SignerWithAddress;
  buyer1: SignerWithAddress;
  buyer2: SignerWithAddress;
  buyer3: SignerWithAddress;
};

export type Addresses = {
  deployer: string;
  lp1: string;
  lp2: string;
  lp3: string;
  keeper: string;
  feeRecipient: string;
  buyer1: string;
  buyer2: string;
  buyer3: string;
  auction?: string;
  buyer?: string;
  pool?: string;
  helpers?: string;
  pricer?: string;
  queue?: string;
  vault?: string;
  spotOracle?: string;
  volatilityOracle?: string;
};

export type VaultParams = {
  name?: string;
  tokenName?: string;
  tokenSymbol?: string;
  tokenDecimals?: number;
  asset?: Asset;
  delta?: number;
  deltaOffset?: number;
  pool?: Pool;
  deposit?: BigNumber;
  maxTVL?: BigNumber;
  minSize?: BigNumber;
  performanceFee?: BigNumber;
  withdrawalFee?: BigNumber;
  isCall?: boolean;
};
