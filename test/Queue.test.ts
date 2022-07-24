import { ethers } from "hardhat";
import { BigNumber } from "ethers";
const { parseUnits } = ethers.utils;

import { accounts, assets, types, KnoxUtil, formatClaimTokenId } from "./utils";

import { describeBehaviorOfQueue } from "../spec/Queue.behavior";

describe("Queue Tests", () => {
  behavesLikeQueue({
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
    deposit: parseUnits("10000", assets.ETH.decimals),
  });

  behavesLikeQueue({
    name: "Call Options",
    tokenName: `Knox ETH Delta Vault`,
    tokenSymbol: `kETH-DELTA-C`,
    tokenDecimals: 18,
    underlying: assets.ETH,
    base: assets.DAI,
    collateral: assets.ETH,
    delta: 0.4,
    deltaOffset: 0.05,
    maxTVL: parseUnits("100", assets.ETH.decimals),
    minSize: BigNumber.from("10").pow(assets.ETH.decimals - 1),
    reserveRate: 0.001,
    performanceFee: BigNumber.from("20000000"),
    withdrawalFee: BigNumber.from("2000000"),
    isCall: true,
    mint: parseUnits("1000", assets.ETH.decimals),
    deposit: parseUnits("10", assets.ETH.decimals),
  });
});

interface Params extends types.VaultParams {
  mint: BigNumber;
  deposit: BigNumber;
}

function behavesLikeQueue(params: Params) {
  describe.only(params.name, () => {
    // Signers and Addresses
    let addresses: types.Addresses;
    let signers: types.Signers;

    // Contract Utilities
    let knoxUtil: KnoxUtil;

    before(async () => {
      signers = await accounts.getSigners();
      addresses = await accounts.getAddresses(signers);

      knoxUtil = await KnoxUtil.deploy(params, signers, addresses);

      addresses = knoxUtil.addresses;
    });

    describeBehaviorOfQueue(
      {
        getKnoxUtil: async () => knoxUtil,
        getParams: () => params,
        transferERC1155: undefined as any,
        mintERC1155: undefined as any,
        burnERC1155: undefined as any,
        tokenIdERC1155: BigNumber.from(
          formatClaimTokenId({
            address: ethers.constants.AddressZero,
            epoch: BigNumber.from(0),
          })
        ),
      },
      ["::ERC1155Enumerable"]
    );
  });
}
