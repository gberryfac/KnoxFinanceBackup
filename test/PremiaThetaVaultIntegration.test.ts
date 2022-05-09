import { ethers, network } from "hardhat";
import { BigNumber, Contract } from "ethers";

const { getContractAt, getContractFactory, provider } = ethers;
const { parseUnits } = ethers.utils;

import moment from "moment-timezone";
import { fixedFromFloat, formatTokenId, TokenType } from "@premia/utils";

import * as time from "./helpers/time";
import * as fixtures from "./helpers/fixtures";
import * as types from "./helpers/types";

import { assert } from "./helpers/assertions";

import {
  BYTES_ZERO,
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
describe("PremiaThetaVault Integration", () => {
  behavesLikeRibbonOptionsVault({
    whale: WHALE_ADDRESS[chainId],
    name: `Knox ETH Theta Vault (Call)`,
    tokenName: `Knox ETH Theta Vault`,
    tokenSymbol: `kETH-THETA-LP`,
    tokenDecimals: 18,
    pool: WETH_DAI_POOL[chainId],
    asset: WETH_ADDRESS[chainId],
    depositAssetDecimals: WETH_DECIMALS,
    baseAssetDecimals: DAI_DECIMALS,
    underlyingAssetDecimals: WETH_DECIMALS,
    cap: parseUnits("1000", WETH_DECIMALS),
    minimumSupply: BigNumber.from("10").pow("10").toString(),
    minimumContractSize: BigNumber.from("10").pow("17").toString(),
    managementFee: BigNumber.from("2000000"),
    performanceFee: BigNumber.from("20000000"),
    isCall: true,
  });

  behavesLikeRibbonOptionsVault({
    whale: WHALE_ADDRESS[chainId],
    name: `Knox ETH Theta Vault (Put)`,
    tokenName: `Knox ETH Theta Vault`,
    tokenSymbol: `kETH-THETA-LP`,
    tokenDecimals: 18,
    pool: WETH_DAI_POOL[chainId],
    asset: DAI_ADDRESS[chainId],
    depositAssetDecimals: DAI_DECIMALS,
    baseAssetDecimals: DAI_DECIMALS,
    underlyingAssetDecimals: WETH_DECIMALS,
    cap: parseUnits("5000000", DAI_DECIMALS),
    minimumSupply: BigNumber.from("10").pow("3").toString(),
    minimumContractSize: BigNumber.from("10").pow("17").toString(),
    managementFee: BigNumber.from("2000000"),
    performanceFee: BigNumber.from("20000000"),
    isCall: false,
  });
});

function behavesLikeRibbonOptionsVault(params: {
  whale: string;
  name: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimals: number;
  pool: string;
  asset: string;
  depositAssetDecimals: number;
  baseAssetDecimals: number;
  underlyingAssetDecimals: number;
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
  let underlyingAssetDecimals = params.underlyingAssetDecimals;
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
  let vaultLogicLibrary: Contract;
  let vaultContract: Contract;
  let assetContract: Contract;
  let premiaPool: Contract;
  let strategyContract: Contract;

  // TODO: REMOVE VAULT DEPENDENCY, USE MOCK INSTEAD?

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

      vaultLogicLibrary = await getContractFactory("VaultLogic").then(
        (contract) => contract.deploy()
      );

      strategyContract = await getContractFactory(
        "PremiaThetaVault",
        signers.owner
      ).then((contract) =>
        contract.deploy(
          isCall,
          asset,
          addresses.keeper,
          addresses.pool,
          WETH_ADDRESS[chainId]
        )
      );

      addresses["commonLogic"] = commonLogicLibrary.address;
      addresses["vaultDisplay"] = vaultDisplayLibrary.address;
      addresses["vaultLifecycle"] = vaultLifecycleLibrary.address;
      addresses["vaultLogic"] = vaultLogicLibrary.address;
      addresses["strategy"] = strategyContract.address;

      vaultContract = await fixtures.getVaultFixture(
        tokenName,
        tokenSymbol,
        tokenDecimals,
        asset,
        depositAssetDecimals,
        underlyingAssetDecimals,
        cap,
        minimumSupply,
        minimumContractSize,
        managementFee,
        performanceFee,
        isCall,
        signers,
        addresses
      );

      addresses["vault"] = vaultContract.address;

      await strategyContract.setVault(addresses.vault);
      strategyContract = await strategyContract.connect(signers.user);
    });

    after(async () => {
      await time.revertToSnapShot(initSnapshotId);
    });

    describe("#purchase", () => {
      time.revertToSnapshotAfterEach(async function () {});

      it("vault and strategy have correct token balances", async function () {
        const strike = 2500;
        const size = parseUnits("15", depositAssetDecimals);

        const liquidity = isCall ? size : size.mul(strike);

        await assetContract
          .connect(signers.admin)
          .transfer(addresses.vault, liquidity);

        const maturity = block.timestamp + EPOCH_SPAN_IN_SECONDS;
        const strike64x64 = fixedFromFloat(strike);

        await strategyContract.purchase(maturity, strike64x64, 0, size);

        const shortTokenId = formatTokenId({
          tokenType: isCall ? TokenType.ShortCall : TokenType.ShortPut,
          maturity: BigNumber.from(maturity),
          strike64x64: BigNumber.from(strike64x64),
        });

        const longTokenId = formatTokenId({
          tokenType: isCall ? TokenType.LongCall : TokenType.LongPut,
          maturity: BigNumber.from(maturity),
          strike64x64: BigNumber.from(strike64x64),
        });

        const shortTokenBalance = await premiaPool.balanceOf(
          addresses.strategy,
          shortTokenId
        );

        const longTokenBalance = await premiaPool.balanceOf(
          addresses.strategy,
          longTokenId
        );

        assert.bnEqual(shortTokenBalance, size);
        assert.bnEqual(longTokenBalance, size);
      });
    });

    describe("#harvest", () => {
      time.revertToSnapshotAfterEach(async function () {});

      it("should return no reserved liquidity when option is OTM", async function () {
        // Should expire OTM
        const strike = isCall ? 3000 : 2000;
        const size = parseUnits("15", depositAssetDecimals);

        const liquidity = isCall ? size : size.mul(strike);

        await assetContract
          .connect(signers.admin)
          .transfer(addresses.vault, liquidity);

        const maturity = block.timestamp + EPOCH_SPAN_IN_SECONDS;
        const strike64x64 = fixedFromFloat(strike);

        await strategyContract.purchase(maturity, strike64x64, 0, size);

        const balanceBeforeExpiredProcessed = await assetContract.balanceOf(
          addresses.strategy
        );

        const reservedLiquidityTokensBeforeExpired = await premiaPool.balanceOf(
          addresses.strategy,
          isCall ? UNDERLYING_RESERVED_LIQ_TOKEN_ID : BASE_RESERVED_LIQ_TOKEN_ID
        );

        assert.bnEqual(balanceBeforeExpiredProcessed, BigNumber.from(0));
        assert.bnEqual(reservedLiquidityTokensBeforeExpired, BigNumber.from(0));

        await time.increaseTo(maturity + 1);

        const longTokenId = formatTokenId({
          tokenType: isCall ? TokenType.LongCall : TokenType.LongPut,
          maturity: BigNumber.from(maturity),
          strike64x64: BigNumber.from(strike64x64),
        });

        // Keeper processes expired tokens
        await keeperContract.processExpired(longTokenId, size);

        const balanceAfterExpiredProcessed = await assetContract.balanceOf(
          addresses.strategy
        );

        const reservedLiquidityAfterExpired = await premiaPool.balanceOf(
          addresses.strategy,
          isCall ? UNDERLYING_RESERVED_LIQ_TOKEN_ID : BASE_RESERVED_LIQ_TOKEN_ID
        );

        assert.bnEqual(balanceAfterExpiredProcessed, BigNumber.from(0));
        assert.bnEqual(reservedLiquidityAfterExpired, liquidity);

        await strategyContract.connect(signers.keeper).harvest();

        const vaultBalanceAfterHarvest = await assetContract.balanceOf(
          addresses.vault
        );

        const strategyBalanceAfterHarvest = await assetContract.balanceOf(
          addresses.strategy
        );

        const reservedLiquidityTokensAfterExpired = await premiaPool.balanceOf(
          addresses.strategy,
          isCall ? UNDERLYING_RESERVED_LIQ_TOKEN_ID : BASE_RESERVED_LIQ_TOKEN_ID
        );

        // all collateral locked in Premia should return to Vault
        assert.bnEqual(vaultBalanceAfterHarvest, liquidity);
        assert.bnEqual(strategyBalanceAfterHarvest, BigNumber.from(0));
        assert.bnEqual(reservedLiquidityTokensAfterExpired, BigNumber.from(0));
      });

      it("should withdraw reserved liquidity when option is ITM", async function () {
        // Should expire ITM
        const strike = isCall ? 2000 : 3000;
        const size = parseUnits("15", depositAssetDecimals);

        const liquidity = isCall ? size : size.mul(strike);

        await assetContract
          .connect(signers.admin)
          .transfer(addresses.vault, liquidity);

        /**
         * Note: The ETH spot is ~$2990 at the time the option is written. Given that this test
         * is done on a forked chain, the oracle's answer does not change before expiry.
         * Therefore, spot price will remain the same.
         */

        const spot = await oracleContract.latestAnswer();

        const maturity = block.timestamp + EPOCH_SPAN_IN_SECONDS;
        const strike64x64 = fixedFromFloat(strike);

        await strategyContract.purchase(maturity, strike64x64, 0, size);

        const balanceBeforeExpiredProcessed = await assetContract.balanceOf(
          addresses.strategy
        );

        const reservedLiquidityTokensBeforeExpired = await premiaPool.balanceOf(
          addresses.strategy,
          isCall ? UNDERLYING_RESERVED_LIQ_TOKEN_ID : BASE_RESERVED_LIQ_TOKEN_ID
        );

        assert.bnEqual(balanceBeforeExpiredProcessed, BigNumber.from(0));
        assert.bnEqual(reservedLiquidityTokensBeforeExpired, BigNumber.from(0));

        await time.increaseTo(maturity + 1);

        const longTokenId = formatTokenId({
          tokenType: isCall ? TokenType.LongCall : TokenType.LongPut,
          maturity: BigNumber.from(maturity),
          strike64x64: BigNumber.from(strike64x64),
        });

        // Keeper processes expired tokens, short position tokens are sent to the strategy.
        await keeperContract.processExpired(longTokenId, size);

        const balanceAfterExpiredProcessed = await assetContract.balanceOf(
          addresses.strategy
        );

        const reservedLiquidityAfterExpired = await premiaPool.balanceOf(
          addresses.strategy,
          isCall ? UNDERLYING_RESERVED_LIQ_TOKEN_ID : BASE_RESERVED_LIQ_TOKEN_ID
        );

        const bnSpot = BigNumber.from(spot);
        const bnStrike = BigNumber.from(strike * 1e8);

        const exerciseValue = isCall
          ? bnSpot.sub(bnStrike).mul(size).div(bnSpot)
          : bnStrike.sub(bnSpot).mul(size).div(1e8);

        const reservedLiquidity = liquidity.sub(exerciseValue);
        const exerciseValueAndFee = exerciseValue.mul(97).div(100);

        const balanceUpper = exerciseValueAndFee.mul(101).div(100);
        const balanceLower = exerciseValueAndFee.mul(99).div(100);

        const reservedLiquidityUpper = reservedLiquidity.mul(101).div(100);
        const reservedLiquidityLower = reservedLiquidity.mul(99).div(100);

        const bnBalanceAfterExpiredProcessed = BigNumber.from(
          balanceAfterExpiredProcessed
        );

        // Balance should be within 1% of expected value.
        assert.bnLt(bnBalanceAfterExpiredProcessed, balanceUpper);
        assert.bnGt(bnBalanceAfterExpiredProcessed, balanceLower);

        // Reserved Liquidity should be within 1% of expected value.
        assert.bnLt(reservedLiquidityAfterExpired, reservedLiquidityUpper);
        assert.bnGt(reservedLiquidityAfterExpired, reservedLiquidityLower);

        // Keeper calls harvest which moves long position (reserved) liquidity to the vault.
        await strategyContract.connect(signers.keeper).harvest();

        const vaultBalanceAfterHarvest = await assetContract.balanceOf(
          addresses.vault
        );

        const reservedLiquidityAfterHarvest = await premiaPool.balanceOf(
          addresses.strategy,
          isCall ? UNDERLYING_RESERVED_LIQ_TOKEN_ID : BASE_RESERVED_LIQ_TOKEN_ID
        );

        assert.bnEqual(vaultBalanceAfterHarvest, reservedLiquidityAfterExpired);
        assert.bnEqual(reservedLiquidityAfterHarvest, BigNumber.from(0));
      });
    });
  });
}
