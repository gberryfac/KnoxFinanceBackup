import { ethers, network } from "hardhat";
import { BigNumber } from "ethers";
const { parseUnits } = ethers.utils;

import {
  IAsset,
  IVault,
  Queue__factory,
  QueueProxy__factory,
  Pricer__factory,
} from "../types";

import * as assets from "./utils/assets";
import * as types from "./utils/types";
import * as accounts from "./utils/accounts";

import { describeBehaviorOfAdmin } from "../spec/Admin.behavior";
import { describeBehaviorOfBase } from "../spec/Base.behavior";

import { VaultUtil } from "./utils/VaultUtil";

import { ADDRESS_ONE, PREMIA_VOLATILITY_SURFACE_ORACLE } from "../constants";

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
    maxTVL: parseUnits("5000000", assets.DAI.decimals),
    minimumSupply: BigNumber.from("10").pow("3").toString(),
    minimumContractSize: BigNumber.from("10").pow("17").toString(),
    performanceFee: BigNumber.from("20000000"),
    withdrawalFee: BigNumber.from("2000000"),
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
    maxTVL: parseUnits("1000", assets.ETH.decimals),
    minimumSupply: BigNumber.from("10").pow("10").toString(),
    minimumContractSize: BigNumber.from("10").pow("17").toString(),
    performanceFee: BigNumber.from("20000000"),
    withdrawalFee: BigNumber.from("2000000"),
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
    maxTVL: parseUnits("100", assets.BTC.decimals),
    minimumSupply: BigNumber.from("10").pow("3").toString(),
    minimumContractSize: BigNumber.from("10").pow("7").toString(),
    performanceFee: BigNumber.from("20000000"),
    withdrawalFee: BigNumber.from("2000000"),
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
    maxTVL: parseUnits("100000", assets.LINK.decimals),
    minimumSupply: BigNumber.from("10").pow("10").toString(),
    minimumContractSize: BigNumber.from("10").pow("17").toString(),
    performanceFee: BigNumber.from("30000000"),
    withdrawalFee: BigNumber.from("1000000"),
    isCall: true,
  });
});

const chainId = network.config.chainId;

function behavesLikeVault(params: types.Params) {
  describe.only(params.name, () => {
    let snapshotId: number;

    let signers: types.Signers;
    let addresses: types.Addresses;

    let asset: IAsset;

    let instance: IVault;
    let v: VaultUtil;

    before(async function () {
      signers = await accounts.getSigners();
      addresses = await accounts.getAddresses(signers);

      [signers, addresses, asset] = await accounts.impersonateWhale(
        params.asset.buyer,
        params.asset.address,
        params.depositAmount,
        signers,
        addresses
      );

      addresses.pool = params.pool.address;

      v = await VaultUtil.deploy(asset, params, signers, addresses);

      let queue = await new Queue__factory(signers.deployer).deploy(
        params.isCall,
        addresses.pool,
        addresses.vault
      );

      let queueProxy = await new QueueProxy__factory(signers.deployer).deploy(
        params.maxTVL,
        instance.address,
        addresses.vault
      );

      queue = Queue__factory.connect(queueProxy.address, signers.lp1);

      let pricer = await new Pricer__factory(signers.deployer).deploy(
        addresses.pool,
        PREMIA_VOLATILITY_SURFACE_ORACLE[chainId]
      );

      addresses.queue = queue.address;
      addresses.auction = ADDRESS_ONE;
      addresses.pricer = pricer.address;

      const initImpl = {
        auction: addresses.auction,
        queue: addresses.queue,
        pricer: addresses.pricer,
      };

      await v.vault.connect(signers.deployer).initialize(initImpl);
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

    describeBehaviorOfBase({
      deploy: async () => instance,
      getVaultUtil: async () => v,
      getAsset: async () => asset,
      mintERC20: undefined as any,
      burnERC20: undefined as any,
      mintAsset: undefined as any,
      supply: ethers.constants.Zero,
    });
  });
}
