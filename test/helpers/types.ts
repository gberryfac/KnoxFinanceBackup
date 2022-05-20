import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

export type Asset = {
  address: string;
  decimals: number;
  spotOracle: string;
};

export type Signers = {
  admin: SignerWithAddress;
  user: SignerWithAddress;
  user2: SignerWithAddress;
  user3: SignerWithAddress;
  owner: SignerWithAddress;
  keeper: SignerWithAddress;
  feeRecipient: SignerWithAddress;
  whale?: SignerWithAddress;
  strategy?: SignerWithAddress;
};

export type Addresses = {
  admin: string;
  user: string;
  user2: string;
  user3: string;
  owner: string;
  keeper: string;
  feeRecipient: string;
  whale?: string;
  pool?: string;
  common?: string;
  vaultDisplay?: string;
  vaultLifecycle?: string;
  vaultLogic?: string;
  pricer?: string;
  strategy?: string;
  vault?: string;
  spotOracle?: string;
  volatilityOracle?: string;
};
