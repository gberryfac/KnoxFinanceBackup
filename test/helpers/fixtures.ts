import { ethers, network } from "hardhat";
import { BigNumber, Contract } from "ethers";

const { getContractAt, getContractFactory } = ethers;
const { parseUnits, parseEther } = ethers.utils;

import * as utils from "./utils";
import * as types from "./types";

import { WETH_ADDRESS } from "../../constants";

const chainId = network.config.chainId;

export async function getSigners(): Promise<types.Signers> {
  const [
    adminSigner,
    userSigner,
    user2Signer,
    ownerSigner,
    keeperSigner,
    feeRecipientSigner,
  ] = await ethers.getSigners();

  const signers = {
    admin: adminSigner,
    user: userSigner,
    user2: user2Signer,
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
    owner: signers.owner.address,
    keeper: signers.keeper.address,
    feeRecipient: signers.feeRecipient.address,
  };

  return addresses;
}

export async function impersonateWhale(
  whale: string,
  depositAsset: string,
  depositAssetDecimals: number,
  signers: types.Signers,
  addresses: types.Addresses
): Promise<[types.Signers, types.Addresses, Contract]> {
  addresses["whale"] = whale;

  const whaleSigner = await utils.impersonateWhale(addresses.whale, "1500");
  signers["whale"] = whaleSigner;

  const assetContract = await getContractAt("IAsset", depositAsset);

  if (depositAsset === WETH_ADDRESS[chainId]) {
    await assetContract
      .connect(signers.whale)
      .deposit({ value: parseEther("700") });

    await assetContract
      .connect(signers.whale)
      .transfer(addresses.admin, parseEther("100"));
    await assetContract
      .connect(signers.whale)
      .transfer(addresses.user, parseEther("200"));
    await assetContract
      .connect(signers.whale)
      .transfer(addresses.user2, parseEther("200"));
  } else {
    await assetContract
      .connect(signers.whale)
      .transfer(addresses.admin, parseUnits("1000000", depositAssetDecimals));
    await assetContract
      .connect(signers.whale)
      .transfer(addresses.user, parseUnits("1000000", depositAssetDecimals));
    await assetContract
      .connect(signers.whale)
      .transfer(addresses.user2, parseUnits("1000000", depositAssetDecimals));
  }

  return [signers, addresses, assetContract];
}

export async function getVaultFixture(
  tokenName: string,
  tokenSymbol: string,
  tokenDecimals: number,
  depositAsset: string,
  depositAssetDecimals: number,
  underlyingAssetDecimals: number,
  cap: BigNumber,
  minimumSupply: string,
  minimumContractSize: string,
  managementFee: BigNumber,
  performanceFee: BigNumber,
  isCall: boolean,
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
    [
      isCall,
      tokenDecimals,
      depositAssetDecimals,
      underlyingAssetDecimals,
      minimumSupply,
      minimumContractSize,
      cap,
      depositAsset,
    ],
  ];

  const vaultContract = (
    await utils.deployProxy(
      "Vault",
      signers.admin,
      initializeArgs,
      [WETH_ADDRESS[chainId], addresses.registry],
      {
        libraries: {
          CommonLogic: addresses.commonLogic,
          VaultDisplay: addresses.vaultDisplay,
          VaultLifecycle: addresses.vaultLifecycle,
          VaultLogic: addresses.vaultLogic,
        },
      }
    )
  ).connect(signers.user);

  return vaultContract;
}
