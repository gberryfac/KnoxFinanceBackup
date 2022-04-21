import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

export type Signers = {
  admin: SignerWithAddress;
  user: SignerWithAddress;
  user2: SignerWithAddress;
  owner: SignerWithAddress;
  keeper: SignerWithAddress;
  feeRecipient: SignerWithAddress;
  whale?: SignerWithAddress;
};

export type Addresses = {
  admin: string;
  user: string;
  user2: string;
  owner: string;
  keeper: string;
  feeRecipient: string;
  whale?: string;
  pool?: string;
  commonLogic?: string;
  vaultDisplay?: string;
  vaultLifecycle?: string;
  vaultLogic?: string;
  registry?: string;
  strategy?: string;
  vault?: string;
};
