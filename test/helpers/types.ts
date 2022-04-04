import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

export type Signers = {
  admin: SignerWithAddress;
  user: SignerWithAddress;
  owner: SignerWithAddress;
  keeper: SignerWithAddress;
  feeRecipient: SignerWithAddress;
  whale?: SignerWithAddress;
};

export type Addresses = {
  admin: string;
  user: string;
  owner: string;
  keeper: string;
  feeRecipient: string;
  whale?: string;
};
