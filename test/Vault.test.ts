import { ethers } from "hardhat";
import { BigNumber } from "ethers";
const { parseUnits } = ethers.utils;

import {
  IVault,
  MockERC20,
  MockPremiaPool,
  MockERC20__factory,
  MockPremiaPool__factory,
  IAsset,
} from "../types";

import * as assets from "./utils/assets";
import * as types from "./utils/types";
import * as accounts from "./utils/accounts";

import { describeBehaviorOfAdmin } from "../spec/Admin.behavior";
import { describeBehaviorOfBase } from "../spec/Base.behavior";
import { describeBehaviorOfQueue } from "../spec/Queue.behavior";

import { VaultUtil } from "./utils/VaultUtil";

import { ADDRESS_ONE } from "../constants";

describe("Vault Unit Tests", () => {
  behavesLikeVault({
    name: `Knox ETH Delta Vault (Put)`,
    tokenName: `Knox ETH Delta Vault`,
    tokenSymbol: `kETH-DELTA-P`,
    tokenDecimals: 18,
    asset: assets.DAI,
    delta: 0.4,
    pool: assets.PREMIA.WETH_DAI,
    depositAmount: parseUnits("100000", assets.DAI.decimals),
    cap: parseUnits("5000000", assets.DAI.decimals),
    minimumSupply: BigNumber.from("10").pow("3").toString(),
    minimumContractSize: BigNumber.from("10").pow("17").toString(),
    managementFee: BigNumber.from("2000000"),
    performanceFee: BigNumber.from("20000000"),
    isCall: false,
  });

  behavesLikeVault({
    name: `Knox ETH Delta Vault (Call)`,
    tokenName: `Knox ETH Delta Vault`,
    tokenSymbol: `kETH-DELTA-C`,
    tokenDecimals: 18,
    asset: assets.ETH,
    delta: 0.4,
    pool: assets.PREMIA.WETH_DAI,
    depositAmount: parseUnits("10", assets.ETH.decimals),
    cap: parseUnits("1000", assets.ETH.decimals),
    minimumSupply: BigNumber.from("10").pow("10").toString(),
    minimumContractSize: BigNumber.from("10").pow("17").toString(),
    managementFee: BigNumber.from("2000000"),
    performanceFee: BigNumber.from("20000000"),
    isCall: true,
  });

  behavesLikeVault({
    name: `Knox BTC Delta Vault (Call)`,
    tokenName: `Knox BTC Delta Vault`,
    tokenSymbol: `kBTC-DELTA-C`,
    tokenDecimals: 18,
    asset: assets.BTC,
    delta: 0.4,
    pool: assets.PREMIA.WBTC_DAI,
    depositAmount: parseUnits("1", assets.BTC.decimals),
    cap: parseUnits("100", assets.BTC.decimals),
    minimumSupply: BigNumber.from("10").pow("3").toString(),
    minimumContractSize: BigNumber.from("10").pow("7").toString(),
    managementFee: BigNumber.from("2000000"),
    performanceFee: BigNumber.from("20000000"),
    isCall: true,
  });

  behavesLikeVault({
    name: `Knox LINK Delta Vault (Call)`,
    tokenName: `Knox LINK Delta Vault`,
    tokenSymbol: `kLINK-DELTA-C`,
    tokenDecimals: 18,
    asset: assets.LINK,
    delta: 0.4,
    pool: assets.PREMIA.LINK_DAI,
    depositAmount: parseUnits("100", assets.LINK.decimals),
    cap: parseUnits("100000", assets.LINK.decimals),
    minimumSupply: BigNumber.from("10").pow("10").toString(),
    minimumContractSize: BigNumber.from("10").pow("17").toString(),
    managementFee: BigNumber.from("1000000"),
    performanceFee: BigNumber.from("30000000"),
    isCall: true,
  });
});

function behavesLikeVault(params: types.Params) {
  let signers: types.Signers;
  let addresses: types.Addresses;

  describe.only(params.name, () => {
    let snapshotId: number;

    let signers: types.Signers;
    let addresses: types.Addresses;

    let assetContract: IAsset;
    let erc20: MockERC20;
    let pool: MockPremiaPool;

    let instance: IVault;
    let v: VaultUtil;

    before(async function () {
      signers = await accounts.getSigners();
      addresses = await accounts.getAddresses(signers);

      [signers, addresses, assetContract] = await accounts.impersonateWhale(
        params.asset.buyer,
        params.asset.address,
        params.depositAmount,
        signers,
        addresses
      );

      erc20 = await new MockERC20__factory(signers.owner).deploy("", 18);

      pool = await new MockPremiaPool__factory(signers.owner).deploy(
        params.pool.underlying.address,
        params.pool.base.address,
        ADDRESS_ONE,
        ADDRESS_ONE
      );

      addresses.pool = pool.address;
      addresses.pricer = ADDRESS_ONE;

      v = await VaultUtil.deploy(assetContract, params, signers, addresses);

      instance = v.vault;
    });

    beforeEach(async () => {
      snapshotId = await ethers.provider.send("evm_snapshot", []);
    });

    afterEach(async () => {
      await ethers.provider.send("evm_revert", [snapshotId]);
    });

    describeBehaviorOfAdmin({
      deploy: async () => instance,
      getVaultUtil: async () => v,
    });

    describeBehaviorOfBase(
      {
        deploy: async () => instance,
        getVaultUtil: async () => v,
        getAsset: async () => erc20,
        mintERC20: undefined as any,
        burnERC20: undefined as any,
        mintAsset: undefined as any,
        supply: ethers.constants.Zero,
      },
      ["::ERC4626Base"]
    );

    describeBehaviorOfQueue(
      {
        deploy: async () => instance,
        getVaultUtil: async () => v,
        interfaceIds: undefined as any,
        transfer: undefined as any,
        mintERC1155: undefined as any,
        burnERC1155: undefined as any,
        tokenId: undefined as any,
      },
      ["::ERC165", "::ERC1155Enumerable"]
    );
  });
}
