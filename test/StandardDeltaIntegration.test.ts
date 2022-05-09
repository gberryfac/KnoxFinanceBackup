import { ethers, network } from "hardhat";
import { BigNumber, Contract } from "ethers";

const { getContractAt, getContractFactory, provider } = ethers;
const { parseUnits } = ethers.utils;

import { expect } from "chai";
import moment from "moment-timezone";

import * as time from "./helpers/time";
import * as fixtures from "./helpers/fixtures";
import * as types from "./helpers/types";

import { assert } from "./helpers/assertions";

import {
  UNDERLYING_RESERVED_LIQ_TOKEN_ID,
  BASE_RESERVED_LIQ_TOKEN_ID,
  TEST_URI,
  EPOCH_SPAN_IN_SECONDS,
  WHALE_ADDRESS,
  ETH_PRICE_ORACLE,
  WETH_DAI_POOL,
  BLOCK_NUMBER,
  WETH_ADDRESS,
  WETH_DECIMALS,
  DAI_ADDRESS,
  DAI_DECIMALS,
} from "../constants";

const chainId = network.config.chainId;

moment.tz.setDefault("UTC");

let block;
describe("Standard Delta Integration Tests", () => {
  behavesLikeOptionsVault({
    whale: WHALE_ADDRESS[chainId],
    name: `Knox ETH Delta Vault (Call)`,
    tokenName: `Knox ETH Delta Vault`,
    tokenSymbol: `kETH-DELTA-C`,
    tokenDecimals: 18,
    pool: WETH_DAI_POOL[chainId],
    asset: WETH_ADDRESS[chainId],
    depositAssetDecimals: WETH_DECIMALS,
    baseDecimals: DAI_DECIMALS,
    underlyingDecimals: WETH_DECIMALS,
    cap: parseUnits("1000", WETH_DECIMALS),
    minimumSupply: BigNumber.from("10").pow("10").toString(),
    minimumContractSize: BigNumber.from("10").pow("17").toString(),
    managementFee: BigNumber.from("2000000"),
    performanceFee: BigNumber.from("20000000"),
    isCall: true,
  });

  behavesLikeOptionsVault({
    whale: WHALE_ADDRESS[chainId],
    name: `Knox ETH Delta Vault (Put)`,
    tokenName: `Knox ETH Delta Vault`,
    tokenSymbol: `kETH-DELTA-P`,
    tokenDecimals: 18,
    pool: WETH_DAI_POOL[chainId],
    asset: DAI_ADDRESS[chainId],
    depositAssetDecimals: DAI_DECIMALS,
    baseDecimals: DAI_DECIMALS,
    underlyingDecimals: WETH_DECIMALS,
    cap: parseUnits("5000000", DAI_DECIMALS),
    minimumSupply: BigNumber.from("10").pow("3").toString(),
    minimumContractSize: BigNumber.from("10").pow("17").toString(),
    managementFee: BigNumber.from("2000000"),
    performanceFee: BigNumber.from("20000000"),
    isCall: false,
  });
});

function behavesLikeOptionsVault(params: {
  whale: string;
  name: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimals: number;
  pool: string;
  asset: string;
  depositAssetDecimals: number;
  baseDecimals: number;
  underlyingDecimals: number;
  cap: BigNumber;
  minimumSupply: string;
  minimumContractSize: string;
  managementFee: BigNumber;
  performanceFee: BigNumber;
  isCall: boolean;
}) {
  let signers: types.Signers;
  let addresses: types.Addresses;

  let whale = params.whale;

  // Parameters
  let pool = params.pool;
  let tokenName = params.tokenName;
  let tokenSymbol = params.tokenSymbol;
  let tokenDecimals = params.tokenDecimals;
  let asset = params.asset;
  let depositAssetDecimals = params.depositAssetDecimals;
  let baseDecimals = params.baseDecimals;
  let underlyingDecimals = params.underlyingDecimals;
  let cap = params.cap;
  let minimumSupply = params.minimumSupply;
  let minimumContractSize = params.minimumContractSize;
  let managementFee = params.managementFee;
  let performanceFee = params.performanceFee;
  let isCall = params.isCall;

  // Contracts
  let keeperContract: Contract;
  let oracleContract: Contract;
  let commonLogicLibrary: Contract;
  let vaultDisplayLibrary: Contract;
  let vaultLifecycleLibrary: Contract;
  let vaultContract: Contract;
  let assetContract: Contract;
  let premiaPool: Contract;
  let strategyContract: Contract;

  describe.only(`${params.name}`, () => {
    let initSnapshotId: string;

    before(async () => {
      // Reset block
      await network.provider.request({
        method: "hardhat_reset",
        params: [
          {
            forking: {
              jsonRpcUrl: TEST_URI[chainId],
              blockNumber: BLOCK_NUMBER[chainId],
            },
          },
        ],
      });

      initSnapshotId = await time.takeSnapshot();
      block = await provider.getBlock(await provider.getBlockNumber());

      signers = await fixtures.getSigners();
      addresses = await fixtures.getAddresses(signers);

      [signers, addresses, assetContract] = await fixtures.impersonateWhale(
        whale,
        asset,
        depositAssetDecimals,
        signers,
        addresses
      );

      premiaPool = await getContractAt("IPremiaPool", pool);

      addresses["pool"] = pool;

      keeperContract = await (
        await getContractAt("IPremiaKeeper", WETH_DAI_POOL[chainId])
      ).connect(signers.keeper);

      oracleContract = await getContractAt(
        "AggregatorInterface",
        ETH_PRICE_ORACLE[chainId]
      );

      commonLogicLibrary = await getContractFactory("Common").then((contract) =>
        contract.deploy()
      );

      vaultDisplayLibrary = await getContractFactory("VaultDisplay").then(
        (contract) => contract.deploy()
      );

      vaultLifecycleLibrary = await getContractFactory("VaultLifecycle").then(
        (contract) => contract.deploy()
      );

      addresses["commonLogic"] = commonLogicLibrary.address;
      addresses["vaultDisplay"] = vaultDisplayLibrary.address;
      addresses["vaultLifecycle"] = vaultLifecycleLibrary.address;

      strategyContract = await getContractFactory("StandardDelta", {
        signer: signers.owner,
        libraries: {
          Common: addresses.commonLogic,
        },
      }).then((contract) =>
        contract.deploy(
          isCall,
          baseDecimals,
          underlyingDecimals,
          minimumContractSize,
          asset,
          addresses.pool
        )
      );

      addresses["strategy"] = strategyContract.address;

      vaultContract = await fixtures.getVaultFixture(
        tokenName,
        tokenSymbol,
        tokenDecimals,
        asset,
        cap,
        minimumSupply,
        managementFee,
        performanceFee,
        signers,
        addresses
      );

      addresses["vault"] = vaultContract.address;

      await strategyContract.initialize(addresses.keeper, addresses.vault);
      strategyContract = await strategyContract.connect(signers.user);
    });

    after(async () => {
      await time.revertToSnapShot(initSnapshotId);
    });
  });
}
