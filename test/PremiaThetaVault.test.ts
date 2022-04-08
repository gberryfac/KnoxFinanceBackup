import { ethers, network } from "hardhat";
import { BigNumber, Contract } from "ethers";

const { getContractAt, getContractFactory, provider } = ethers;
const { parseEther, parseUnits } = ethers.utils;

import { expect } from "chai";
import { fixedFromFloat } from "@premia/utils";

import * as time from "./helpers/time";
import * as fixtures from "./helpers/fixtures";
import * as types from "./helpers/types";

import { assert } from "./helpers/assertions";

import {
  BYTES_ZERO,
  TEST_URI,
  WHALE_ADDRESS,
  WETH_DAI_POOL,
  BLOCK_NUMBER,
  WETH_ADDRESS,
  WETH_DECIMALS,
  DAI_ADDRESS,
  DAI_DECIMALS,
} from "../constants";

import { MockRegistry__factory } from "../types";

const chainId = network.config.chainId;
const gasPrice = parseUnits("100", "gwei");

const LONG_TOKEN_ID = 8;

let block;

describe("PremiaThetaVault", () => {
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
  let mockPremiaPool: Contract;
  let assetContract: Contract;
  let vaultDisplayLibrary: Contract;
  let vaultLifecycleLibrary: Contract;
  let vaultLogicLibrary: Contract;
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

      assetContract = await getContractAt("IAsset", depositAsset);

      let mockPremiaPoolFactory = await getContractFactory("MockPremiaPool");

      mockPremiaPool = await mockPremiaPoolFactory.deploy(
        depositAssetDecimals,
        baseAssetDecimals,
        depositAsset
      );

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

      [vaultContract, knoxTokenContract] = await fixtures.getThetaVaultFixture(
        mockPremiaPool,
        vaultDisplayLibrary,
        vaultLifecycleLibrary,
        vaultLogicLibrary,
        mockRegistry,
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

      it("buyer has correct token balance", async function () {
        const strike = 2500;
        const size = parseUnits("15", depositAssetDecimals);

        const liquidity = isCall ? size : size.mul(strike);

        // Transfers enough liquidity in vault for transaction
        await assetContract
          .connect(signers.admin)
          .transfer(vaultContract.address, liquidity);

        let vaultState = await vaultContract.vaultState();
        let expiry = vaultState.expiry;

        const maturity = expiry;
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

        const userWrappedTokenBalance = await knoxTokenContract.balanceOf(
          addresses.user,
          LONG_TOKEN_ID
        );

        assert.bnEqual(userWrappedTokenBalance, size);
      });

      it("tokenId's are correct", async function () {
        let vaultState = await vaultContract.vaultState();
        let round = vaultState.round;

        let payout = await vaultContract.payouts(round);
        assert.bnEqual(payout.longTokenId, BigNumber.from("0"));

        const strike = 2500;
        let size = parseUnits("15", depositAssetDecimals);

        let liquidity = isCall ? size : size.mul(strike);
        liquidity = liquidity.mul(2);

        // transfers enough liquidity in vault for transaction
        await assetContract
          .connect(signers.admin)
          .transfer(vaultContract.address, liquidity);

        vaultState = await vaultContract.vaultState();
        let expiry = vaultState.expiry;

        const maturity = expiry;
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

        vaultState = await vaultContract.vaultState();
        round = vaultState.round;

        payout = await vaultContract.payouts(round);
        assert.bnEqual(payout.longTokenId, BigNumber.from(LONG_TOKEN_ID));

        await vaultContract.purchase(
          BYTES_ZERO,
          0,
          maturity,
          strike64x64,
          0,
          size,
          isCall
        );

        // current token id should not change
        payout = await vaultContract.payouts(round);
        assert.bnEqual(payout.longTokenId, BigNumber.from(LONG_TOKEN_ID));

        await mockPremiaPool.processExpired(
          vaultContract.address,
          liquidity,
          0,
          isCall
        );

        vaultState = await vaultContract.vaultState();
        expiry = vaultState.expiry;

        await time.increaseTo(expiry);

        await vaultContract.connect(signers.keeper).harvest();

        vaultState = await vaultContract.vaultState();
        round = vaultState.round;

        await mockPremiaPool.setRound(round);

        payout = await vaultContract.payouts(round);
        assert.bnEqual(payout.longTokenId, BigNumber.from("0"));

        await vaultContract.purchase(
          BYTES_ZERO,
          0,
          maturity,
          strike64x64,
          0,
          size,
          isCall
        );

        // current token id should be different from last round
        payout = await vaultContract.payouts(round);
        assert.bnEqual(
          payout.longTokenId,
          BigNumber.from(LONG_TOKEN_ID + round)
        );
      });

      it("vault balances are correct", async function () {
        let vaultState = await vaultContract.vaultState();
        let balance = await assetContract.balanceOf(vaultContract.address);
        let lockedCollateral = vaultState.lockedCollateral;
        let queuedDeposits = vaultState.queuedDeposits;
        let queuedPayouts = vaultState.queuedPayouts;
        let queuedWithdrawShares = vaultState.queuedWithdrawShares;
        let queuedWithdrawals = vaultState.queuedWithdrawals;

        assert.bnEqual(balance, BigNumber.from("0"));
        assert.bnEqual(lockedCollateral, BigNumber.from("0"));
        assert.bnEqual(queuedDeposits, BigNumber.from("0"));
        assert.bnEqual(queuedPayouts, BigNumber.from("0"));
        assert.bnEqual(queuedWithdrawShares, BigNumber.from("0"));
        assert.bnEqual(queuedWithdrawals, BigNumber.from("0"));

        const strike = 2500;
        let size = parseUnits("15", depositAssetDecimals);

        let liquidity = isCall ? size : size.mul(strike);

        // transfers enough liquidity in vault for transaction
        await assetContract
          .connect(signers.admin)
          .transfer(vaultContract.address, liquidity);

        vaultState = await vaultContract.vaultState();
        let expiry = vaultState.expiry;

        const maturity = expiry;
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

        vaultState = await vaultContract.vaultState();
        balance = await assetContract.balanceOf(vaultContract.address);
        lockedCollateral = vaultState.lockedCollateral;
        queuedDeposits = vaultState.queuedDeposits;
        queuedPayouts = vaultState.queuedPayouts;
        queuedWithdrawShares = vaultState.queuedWithdrawShares;
        queuedWithdrawals = vaultState.queuedWithdrawals;

        assert.bnEqual(balance, BigNumber.from("0"));
        assert.bnEqual(lockedCollateral, BigNumber.from(liquidity));
        assert.bnEqual(queuedDeposits, BigNumber.from("0"));
        assert.bnEqual(queuedPayouts, BigNumber.from("0"));
        assert.bnEqual(queuedWithdrawShares, BigNumber.from("0"));
        assert.bnEqual(queuedWithdrawals, BigNumber.from("0"));
      });
    });

    describe("#closePosition", () => {
      let strike = 2500;
      let size = parseUnits("15", depositAssetDecimals);
      let liquidity = isCall ? size : size.mul(strike);
      let strike64x64 = fixedFromFloat(strike);

      let bnSpot = BigNumber.from(isCall ? 3000 : 2000);
      let bnStrike = BigNumber.from(strike);

      // this is the amount of funds sent back to the vault as "free liquidity"
      let longHolderBalance = isCall
        ? bnSpot.sub(bnStrike).mul(size).div(bnSpot)
        : bnStrike.sub(bnSpot).mul(size);

      // this is the amount of funds sent back to the vault as "queued payouts" designated for option buyers
      let shortHolderBalance = liquidity.sub(longHolderBalance);

      time.revertToSnapshotAfterEach(async function () {
        let vaultState = await vaultContract.vaultState();
        let expiry = vaultState.expiry;

        await assetContract
          .connect(signers.admin)
          .transfer(vaultContract.address, liquidity);

        await vaultContract.purchase(
          BYTES_ZERO,
          0,
          expiry,
          strike64x64,
          0,
          size,
          isCall
        );
      });

      it("reverts if payout amount is 0", async function () {
        let vaultState = await vaultContract.vaultState();
        let round = vaultState.round - 1;

        let payout = await vaultContract.payouts(round);

        assert.isTrue(payout.amount.isZero());

        let tx = vaultContract.closePosition(
          addresses.user,
          LONG_TOKEN_ID,
          parseEther("1")
        );

        await expect(tx).to.be.revertedWith("23");
      });

      it("reverts if amount exceeds payout amount", async function () {
        await mockPremiaPool.processExpired(
          vaultContract.address,
          shortHolderBalance,
          longHolderBalance,
          isCall
        );

        let vaultState = await vaultContract.vaultState();
        let expiry = vaultState.expiry;

        await time.increaseTo(expiry);
        await vaultContract.connect(signers.keeper).harvest();

        vaultState = await vaultContract.vaultState();
        let round = vaultState.round - 1;

        let payout = await vaultContract.payouts(round);

        assert.isFalse(payout.amount.isZero());

        const balance = await knoxTokenContract.balanceOf(
          addresses.user,
          LONG_TOKEN_ID
        );

        let tx = vaultContract.closePosition(
          addresses.user,
          LONG_TOKEN_ID,
          balance.add(parseUnits("10", "wei"))
        );

        await expect(tx).to.be.revertedWith("2");
      });

      it("reverts if shares exceed users balance", async function () {
        await assetContract
          .connect(signers.admin)
          .transfer(vaultContract.address, liquidity);

        let vaultState = await vaultContract.vaultState();
        let expiry = vaultState.expiry;

        await vaultContract
          .connect(signers.user2)
          .purchase(BYTES_ZERO, 0, expiry, strike64x64, 0, size, isCall);

        await mockPremiaPool.processExpired(
          vaultContract.address,
          shortHolderBalance.mul(2),
          longHolderBalance.mul(2),
          isCall
        );

        vaultState = await vaultContract.vaultState();
        expiry = vaultState.expiry;

        await time.increaseTo(expiry);
        await vaultContract.connect(signers.keeper).harvest();

        vaultState = await vaultContract.vaultState();
        let round = vaultState.round - 1;

        let payout = await vaultContract.payouts(round);

        assert.isFalse(payout.amount.isZero());

        const balance = await knoxTokenContract.balanceOf(
          addresses.user,
          LONG_TOKEN_ID
        );

        let tx = vaultContract.closePosition(
          addresses.user,
          LONG_TOKEN_ID,
          balance.add(parseUnits("10", "wei"))
        );

        await expect(tx).to.be.revertedWith(
          "ERC1155: burn amount exceeds balance"
        );
      });

      it("buyer withdraws correct payout amount", async function () {
        await mockPremiaPool.processExpired(
          vaultContract.address,
          shortHolderBalance,
          longHolderBalance,
          isCall
        );

        let vaultState = await vaultContract.vaultState();
        let expiry = vaultState.expiry;

        await time.increaseTo(expiry);
        await vaultContract.connect(signers.keeper).harvest();

        const userWrappedTokenBalanceBefore = await knoxTokenContract.balanceOf(
          addresses.user,
          LONG_TOKEN_ID
        );

        const balanceBefore =
          depositAsset === WETH_ADDRESS[chainId]
            ? await signers.user.getBalance()
            : await assetContract.balanceOf(addresses.user);

        // Withdraw entire balance
        const tx = await vaultContract.closePosition(
          addresses.user,
          LONG_TOKEN_ID,
          userWrappedTokenBalanceBefore,
          { gasPrice }
        );

        const receipt = await tx.wait();
        const gasFee = receipt.gasUsed.mul(gasPrice);

        const userWrappedTokenBalanceAfter = await knoxTokenContract.balanceOf(
          addresses.user,
          LONG_TOKEN_ID
        );

        const balanceAfter =
          depositAsset === WETH_ADDRESS[chainId]
            ? await signers.user.getBalance()
            : await assetContract.balanceOf(addresses.user);

        const amountClaimed =
          depositAsset === WETH_ADDRESS[chainId]
            ? balanceAfter.sub(balanceBefore).add(gasFee) // uses call.value to send ETH
            : balanceAfter.sub(balanceBefore);

        assert.isTrue(userWrappedTokenBalanceAfter.isZero());

        // Acceptable precision error is +/- 10 Wei
        assert.bnLte(
          longHolderBalance,
          amountClaimed.add(parseUnits("10", "wei"))
        );
        assert.bnGte(
          longHolderBalance,
          amountClaimed.sub(parseUnits("10", "wei"))
        );
      });

      it("buyer withdraws correct share of payout", async function () {
        let size2 = parseUnits("5", depositAssetDecimals);
        let liquidity2 = isCall ? size2 : size2.mul(strike);

        await assetContract
          .connect(signers.admin)
          .transfer(vaultContract.address, liquidity2);

        let vaultState = await vaultContract.vaultState();
        let expiry = vaultState.expiry;

        await vaultContract
          .connect(signers.user2)
          .purchase(BYTES_ZERO, 0, expiry, strike64x64, 0, size2, isCall);

        let user2LongHolderBalance = isCall
          ? bnSpot.sub(bnStrike).mul(size2).div(bnSpot)
          : bnStrike.sub(bnSpot).mul(size2);

        let user2ShortHolderBalance = liquidity2.sub(user2LongHolderBalance);

        let userLongHolderBalance = longHolderBalance;
        let userShortHolderBalance = shortHolderBalance;

        await mockPremiaPool.processExpired(
          vaultContract.address,
          userShortHolderBalance.add(user2ShortHolderBalance),
          userLongHolderBalance.add(user2LongHolderBalance),
          isCall
        );

        await time.increaseTo(expiry);

        await vaultContract.connect(signers.keeper).harvest();

        const userBalanceBefore =
          depositAsset === WETH_ADDRESS[chainId]
            ? await signers.user.getBalance()
            : await assetContract.balanceOf(addresses.user);

        const user2BalanceBefore =
          depositAsset === WETH_ADDRESS[chainId]
            ? await signers.user2.getBalance()
            : await assetContract.balanceOf(addresses.user2);

        const userWrappedTokenBalance = await knoxTokenContract.balanceOf(
          addresses.user,
          LONG_TOKEN_ID
        );

        const user2WrappedTokenBalance = await knoxTokenContract.balanceOf(
          addresses.user2,
          LONG_TOKEN_ID
        );

        // Withdraw entire balance
        let tx1 = await vaultContract.closePosition(
          addresses.user,
          LONG_TOKEN_ID,
          userWrappedTokenBalance,
          { gasPrice }
        );

        const receipt1 = await tx1.wait();
        const gasFee1 = receipt1.gasUsed.mul(gasPrice);

        let tx2 = await vaultContract
          .connect(signers.user2)
          .closePosition(
            addresses.user2,
            LONG_TOKEN_ID,
            user2WrappedTokenBalance,
            {
              gasPrice,
            }
          );

        const receipt2 = await tx2.wait();
        const gasFee2 = receipt2.gasUsed.mul(gasPrice);

        assert.isTrue(
          await (
            await knoxTokenContract.balanceOf(addresses.user, LONG_TOKEN_ID)
          ).isZero()
        );

        assert.isTrue(
          await (
            await knoxTokenContract.balanceOf(addresses.user2, LONG_TOKEN_ID)
          ).isZero()
        );

        const userBalanceAfter =
          depositAsset === WETH_ADDRESS[chainId]
            ? await signers.user.getBalance()
            : await assetContract.balanceOf(addresses.user);

        const userAmountClaimed =
          depositAsset === WETH_ADDRESS[chainId]
            ? userBalanceAfter.sub(userBalanceBefore).add(gasFee1) // uses call.value to send ETH
            : userBalanceAfter.sub(userBalanceBefore);

        // Acceptable precision error is +/- 10 Wei
        assert.bnLte(
          userLongHolderBalance,
          userAmountClaimed.add(parseUnits("10", "wei"))
        );
        assert.bnGte(
          userLongHolderBalance,
          userAmountClaimed.sub(parseUnits("10", "wei"))
        );

        const user2BalanceAfter =
          depositAsset === WETH_ADDRESS[chainId]
            ? await signers.user2.getBalance()
            : await assetContract.balanceOf(addresses.user2);

        const user2AmountClaimed =
          depositAsset === WETH_ADDRESS[chainId]
            ? user2BalanceAfter.sub(user2BalanceBefore).add(gasFee2) // uses call.value to send ETH
            : user2BalanceAfter.sub(user2BalanceBefore);

        // Acceptable precision error is +/- 10 Wei
        assert.bnLte(
          user2LongHolderBalance,
          user2AmountClaimed.add(parseUnits("10", "wei"))
        );
        assert.bnGte(
          user2LongHolderBalance,
          user2AmountClaimed.sub(parseUnits("10", "wei"))
        );
      });
    });

    describe("#harvest", () => {
      let strike = 2500;
      let size = parseUnits("15", depositAssetDecimals);
      let liquidity = isCall ? size : size.mul(strike);
      let strike64x64 = fixedFromFloat(strike);

      time.revertToSnapshotAfterEach(async function () {
        let vaultState = await vaultContract.vaultState();
        let expiry = vaultState.expiry;

        await assetContract
          .connect(signers.admin)
          .transfer(vaultContract.address, liquidity);

        await vaultContract.purchase(
          BYTES_ZERO,
          0,
          expiry,
          strike64x64,
          0,
          size,
          isCall
        );
      });

      it("should revert when round has not expired", async function () {
        await expect(
          vaultContract.connect(signers.keeper).harvest()
        ).to.be.revertedWith("19");
      });

      it("should adjust vault asset balance when option expires ITM", async function () {
        const bnSpot = BigNumber.from(isCall ? 3000 : 2000);
        const bnStrike = BigNumber.from(strike);

        const longHolderBalance = isCall
          ? bnSpot.sub(bnStrike).mul(size).div(bnSpot)
          : bnStrike.sub(bnSpot).mul(size);

        const shortHolderBalance = liquidity.sub(longHolderBalance);

        await mockPremiaPool.processExpired(
          vaultContract.address,
          shortHolderBalance,
          longHolderBalance,
          isCall
        );

        const balanceBefore = await assetContract.balanceOf(
          vaultContract.address
        );

        let vaultState = await vaultContract.vaultState();
        let expiry = vaultState.expiry;

        await time.increaseTo(expiry);

        await vaultContract.connect(signers.keeper).harvest();

        const balanceAfter = await assetContract.balanceOf(
          vaultContract.address
        );

        assert.bnEqual(balanceAfter, balanceBefore.add(shortHolderBalance));
      });

      it("payout amount and price per share are set correctly for each round", async function () {
        let bnSpot = BigNumber.from(isCall ? 3000 : 2000);
        let bnStrike = BigNumber.from(strike);

        let longHolderBalance = isCall
          ? bnSpot.sub(bnStrike).mul(size).div(bnSpot)
          : bnStrike.sub(bnSpot).mul(size);

        let shortHolderBalance = liquidity.sub(longHolderBalance);

        await mockPremiaPool.processExpired(
          vaultContract.address,
          shortHolderBalance,
          longHolderBalance,
          isCall
        );

        let vaultState = await vaultContract.vaultState();
        let expiry = vaultState.expiry;
        let round = vaultState.round;

        let longTokenId = LONG_TOKEN_ID;

        await time.increaseTo(expiry);

        await vaultContract.connect(signers.keeper).harvest();

        vaultState = await vaultContract.vaultState();
        expiry = vaultState.expiry;
        round = vaultState.round;

        // check payout of last round
        let roundPayout0 = await vaultContract.payouts(round - 1);
        let amount0 = roundPayout0.amount;
        let pricePerShare0 = roundPayout0.pricePerShare;

        assert.bnEqual(amount0, longHolderBalance);
        assert.bnEqual(
          pricePerShare0,
          fixedFromFloat(longHolderBalance).div(
            await knoxTokenContract.totalSupply(longTokenId)
          )
        );

        await mockPremiaPool.setRound(round);

        strike = 3000;
        size = parseUnits("10", depositAssetDecimals);
        liquidity = isCall ? size : size.mul(strike);
        strike64x64 = fixedFromFloat(strike);

        await assetContract
          .connect(signers.admin)
          .transfer(vaultContract.address, liquidity);

        await vaultContract.purchase(
          BYTES_ZERO,
          0,
          expiry,
          strike64x64,
          0,
          size,
          isCall
        );

        bnSpot = BigNumber.from(isCall ? 3500 : 2500);
        bnStrike = BigNumber.from(strike);

        longHolderBalance = isCall
          ? bnSpot.sub(bnStrike).mul(size).div(bnSpot)
          : bnStrike.sub(bnSpot).mul(size);

        shortHolderBalance = liquidity.sub(longHolderBalance);

        await mockPremiaPool.processExpired(
          vaultContract.address,
          shortHolderBalance,
          longHolderBalance,
          isCall
        );

        vaultState = await vaultContract.vaultState();
        expiry = vaultState.expiry;
        round = vaultState.round;

        await time.increaseTo(expiry);

        await vaultContract.connect(signers.keeper).harvest();

        let roundPayout1 = await vaultContract.payouts(round);
        let amount1 = roundPayout1.amount;
        let pricePerShare1 = roundPayout1.pricePerShare;

        assert.bnEqual(amount1, longHolderBalance);
        assert.bnEqual(
          pricePerShare1,
          fixedFromFloat(longHolderBalance).div(
            await knoxTokenContract.totalSupply(LONG_TOKEN_ID + round)
          )
        );
      });
    });
  });
}
