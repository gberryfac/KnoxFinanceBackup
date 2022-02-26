import hre, { ethers, artifacts } from "hardhat";
import { Vault } from "./../../types/Vault";
import { TestERC20 } from "./../../types/TestERC20";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

const { parseUnits } = hre.ethers.utils;

export async function parseLog(
  contractName: string,
  log: { topics: string[]; data: string }
) {
  if (typeof contractName !== "string") {
    throw new Error("contractName must be string");
  }
  const abi = (await artifacts.readArtifact(contractName)).abi;
  const iface = new ethers.utils.Interface(abi);
  const event = iface.parseLog(log);
  return event;
}

export async function parseLogs(
  contractName: string,
  logs: { topics: string[]; data: string }[]
) {
  if (typeof contractName !== "string") {
    throw new Error("contractName must be string");
  }
  const abi = (await artifacts.readArtifact(contractName)).abi;
  const iface = new ethers.utils.Interface(abi);
  return logs
    .map((log) => {
      try {
        const event = iface.parseLog(log);
        return event;
      } catch {
        return null;
      }
    })
    .filter((x) => x);
}

export async function approveAndDepositToVault(
  vault: Vault,
  baseToken: TestERC20,
  signer: SignerWithAddress,
  amountInEther: string
) {
  await approveVault(vault, baseToken, signer, amountInEther);
  return await depositToVault(vault, signer, amountInEther);
}

export async function approveVault(
  vault: Vault,
  baseToken: TestERC20,
  signer: SignerWithAddress,
  amountInEther: string
) {
  await baseToken
    .connect(signer)
    .approve(vault.address, parseUnits(amountInEther, "ether"));
}

export async function depositToVault(
  vault: Vault,
  signer: SignerWithAddress,
  amountInEther: string
) {
  let tx = await vault
    .connect(signer)
    .deposit(parseUnits(amountInEther, "ether"));

  return await tx.wait();
}

export async function instantWithdraw(
  vault: Vault,
  signer: SignerWithAddress,
  amountInEther: string
) {
  let tx = await vault
    .connect(signer)
    .instantWithdraw(parseUnits(amountInEther, "ether"));

  return await tx.wait();
}

export async function initiateWithdraw(
  vault: Vault,
  signer: SignerWithAddress,
  amountInEther: string
) {
  let tx = await vault
    .connect(signer)
    .initiateWithdraw(parseUnits(amountInEther, "ether"));

  return await tx.wait();
}

export async function withdrawFromVault(
  vault: Vault,
  signer: SignerWithAddress
) {
  let tx = await vault.connect(signer).withdraw();

  return await tx.wait();
}
