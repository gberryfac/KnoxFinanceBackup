import { ethers, network } from "hardhat";
import { BigNumber, Contract } from "ethers";

const { getContractAt } = ethers;
const { parseEther } = ethers.utils;

import * as utils from "./utils";
import * as types from "./types";

import { WETH_ADDRESS, SLOTS } from "../../constants";

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
    user: userSigner,
    user2: user2Signer,
    user3: user3Signer,
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
    user: signers.user.address,
    user2: signers.user2.address,
    user3: signers.user3.address,
    owner: signers.owner.address,
    keeper: signers.keeper.address,
    feeRecipient: signers.feeRecipient.address,
  };

  return addresses;
}

export async function impersonateWhale(
  whale: string,
  depositAsset: string,
  depositAmount: BigNumber,
  signers: types.Signers,
  addresses: types.Addresses
): Promise<[types.Signers, types.Addresses, Contract]> {
  addresses.whale = whale;

  const whaleSigner = await utils.impersonateWhale(addresses.whale, "1500");
  signers.whale = whaleSigner;

  const assetContract = await getContractAt("IAsset", depositAsset);

  await utils.setERC20Balance(
    depositAsset,
    addresses.whale,
    depositAmount.mul(100).toHexString(),
    SLOTS[depositAsset]
  );

  if (depositAsset === WETH_ADDRESS[chainId]) {
    await assetContract
      .connect(signers.whale)
      .deposit({ value: parseEther("700") });

    await assetContract
      .connect(signers.whale)
      .transfer(addresses.admin, depositAmount.mul(10));
    await assetContract
      .connect(signers.whale)
      .transfer(addresses.user, depositAmount.mul(10));
    await assetContract
      .connect(signers.whale)
      .transfer(addresses.user2, depositAmount.mul(10));
  } else {
    await assetContract
      .connect(signers.whale)
      .transfer(addresses.admin, depositAmount.mul(10));
    await assetContract
      .connect(signers.whale)
      .transfer(addresses.user, depositAmount.mul(10));
    await assetContract
      .connect(signers.whale)
      .transfer(addresses.user2, depositAmount.mul(10));
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
  ).connect(signers.user);

  return vaultContract;
}
