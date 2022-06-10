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
  admin: SignerWithAddress;
  lp1: SignerWithAddress;
  lp2: SignerWithAddress;
  lp3: SignerWithAddress;
  owner: SignerWithAddress;
  keeper: SignerWithAddress;
  feeRecipient: SignerWithAddress;
  buyer?: SignerWithAddress;
  strategy?: SignerWithAddress;
};

export type Addresses = {
  admin: string;
  lp1: string;
  lp2: string;
  lp3: string;
  owner: string;
  keeper: string;
  feeRecipient: string;
  buyer?: string;
  pool?: string;
  helpers?: string;
  vaultDisplay?: string;
  vaultLifecycle?: string;
  vaultLogic?: string;
  pricer?: string;
  strategy?: string;
  vault?: string;
  spotOracle?: string;
  volatilityOracle?: string;
};
