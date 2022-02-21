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
  amountInGwei: string
) {
  await approveVault(vault, baseToken, signer, amountInGwei);
  return await depositToVault(vault, signer, amountInGwei);
}

export async function approveVault(
  vault: Vault,
  baseToken: TestERC20,
  signer: SignerWithAddress,
  amountInGwei: string
) {
  await baseToken
    .connect(signer)
    .approve(vault.address, parseUnits(amountInGwei, "gwei"));
}

export async function depositToVault(
  vault: Vault,
  signer: SignerWithAddress,
  amountInGwei: string
) {
  let tx = await vault
    .connect(signer)
    .deposit(parseUnits(amountInGwei, "gwei"));

  return await tx.wait();
}

export async function withdrawFromVault(
  vault: Vault,
  signer: SignerWithAddress,
  amountInGwei: string
) {
  let tx = await vault
    .connect(signer)
    .withdraw(parseUnits(amountInGwei, "gwei"));

  return await tx.wait();
}
