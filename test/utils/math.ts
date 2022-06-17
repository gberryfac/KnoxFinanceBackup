import { BigNumber, ethers } from "ethers";
const { parseEther } = ethers.utils;

export const wdiv = (x: BigNumber, y: BigNumber) => {
  return x
    .mul(parseEther("1"))
    .add(y.div(BigNumber.from("2")))
    .div(y);
};

export const wmul = (x: BigNumber, y: BigNumber) => {
  return x
    .mul(y)
    .add(parseEther("1").div(BigNumber.from("2")))
    .div(parseEther("1"));
};
