import { ethers, network } from "hardhat";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

const { parseEther } = ethers.utils;

export async function deployProxy(
  logicContractName: string,
  adminSigner: SignerWithAddress,
  initializeArgs: any[], // eslint-disable-line @typescript-eslint/no-explicit-any
  logicDeployParams = [],
  factoryOptions = {}
) {
  const AdminUpgradeabilityProxy = await ethers.getContractFactory(
    "AdminUpgradeabilityProxy",
    adminSigner
  );

  const LogicContract = await ethers.getContractFactory(
    logicContractName,
    factoryOptions || {}
  );

  const logic = await LogicContract.deploy(...logicDeployParams);

  const initBytes = LogicContract.interface.encodeFunctionData(
    "initialize",
    initializeArgs
  );

  const proxy = await AdminUpgradeabilityProxy.deploy(
    logic.address,
    adminSigner.address,
    initBytes
  );

  return await ethers.getContractAt(logicContractName, proxy.address);
}

export async function impersonateWhale(account: string, ethBalance: string) {
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
