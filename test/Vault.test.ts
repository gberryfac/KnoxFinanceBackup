import { ethers } from "hardhat";
const { parseUnits } = ethers.utils;

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
    minSize: parseUnits("1", assets.DAI.decimals - 1),
    reserveRate64x64: 0.001,
    performanceFee64x64: 0.2,
    withdrawalFee64x64: 0.02,
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
    minSize: parseUnits("1", assets.ETH.decimals - 1),
    reserveRate64x64: 0.001,
    performanceFee64x64: 0.2,
    withdrawalFee64x64: 0.02,
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

    before(async () => {
      signers = await accounts.getSigners();
      addresses = await accounts.getAddresses(signers);

      knoxUtil = await KnoxUtil.deploy(params, signers, addresses);
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
