import { ethers, network } from "hardhat";
import { BigNumber } from "ethers";
const { getContractAt } = ethers;
const { parseEther } = ethers.utils;

import * as types from "./types";

import { WETH_ADDRESS, SLOTS } from "../../constants";
import { IAsset } from "../../types";

const chainId = network.config.chainId;

export async function getSigners(): Promise<types.Signers> {
  const [
    deployerSigner,
    lp1Signer,
    lp2Signer,
    lp3Signer,
    ownerSigner,
    keeperSigner,
    feeRecipientSigner,
  ] = await ethers.getSigners();
  const signers = {
    deployer: deployerSigner,
    lp1: lp1Signer,
    lp2: lp2Signer,
    lp3: lp3Signer,
    owner: ownerSigner,
    keeper: keeperSigner,
    feeRecipient: feeRecipientSigner,
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
    owner: signers.owner.address,
    keeper: signers.keeper.address,
    feeRecipient: signers.feeRecipient.address,
  };

  return addresses;
}

export async function impersonateWhale(
  buyer: string,
  depositAsset: string,
  depositAmount: BigNumber,
  signers: types.Signers,
  addresses: types.Addresses
): Promise<[types.Signers, types.Addresses, IAsset]> {
  addresses.buyer = buyer;

  const whaleSigner = await _impersonateWhale(addresses.buyer, "1500");
  signers.buyer = whaleSigner;

  const assetContract = await getContractAt("IAsset", depositAsset);

  await _setERC20Balance(
    depositAsset,
    addresses.buyer,
    depositAmount.mul(100).toHexString(),
    SLOTS[depositAsset]
  );

  if (depositAsset === WETH_ADDRESS[chainId]) {
    await assetContract
      .connect(signers.buyer)
      .deposit({ value: parseEther("700") });

    await assetContract
      .connect(signers.buyer)
      .transfer(addresses.deployer, depositAmount.mul(10));
    await assetContract
      .connect(signers.buyer)
      .transfer(addresses.lp1, depositAmount.mul(10));
    await assetContract
      .connect(signers.buyer)
      .transfer(addresses.lp2, depositAmount.mul(10));
  } else {
    await assetContract
      .connect(signers.buyer)
      .transfer(addresses.deployer, depositAmount.mul(10));
    await assetContract
      .connect(signers.buyer)
      .transfer(addresses.lp1, depositAmount.mul(10));
    await assetContract
      .connect(signers.buyer)
      .transfer(addresses.lp2, depositAmount.mul(10));
  }

  return [signers, addresses, assetContract];
}

async function _impersonateWhale(account: string, ethBalance: string) {
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [account],
  });

  await network.provider.send("hardhat_setBalance", [
    account,
    parseEther(ethBalance)._hex,
  ]);

  return await ethers.getSigner(account);
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
