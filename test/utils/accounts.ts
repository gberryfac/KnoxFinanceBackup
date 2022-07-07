import { ethers, network } from "hardhat";
import { BigNumber } from "ethers";
const { getContractAt } = ethers;

import * as types from "./types";

import { SLOTS } from "../../constants";
import { MockERC20 } from "../../types";

export async function getSigners(): Promise<types.Signers> {
  const [
    deployerSigner,
    lp1Signer,
    lp2Signer,
    lp3Signer,
    keeperSigner,
    feeRecipientSigner,
    buyer1Signer,
    buyer2Signer,
    buyer3Signer,
  ] = await ethers.getSigners();
  const signers = {
    deployer: deployerSigner,
    lp1: lp1Signer,
    lp2: lp2Signer,
    lp3: lp3Signer,
    keeper: keeperSigner,
    feeRecipient: feeRecipientSigner,
    buyer1: buyer1Signer,
    buyer2: buyer2Signer,
    buyer3: buyer3Signer,
  };

  return signers as types.Signers;
}

export async function getAddresses(
  signers: types.Signers
): Promise<types.Addresses> {
  const addresses = {
    deployer: signers.deployer.address,
    lp1: signers.lp1.address,
    lp2: signers.lp2.address,
    lp3: signers.lp3.address,
    keeper: signers.keeper.address,
    feeRecipient: signers.feeRecipient.address,
    buyer1: signers.buyer1.address,
    buyer2: signers.buyer2.address,
    buyer3: signers.buyer3.address,
  };

  return addresses;
}

export async function impersonateWhale(
  buyer: string,
  asset: string,
  deposit: BigNumber,
  signers: types.Signers,
  addresses: types.Addresses
): Promise<[types.Signers, types.Addresses, MockERC20]> {
  addresses.buyer1 = buyer;

  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [addresses.buyer1],
  });

  signers.buyer1 = await ethers.getSigner(addresses.buyer1);

  for (let s in signers) {
    let address = signers[s].address;

    await _setERC20Balance(
      asset,
      address,
      deposit.mul(10).toHexString(),
      SLOTS[asset]
    );
  }

  const erc20 = await getContractAt("MockERC20", asset);
  return [signers, addresses, erc20];
}

async function _setERC20Balance(
  asset: string,
  account: string,
  balance: string,
  slot: number
) {
  const index = ethers.utils.solidityKeccak256(
    ["uint256", "uint256"],
    [account, slot]
  );
  const amount = ethers.utils.hexZeroPad(balance, 32);

  await ethers.provider.send("hardhat_setStorageAt", [asset, index, amount]);
}
