import { BigNumber, ethers } from "ethers";
const { formatUnits } = ethers.utils;

export function bnToNumber(bn: BigNumber, decimals = 18) {
  return Number(formatUnits(bn, decimals));
}
