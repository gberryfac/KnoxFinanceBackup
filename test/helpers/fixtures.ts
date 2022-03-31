import { ethers, network } from "hardhat";
import { BigNumber, Contract } from "ethers";

const { getContractAt } = ethers;
const { parseUnits, parseEther } = ethers.utils;

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import * as utils from "./utils";

import { TEST_URI, BLOCK_NUMBER, WETH_ADDRESS } from "../../constants";

const chainId = network.config.chainId;

export async function getSignersandAddresses() {
  const [
    adminSigner,
    userSigner,
    ownerSigner,
    keeperSigner,
    feeRecipientSigner,
  ] = await ethers.getSigners();

  const signers = {
    admin: adminSigner,
    user: userSigner,
    owner: ownerSigner,
    keeper: keeperSigner,
    feeRecipient: feeRecipientSigner,
  };

  const addresses = {
    admin: adminSigner.address,
    user: userSigner.address,
    owner: ownerSigner.address,
    keeper: keeperSigner.address,
    feeRecipient: feeRecipientSigner.address,
  };

  return [signers, addresses];
}

export async function impersonateWhale(
  whale: string,
  depositAsset: string,
  depositAssetDecimals: number,
  signers: {
    admin: SignerWithAddress;
    user: SignerWithAddress;
    owner: SignerWithAddress;
    keeper: SignerWithAddress;
    feeRecipient: SignerWithAddress;
    whale: SignerWithAddress;
  },
  addresses: {
    admin: string;
    user: string;
    owner: string;
    keeper: string;
    feeRecipient: string;
    whale: string;
  }
) {
  addresses["whale"] = whale;
  const whaleSigner = await utils.impersonateWhale(addresses.whale, "1000");
  signers["whale"] = whaleSigner;

  const assetContract = await getContractAt("IAsset", depositAsset);

  if (depositAsset === WETH_ADDRESS[chainId]) {
    await assetContract
      .connect(signers.whale)
      .deposit({ value: parseEther("750") });

    await assetContract
      .connect(signers.whale)
      .transfer(addresses.admin, parseEther("300"));
    await assetContract
      .connect(signers.whale)
      .transfer(addresses.user, parseEther("300"));
  } else {
    await assetContract
      .connect(signers.whale)
      .transfer(addresses.admin, parseUnits("10000000", depositAssetDecimals));
    await assetContract
      .connect(signers.whale)
      .transfer(addresses.user, parseUnits("10000000", depositAssetDecimals));
  }

  return [signers, addresses, assetContract];
}

export async function getThetaVaultFixture(
  poolContract: Contract,
  vaultLifecycleLibrary: Contract,
  vaultLogicLibrary: Contract,
  registryContact: Contract,
  tokenName: string,
  tokenDecimals: number,
  depositAsset: string,
  depositAssetDecimals: number,
  underlyingAssetDecimals: number,
  underlyingAsset: string,
  minimumSupply: string,
  minimumContractSize: string,
  managementFee: BigNumber,
  performanceFee: BigNumber,
  isCall: boolean,
  signers: {
    admin: SignerWithAddress;
    user: SignerWithAddress;
    owner: SignerWithAddress;
    keeper: SignerWithAddress;
    feeRecipient: SignerWithAddress;
    whale: SignerWithAddress;
  },
  addresses: {
    admin: string;
    user: string;
    owner: string;
    keeper: string;
    feeRecipient: string;
    whale: string;
  }
) {
  // Reset block
  await network.provider.request({
    method: "hardhat_reset",
    params: [
      {
        forking: {
          jsonRpcUrl: TEST_URI[chainId],
          blockNumber: BLOCK_NUMBER[chainId],
        },
      },
    ],
  });

  const assetContract = await getContractAt("IAsset", depositAsset);

  const initializeArgs = [
    [
      addresses.owner,
      addresses.keeper,
      addresses.feeRecipient,
      managementFee,
      performanceFee,
      tokenName,
    ],
    [
      isCall,
      tokenDecimals,
      depositAssetDecimals,
      assetContract.address,
      underlyingAssetDecimals,
      underlyingAsset,
      minimumSupply,
      minimumContractSize,
      parseUnits("500", tokenDecimals > 18 ? tokenDecimals : 18),
    ],
  ];

  const vaultContract = (
    await utils.deployProxy(
      "ThetaVault",
      signers[0],
      initializeArgs,
      [poolContract.address, WETH_ADDRESS[chainId], registryContact.address],
      {
        libraries: {
          VaultLifecycle: vaultLifecycleLibrary.address,
          VaultLogic: vaultLogicLibrary.address,
        },
      }
    )
  ).connect(signers[4]);

  const knoxTokenContract = (
    await utils.deployProxy(
      "KnoxToken",
      signers[0],
      [tokenName],
      [vaultContract.address],
      {}
    )
  ).connect(signers[4]);

  const knoxTokenAddress = knoxTokenContract.address;

  await vaultContract.connect(signers[1]).setTokenAddress(knoxTokenAddress);
}
