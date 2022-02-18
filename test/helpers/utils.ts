import { ethers, artifacts } from "hardhat";

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
