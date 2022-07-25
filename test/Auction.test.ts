import { ethers } from "hardhat";
import { BigNumber } from "ethers";
const { parseUnits } = ethers.utils;

import moment from "moment-timezone";
moment.tz.setDefault("UTC");

import { accounts, assets, math, types, KnoxUtil } from "./utils";

import { describeBehaviorOfAuction } from "../spec/Auction.behavior";

describe("Auction Tests", () => {
  behavesLikeAuction({
    name: "Put Options",
    tokenName: `Knox ETH Delta Vault`,
    tokenSymbol: `kETH-DELTA-P`,
    tokenDecimals: 18,
    underlying: assets.ETH,
    base: assets.DAI,
    collateral: assets.DAI,
    delta: 0.4,
    deltaOffset: 0.05,
    maxTVL: parseUnits("1000000", assets.DAI.decimals),
    minSize: BigNumber.from("10").pow(assets.DAI.decimals - 1),
    reserveRate: 0.001,
    performanceFee: BigNumber.from("20000000"),
    withdrawalFee: BigNumber.from("2000000"),
    isCall: false,
    mint: parseUnits("1000000", assets.DAI.decimals),
    size: parseUnits("10", assets.ETH.decimals),
    price: { max: 100, min: 10 },
  });

  behavesLikeAuction({
    name: "Call Options",
    tokenName: `Knox ETH Delta Vault`,
    tokenSymbol: `kETH-DELTA-C`,
    tokenDecimals: 18,
    underlying: assets.ETH,
    base: assets.DAI,
    collateral: assets.ETH,
    delta: 0.4,
    deltaOffset: 0.05,
    maxTVL: parseUnits("1000", assets.ETH.decimals),
    minSize: BigNumber.from("10").pow(assets.ETH.decimals - 1),
    reserveRate: 0.001,
    performanceFee: BigNumber.from("20000000"),
    withdrawalFee: BigNumber.from("2000000"),
    isCall: true,
    mint: parseUnits("1000", assets.ETH.decimals),
    size: parseUnits("10", assets.ETH.decimals),
    price: { max: 0.1, min: 0.01 },
  });
});

function behavesLikeAuction(params: types.VaultParams) {
  describe.only(params.name, () => {
    math.setDecimals(params.collateral.decimals);

    // Signers and Addresses
    let addresses: types.Addresses;
    let signers: types.Signers;

    // Contract Utilities
    let knoxUtil: KnoxUtil;

    before(async () => {
      signers = await accounts.getSigners();
      addresses = await accounts.getAddresses(signers);

      knoxUtil = await KnoxUtil.deploy(params, signers, addresses);
    });

    describeBehaviorOfAuction({
      getKnoxUtil: async () => knoxUtil,
      getParams: () => params,
    });
  });
}
