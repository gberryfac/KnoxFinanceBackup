import { ethers, network } from "hardhat";
import { BigNumber, Contract } from "ethers";

const { getContractAt, getContractFactory, provider } = ethers;
const { parseUnits } = ethers.utils;

import { fixedFromFloat } from "@premia/utils";

import { expect } from "chai";
import moment from "moment-timezone";

import * as time from "./helpers/time";
import * as fixtures from "./helpers/fixtures";
import * as types from "./helpers/types";

import { assert } from "./helpers/assertions";

import {
  TEST_URI,
  DAI_WHALE_ADDRESS,
  WBTC_WHALE_ADDRESS,
  LINK_WHALE_ADDRESS,
  WETH_DAI_POOL,
  WBTC_DAI_POOL,
  LINK_DAI_POOL,
  BLOCK_NUMBER,
  WETH_ADDRESS,
  WETH_DECIMALS,
  WBTC_ADDRESS,
  WBTC_DECIMALS,
  LINK_ADDRESS,
  LINK_DECIMALS,
  DAI_ADDRESS,
  DAI_DECIMALS,
  ETH_PRICE_ORACLE,
  BTC_PRICE_ORACLE,
  LINK_PRICE_ORACLE,
  DAI_PRICE_ORACLE,
  PREMIA_VOLATILITY_SURFACE_ORACLE,
} from "../constants";

const chainId = network.config.chainId;

moment.tz.setDefault("UTC");

let block;
describe("Standard Delta Integration Tests", () => {
  behavesLikeOptionsVault({
    whale: DAI_WHALE_ADDRESS[chainId],
    name: `Knox ETH Delta Vault (Put)`,
    tokenName: `Knox ETH Delta Vault`,
    tokenSymbol: `kETH-DELTA-P`,
    tokenDecimals: 18,
    pool: WETH_DAI_POOL[chainId],
    spotOracle: DAI_PRICE_ORACLE[chainId],
    asset: DAI_ADDRESS[chainId],
    depositAssetDecimals: DAI_DECIMALS,
    base: DAI_ADDRESS[chainId],
    underlying: WETH_ADDRESS[chainId],
    baseDecimals: DAI_DECIMALS,
    underlyingDecimals: WETH_DECIMALS,
    depositAmount: parseUnits("1000", DAI_DECIMALS),
    cap: parseUnits("5000000", DAI_DECIMALS),
    minimumSupply: BigNumber.from("10").pow("3").toString(),
    minimumContractSize: BigNumber.from("10").pow("17").toString(),
    managementFee: BigNumber.from("2000000"),
    performanceFee: BigNumber.from("20000000"),
    isCall: false,
  });

  behavesLikeOptionsVault({
    whale: DAI_WHALE_ADDRESS[chainId],
    name: `Knox ETH Delta Vault (Call)`,
    tokenName: `Knox ETH Delta Vault`,
    tokenSymbol: `kETH-DELTA-C`,
    tokenDecimals: 18,
    pool: WETH_DAI_POOL[chainId],
    spotOracle: ETH_PRICE_ORACLE[chainId],
    asset: WETH_ADDRESS[chainId],
    depositAssetDecimals: WETH_DECIMALS,
    base: DAI_ADDRESS[chainId],
    underlying: WETH_ADDRESS[chainId],
    baseDecimals: DAI_DECIMALS,
    underlyingDecimals: WETH_DECIMALS,
    depositAmount: parseUnits("1", WETH_DECIMALS),
    cap: parseUnits("1000", WETH_DECIMALS),
    minimumSupply: BigNumber.from("10").pow("10").toString(),
    minimumContractSize: BigNumber.from("10").pow("17").toString(),
    managementFee: BigNumber.from("2000000"),
    performanceFee: BigNumber.from("20000000"),
    isCall: true,
  });

  behavesLikeOptionsVault({
    whale: WBTC_WHALE_ADDRESS[chainId],
    name: `Knox BTC Delta Vault (Call)`,
    tokenName: `Knox BTC Delta Vault`,
    tokenSymbol: `kBTC-DELTA-C`,
    tokenDecimals: 18,
    pool: WBTC_DAI_POOL[chainId],
    spotOracle: BTC_PRICE_ORACLE[chainId],
    asset: WBTC_ADDRESS[chainId],
    depositAssetDecimals: WBTC_DECIMALS,
    base: DAI_ADDRESS[chainId],
    underlying: WBTC_ADDRESS[chainId],
    baseDecimals: DAI_DECIMALS,
    underlyingDecimals: WBTC_DECIMALS,
    depositAmount: parseUnits("0.1", WBTC_DECIMALS),
    cap: parseUnits("100", WBTC_DECIMALS),
    minimumSupply: BigNumber.from("10").pow("3").toString(),
    minimumContractSize: BigNumber.from("10").pow("7").toString(),
    managementFee: BigNumber.from("2000000"),
    performanceFee: BigNumber.from("20000000"),
    isCall: true,
  });

  behavesLikeOptionsVault({
    whale: LINK_WHALE_ADDRESS[chainId],
    name: `Knox LINK Delta Vault (Call)`,
    tokenName: `Knox LINK Delta Vault`,
    tokenSymbol: `kLINK-DELTA-C`,
    tokenDecimals: 18,
    pool: LINK_DAI_POOL[chainId],
    spotOracle: LINK_PRICE_ORACLE[chainId],
    asset: LINK_ADDRESS[chainId],
    depositAssetDecimals: LINK_DECIMALS,
    base: DAI_ADDRESS[chainId],
    underlying: LINK_ADDRESS[chainId],
    baseDecimals: DAI_DECIMALS,
    underlyingDecimals: LINK_DECIMALS,
    depositAmount: parseUnits("100", LINK_DECIMALS),
    cap: parseUnits("100000", LINK_DECIMALS),
    minimumSupply: BigNumber.from("10").pow("10").toString(),
    minimumContractSize: BigNumber.from("10").pow("17").toString(),
    managementFee: BigNumber.from("1000000"),
    performanceFee: BigNumber.from("30000000"),
    isCall: true,
  });
});

function behavesLikeOptionsVault(params: {
  whale: string;
  name: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimals: number;
  pool: string;
  spotOracle: string;
  asset: string;
  depositAssetDecimals: number;
  base: string;
  underlying: string;
  baseDecimals: number;
  underlyingDecimals: number;
  depositAmount: BigNumber;
  cap: BigNumber;
  minimumSupply: string;
  minimumContractSize: string;
  managementFee: BigNumber;
  performanceFee: BigNumber;
  isCall: boolean;
}) {
  let signers: types.Signers;
  let addresses: types.Addresses;

  // Contracts
  let keeperContract: Contract;
  let oracleContract: Contract;
  let commonLogicLibrary: Contract;
  let vaultDisplayLibrary: Contract;
  let vaultLifecycleLibrary: Contract;
  let vaultContract: Contract;
  let assetContract: Contract;
  let poolContract: Contract;
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
        params.whale,
        params.asset,
        params.depositAmount,
        signers,
        addresses
      );

      addresses.volatilityOracle = PREMIA_VOLATILITY_SURFACE_ORACLE[chainId];
      addresses.pool = params.pool;

      poolContract = await getContractAt("IPremiaPool", addresses.pool);

      oracleContract = await getContractAt(
        "AggregatorInterface",
        params.spotOracle
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

      addresses.commonLogic = commonLogicLibrary.address;
      addresses.vaultDisplay = vaultDisplayLibrary.address;
      addresses.vaultLifecycle = vaultLifecycleLibrary.address;

      strategyContract = await getContractFactory("StandardDelta", {
        signer: signers.owner,
        libraries: {
          Common: addresses.commonLogic,
        },
      }).then((contract) => contract.deploy());

      addresses.strategy = strategyContract.address;

      vaultContract = await fixtures.getVaultFixture(
        params.tokenName,
        params.tokenSymbol,
        params.tokenDecimals,
        params.asset,
        params.cap,
        params.minimumSupply,
        params.managementFee,
        params.performanceFee,
        signers,
        addresses
      );

      addresses.vault = vaultContract.address;

      await strategyContract.initialize(
        params.isCall,
        params.baseDecimals,
        params.underlyingDecimals,
        params.minimumContractSize,
        fixedFromFloat(0.5),
        addresses.keeper,
        addresses.pool,
        addresses.vault,
        addresses.volatilityOracle
      );

      strategyContract = await strategyContract.connect(signers.whale);
    });

    after(async () => {
      await time.revertToSnapShot(initSnapshotId);
    });

    describe("#initialize", () => {
      time.revertToSnapshotAfterEach(async () => {});

      it("should initialize with correct values", async () => {
        // Check Addresses
        assert.equal(await strategyContract.Asset(), params.asset);
        assert.equal(await strategyContract.keeper(), addresses.keeper);
        assert.equal(await strategyContract.Pool(), addresses.pool);
        assert.equal(await strategyContract.Vault(), addresses.vault);

        const { spot, volatility } = await strategyContract.oracles();

        assert.equal(spot, params.spotOracle);
        assert.equal(volatility, PREMIA_VOLATILITY_SURFACE_ORACLE[chainId]);

        // Check Option
        const { isCall, minimumContractSize, expiry, delta64x64, strike64x64 } =
          await strategyContract.option();

        assert.equal(isCall, params.isCall);
        assert.equal(minimumContractSize, params.minimumContractSize);
        assert.bnNotEqual(expiry, BigNumber.from("0"));
        assert.equal(delta64x64, 0x8000000000000000);
        assert.bnNotEqual(strike64x64, BigNumber.from("0"));

        // Check Asset Properties
        const { baseDecimals, underlyingDecimals } =
          await strategyContract.assetProperties();

        assert.equal(baseDecimals, params.baseDecimals);
        assert.equal(underlyingDecimals, params.underlyingDecimals);

        // Check Strategy Properties
        assert.equal(await strategyContract.startOffset(), 7200);
        assert.equal(await strategyContract.endOffset(), 14400);

        const saleWindowStart = await strategyContract.saleWindow(0);
        const saleWindowEnd = await strategyContract.saleWindow(1);

        assert.equal(saleWindowEnd.sub(saleWindowStart), 7200);
      });
    });
  });
}