import hre, { ethers, artifacts } from "hardhat";
// import { Vault } from "./../../types/Vault";
import { TestERC20 } from "./../../types/TestERC20";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

const { parseUnits } = hre.ethers.utils;

// export async function approveAndDepositToVault(
//   vault: Vault,
//   baseToken: TestERC20,
//   signer: SignerWithAddress,
//   amountInEther: string
// ) {
//   await approveVault(vault, baseToken, signer, amountInEther);
//   return await depositToVault(vault, signer, amountInEther);
// }

// export async function approveVault(
//   vault: Vault,
//   baseToken: TestERC20,
//   signer: SignerWithAddress,
//   amountInEther: string
// ) {
//   await baseToken
//     .connect(signer)
//     .approve(vault.address, parseUnits(amountInEther, "ether"));
// }

// export async function depositToVault(
//   vault: Vault,
//   signer: SignerWithAddress,
//   amountInEther: string
// ) {
//   let tx = await vault
//     .connect(signer)
//     .deposit(parseUnits(amountInEther, "ether"));

//   return await tx.wait();
// }

// export async function instantWithdraw(
//   vault: Vault,
//   signer: SignerWithAddress,
//   amountInEther: string
// ) {
//   let tx = await vault
//     .connect(signer)
//     .instantWithdraw(parseUnits(amountInEther, "ether"));

//   return await tx.wait();
// }

// export async function initiateWithdraw(
//   vault: Vault,
//   signer: SignerWithAddress,
//   amountInEther: string
// ) {
//   let tx = await vault
//     .connect(signer)
//     .initiateWithdraw(parseUnits(amountInEther, "ether"));

//   return await tx.wait();
// }

// export async function withdrawFromVault(
//   vault: Vault,
//   signer: SignerWithAddress
// ) {
//   let tx = await vault.connect(signer).withdraw();

//   return await tx.wait();
// }

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
    await adminSigner.getAddress(),
    initBytes
  );
  return await ethers.getContractAt(logicContractName, proxy.address);
}
