import { ethers, network } from "hardhat";
import { BigNumber, Contract } from "ethers";

const { getContractAt } = ethers;
const { parseEther } = ethers.utils;

import * as utils from "./utils";
import * as types from "./types";

import { WETH_ADDRESS, SLOTS } from "../../constants";
import { IAsset } from "../../types";

const chainId = network.config.chainId;

export async function getSigners(): Promise<types.Signers> {
  const [
    adminSigner,
    userSigner,
    user2Signer,
    user3Signer,
    ownerSigner,
    keeperSigner,
    feeRecipientSigner,
  ] = await ethers.getSigners();
  const signers = {
    admin: adminSigner,
    lp1: userSigner,
    lp2: user2Signer,
    lp3: user3Signer,
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
    admin: signers.admin.address,
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

  const whaleSigner = await utils.impersonateWhale(addresses.buyer, "1500");
  signers.buyer = whaleSigner;

  const assetContract = await getContractAt("IAsset", depositAsset);

  await utils.setERC20Balance(
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
      .transfer(addresses.admin, depositAmount.mul(10));
    await assetContract
      .connect(signers.buyer)
      .transfer(addresses.lp1, depositAmount.mul(10));
    await assetContract
      .connect(signers.buyer)
      .transfer(addresses.lp2, depositAmount.mul(10));
  } else {
    await assetContract
      .connect(signers.buyer)
      .transfer(addresses.admin, depositAmount.mul(10));
    await assetContract
      .connect(signers.buyer)
      .transfer(addresses.lp1, depositAmount.mul(10));
    await assetContract
      .connect(signers.buyer)
      .transfer(addresses.lp2, depositAmount.mul(10));
  }

  return [signers, addresses, assetContract];
}

export async function getVaultFixture(
  tokenName: string,
  tokenSymbol: string,
  tokenDecimals: number,
  depositAsset: string,
  cap: BigNumber,
  minimumSupply: string,
  managementFee: BigNumber,
  performanceFee: BigNumber,
  signers: types.Signers,
  addresses: types.Addresses
): Promise<Contract> {
  const initializeArgs = [
    [
      addresses.owner,
      addresses.feeRecipient,
      addresses.keeper,
      addresses.strategy,
      managementFee,
      performanceFee,
      tokenName,
      tokenSymbol,
    ],
    [tokenDecimals, minimumSupply, cap, depositAsset],
  ];

  const vaultContract = (
    await utils.deployProxy(
      "Vault",
      signers.admin,
      initializeArgs,
      [WETH_ADDRESS[chainId]],
      {
        libraries: {
          Helpers: addresses.helpers,
          VaultDisplay: addresses.vaultDisplay,
          VaultLifecycle: addresses.vaultLifecycle,
        },
      }
    )
  ).connect(signers.lp1);

  return vaultContract;
}
