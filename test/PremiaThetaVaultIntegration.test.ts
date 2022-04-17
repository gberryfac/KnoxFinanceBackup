import { ethers, network } from "hardhat";
import { BigNumber, Contract } from "ethers";

const { getContractAt, provider } = ethers;
const { parseUnits } = ethers.utils;

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

import { MockRegistry__factory } from "../types";

const chainId = network.config.chainId;

let block;

describe("PremiaThetaVault Integration", () => {
  behavesLikeRibbonOptionsVault({
    whale: WHALE_ADDRESS[chainId],
    tokenName: `Knox WETH-DAI Call`,
    tokenDecimals: 18,
    pool: WETH_DAI_POOL[chainId],
    depositAsset: WETH_ADDRESS[chainId],
    depositAssetDecimals: WETH_DECIMALS,
    baseAssetDecimals: DAI_DECIMALS,
    underlyingAssetDecimals: WETH_DECIMALS,
    underlyingAsset: WETH_ADDRESS[chainId],
    cap: parseUnits("1000", WETH_DECIMALS),
    minimumSupply: BigNumber.from("10").pow("10").toString(),
    minimumContractSize: BigNumber.from("10").pow("17").toString(),
    managementFee: BigNumber.from("2000000"),
    performanceFee: BigNumber.from("20000000"),
    isCall: true,
  });

  behavesLikeRibbonOptionsVault({
    whale: WHALE_ADDRESS[chainId],
    tokenName: `Knox WETH-DAI Put`,
    tokenDecimals: 18,
    pool: WETH_DAI_POOL[chainId],
    depositAsset: DAI_ADDRESS[chainId],
    depositAssetDecimals: DAI_DECIMALS,
    baseAssetDecimals: DAI_DECIMALS,
    underlyingAssetDecimals: WETH_DECIMALS,
    underlyingAsset: WETH_ADDRESS[chainId],
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
  tokenName: string;
  tokenDecimals: number;
  pool: string;
  depositAsset: string;
  depositAssetDecimals: number;
  baseAssetDecimals: number;
  underlyingAssetDecimals: number;
  underlyingAsset: string;
  cap: BigNumber;
  minimumSupply: string;
  minimumContractSize: string;
  managementFee: BigNumber;
  performanceFee: BigNumber;
  isCall: boolean;
}) {
  let signers: types.Signers;
  let addresses: types.Addresses;
  let knoxTokenAddress: string;

  let whale = params.whale;

  // Parameters
  let pool = params.pool;
  let tokenName = params.tokenName;
  let tokenDecimals = params.tokenDecimals;
  let depositAsset = params.depositAsset;
  let depositAssetDecimals = params.depositAssetDecimals;
  let baseAssetDecimals = params.baseAssetDecimals;
  let underlyingAssetDecimals = params.underlyingAssetDecimals;
  let underlyingAsset = params.underlyingAsset;
  let cap = params.cap;
  let minimumSupply = params.minimumSupply;
  let minimumContractSize = params.minimumContractSize;
  let managementFee = params.managementFee;
  let performanceFee = params.performanceFee;
  let isCall = params.isCall;

  // Contracts
  let vaultContract: Contract;
  let mockRegistry: Contract;
  let poolContract: Contract;
  let assetContract: Contract;
  let keeperContract: Contract;
  let oracleContract: Contract;
  let vaultDisplayLibrary: Contract;
  let vaultLifecycleLibrary: Contract;
  let vaultLogicLibrary: Contract;
  let mockPremiaPool: Contract;
  let knoxTokenContract: Contract;

  describe.only(`${params.tokenName}`, () => {
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

      poolContract = await getContractAt("IPremiaPool", WETH_DAI_POOL[chainId]);

      keeperContract = await (
        await getContractAt("IPremiaKeeper", WETH_DAI_POOL[chainId])
      ).connect(signers.keeper);

      oracleContract = await getContractAt(
        "AggregatorInterface",
        ETH_PRICE_ORACLE[chainId]
      );

      assetContract = await getContractAt("IAsset", depositAsset);

      const VaultDisplay = await ethers.getContractFactory("VaultDisplay");
      vaultDisplayLibrary = await VaultDisplay.deploy();

      const VaultLifecycle = await ethers.getContractFactory("VaultLifecycle");
      vaultLifecycleLibrary = await VaultLifecycle.deploy();

      const VaultLogic = await ethers.getContractFactory("VaultLogic");
      vaultLogicLibrary = await VaultLogic.deploy();

      mockRegistry = await new MockRegistry__factory(signers.admin).deploy(
        true
      );

      [signers, addresses, assetContract] = await fixtures.impersonateWhale(
        whale,
        depositAsset,
        depositAssetDecimals,
        signers,
        addresses
      );

      [vaultContract, knoxTokenContract] = await fixtures.getVaultFixture(
        poolContract,
        vaultDisplayLibrary,
        vaultLifecycleLibrary,
        vaultLogicLibrary,
        mockRegistry,
        "PremiaThetaVault",
        tokenName,
        tokenDecimals,
        depositAsset,
        depositAssetDecimals,
        underlyingAssetDecimals,
        underlyingAsset,
        cap,
        minimumSupply,
        minimumContractSize,
        managementFee,
        performanceFee,
        isCall,
        signers,
        addresses
      );

      knoxTokenAddress = knoxTokenContract.address;
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
          .transfer(vaultContract.address, liquidity);

        const maturity = block.timestamp + EPOCH_SPAN_IN_SECONDS;
        const strike64x64 = fixedFromFloat(strike);

        await vaultContract.purchase(
          BYTES_ZERO,
          0,
          maturity,
          strike64x64,
          0,
          size,
          isCall
        );

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

        const shortTokenBalance = await poolContract.balanceOf(
          vaultContract.address,
          shortTokenId
        );

        const longTokenBalance = await poolContract.balanceOf(
          vaultContract.address,
          longTokenId
        );

        assert.bnEqual(shortTokenBalance, size);
        assert.bnEqual(longTokenBalance, size);
      });
    });

    describe("#rollover", () => {
      time.revertToSnapshotAfterEach(async function () {});

      it("should return no reserved liquidity when option is OTM", async function () {
        // Should expire OTM
        const strike = isCall ? 3000 : 2000;
        const size = parseUnits("15", depositAssetDecimals);

        const liquidity = isCall ? size : size.mul(strike);

        await assetContract
          .connect(signers.admin)
          .transfer(vaultContract.address, liquidity);

        const maturity = block.timestamp + EPOCH_SPAN_IN_SECONDS;
        const strike64x64 = fixedFromFloat(strike);

        await vaultContract.purchase(
          BYTES_ZERO,
          0,
          maturity,
          strike64x64,
          0,
          size,
          isCall
        );

        const balanceBeforeExpiredProcessed = await assetContract.balanceOf(
          vaultContract.address
        );

        const reservedLiquidityBeforeExpired = await poolContract.balanceOf(
          vaultContract.address,
          isCall ? UNDERLYING_RESERVED_LIQ_TOKEN_ID : BASE_RESERVED_LIQ_TOKEN_ID
        );

        assert.bnEqual(balanceBeforeExpiredProcessed, BigNumber.from(0));
        assert.bnEqual(reservedLiquidityBeforeExpired, BigNumber.from(0));

        await time.increaseTo(maturity + 1);

        const longTokenId = formatTokenId({
          tokenType: isCall ? TokenType.LongCall : TokenType.LongPut,
          maturity: BigNumber.from(maturity),
          strike64x64: BigNumber.from(strike64x64),
        });

        // Keeper processes expired tokens
        await keeperContract.processExpired(longTokenId, size);

        const balanceAfterExpiredProcessed = await assetContract.balanceOf(
          vaultContract.address
        );

        const reservedLiquidityAfterExpired = await poolContract.balanceOf(
          vaultContract.address,
          isCall ? UNDERLYING_RESERVED_LIQ_TOKEN_ID : BASE_RESERVED_LIQ_TOKEN_ID
        );

        assert.bnEqual(balanceAfterExpiredProcessed, BigNumber.from(0));
        assert.bnEqual(reservedLiquidityAfterExpired, liquidity);

        await vaultContract.connect(signers.keeper).harvest();

        const balanceAfterHarvest = await assetContract.balanceOf(
          vaultContract.address
        );

        const reservedLiquidityHarvest = await poolContract.balanceOf(
          vaultContract.address,
          isCall ? UNDERLYING_RESERVED_LIQ_TOKEN_ID : BASE_RESERVED_LIQ_TOKEN_ID
        );

        // all collateral locked in Premia should return to Vault
        assert.bnEqual(balanceAfterHarvest, liquidity);
        assert.bnEqual(reservedLiquidityHarvest, BigNumber.from(0));
      });

      it("should withdraw reserved liquidity when option is ITM", async function () {
        // Should expire ITM
        const strike = isCall ? 2000 : 3000;
        const size = parseUnits("15", depositAssetDecimals);

        const liquidity = isCall ? size : size.mul(strike);

        await assetContract
          .connect(signers.admin)
          .transfer(vaultContract.address, liquidity);

        /**
         * Note: The ETH spot is ~$2990 at the time the option is written. Given that this test
         * is done on a forked chain, the oracle's answer does not change before expiry.
         * Therefore, spot price will remain the same.
         */

        const spot = await oracleContract.latestAnswer();

        const maturity = block.timestamp + EPOCH_SPAN_IN_SECONDS;
        const strike64x64 = fixedFromFloat(strike);

        await vaultContract.purchase(
          BYTES_ZERO,
          0,
          maturity,
          strike64x64,
          0,
          size,
          isCall
        );

        const balanceBeforeExpiredProcessed = await assetContract.balanceOf(
          vaultContract.address
        );

        const reservedLiquidityBeforeExpired = await poolContract.balanceOf(
          vaultContract.address,
          isCall ? UNDERLYING_RESERVED_LIQ_TOKEN_ID : BASE_RESERVED_LIQ_TOKEN_ID
        );

        assert.bnEqual(balanceBeforeExpiredProcessed, BigNumber.from(0));
        assert.bnEqual(reservedLiquidityBeforeExpired, BigNumber.from(0));

        await time.increaseTo(maturity + 1);

        const longTokenId = formatTokenId({
          tokenType: isCall ? TokenType.LongCall : TokenType.LongPut,
          maturity: BigNumber.from(maturity),
          strike64x64: BigNumber.from(strike64x64),
        });

        // Keeper processes expired tokens
        await keeperContract.processExpired(longTokenId, size);

        const balanceAfterExpiredProcessed = await assetContract.balanceOf(
          vaultContract.address
        );

        const reservedLiquidityAfterExpired = await poolContract.balanceOf(
          vaultContract.address,
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

        await vaultContract.connect(signers.keeper).harvest();

        const balanceAfterHarvest = await assetContract.balanceOf(
          vaultContract.address
        );

        const reservedLiquidityHarvest = await poolContract.balanceOf(
          vaultContract.address,
          isCall ? UNDERLYING_RESERVED_LIQ_TOKEN_ID : BASE_RESERVED_LIQ_TOKEN_ID
        );

        // all collateral locked in Premia should return to Vault
        assert.bnEqual(
          balanceAfterHarvest,
          bnBalanceAfterExpiredProcessed.add(reservedLiquidityAfterExpired)
        );
        assert.bnEqual(reservedLiquidityHarvest, BigNumber.from(0));
      });
    });
  });
}
