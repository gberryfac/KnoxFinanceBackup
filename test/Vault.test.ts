import { ethers } from "hardhat";
import { BigNumber } from "ethers";
const { parseUnits } = ethers.utils;

import { IVault } from "../types";

import { accounts, assets, types, KnoxUtil } from "./utils";

import { describeBehaviorOfVaultAdmin } from "../spec/VaultAdmin.behavior";
import { describeBehaviorOfVaultBase } from "../spec/VaultBase.behavior";
import { describeBehaviorOfVaultView } from "../spec/VaultView.behavior";

describe("Vault Tests", () => {
  behavesLikeVault({
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

  behavesLikeVault({
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

function behavesLikeVault(params: types.VaultParams) {
  describe.only(params.name, () => {
    // Signers and Addresses
    let addresses: types.Addresses;
    let signers: types.Signers;

    // Contract Utilities
    let knoxUtil: KnoxUtil;
    let vault: IVault;

    before(async () => {
      signers = await accounts.getSigners();
      addresses = await accounts.getAddresses(signers);

      knoxUtil = await KnoxUtil.deploy(params, signers, addresses);
      vault = knoxUtil.vaultUtil.vault;
    });

    describeBehaviorOfVaultAdmin({
      getKnoxUtil: async () => knoxUtil,
      getParams: () => params,
    });

    describeBehaviorOfVaultBase(
      {
        getKnoxUtil: async () => knoxUtil,
        getParams: () => params,
        mintERC4626: undefined as any,
        burnERC4626: undefined as any,
        mintAsset: undefined as any,
        supply: ethers.constants.Zero,
      },
      ["::ERC4626Base"]
    );

    describeBehaviorOfVaultView({
      getKnoxUtil: async () => knoxUtil,
      getParams: () => params,
    });
  });
}
