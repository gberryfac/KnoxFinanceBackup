import { ethers, network } from "hardhat";
import { BigNumber, Contract } from "ethers";

const { getContractAt, getContractFactory, provider } = ethers;
const { parseEther, parseUnits } = ethers.utils;

import { expect } from "chai";
import { fixedFromFloat } from "@premia/utils";

import * as time from "./helpers/time";
import * as utils from "./helpers/utils";
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

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

const chainId = network.config.chainId;
const gasPrice = parseUnits("100", "gwei");

const LONG_TOKEN_ID = 8;

let block;

describe("ThetaVault", () => {
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
  minimumSupply: string;
  minimumContractSize: string;
  managementFee: BigNumber;
  performanceFee: BigNumber;
  isCall: boolean;
}) {
  // Addresses
  let admin: string,
    owner: string,
    keeper: string,
    user: string,
    feeRecipient: string,
    whale = params.whale;

  // Signers
  let adminSigner: SignerWithAddress,
    whaleSigner: SignerWithAddress,
    userSigner: SignerWithAddress,
    ownerSigner: SignerWithAddress,
    keeperSigner: SignerWithAddress,
    feeRecipientSigner: SignerWithAddress;

  // Parameters
  let pool = params.pool;
  let tokenName = params.tokenName;
  let tokenDecimals = params.tokenDecimals;
  let depositAsset = params.depositAsset;
  let depositAssetDecimals = params.depositAssetDecimals;
  let baseAssetDecimals = params.baseAssetDecimals;
  let underlyingAssetDecimals = params.underlyingAssetDecimals;
  let underlyingAsset = params.underlyingAsset;
  let minimumSupply = params.minimumSupply;
  let minimumContractSize = params.minimumContractSize;
  let managementFee = params.managementFee;
  let performanceFee = params.performanceFee;
  let isCall = params.isCall;

  // Contracts
  let vaultLifecycleLib: Contract;
  let vaultLogicLib: Contract;
  let vaultContract: Contract;
  let mockRegistry: Contract;
  let mockPremiaPool: Contract;
  let assetContract: Contract;

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

      [adminSigner, userSigner, ownerSigner, keeperSigner, feeRecipientSigner] =
        await ethers.getSigners();

      admin = adminSigner.address;
      user = userSigner.address;
      owner = ownerSigner.address;
      keeper = keeperSigner.address;
      feeRecipient = feeRecipientSigner.address;

      assetContract = await getContractAt("IAsset", depositAsset);

      let mockPremiaPoolFactory = await getContractFactory("MockPremiaPool");

      mockPremiaPool = await mockPremiaPoolFactory.deploy(
        depositAssetDecimals,
        baseAssetDecimals,
        depositAsset
      );

      const VaultLifecycle = await ethers.getContractFactory("VaultLifecycle");
      vaultLifecycleLib = await VaultLifecycle.deploy();

      const VaultLogic = await ethers.getContractFactory("VaultLogic");
      vaultLogicLib = await VaultLogic.deploy();

      mockRegistry = await new MockRegistry__factory(adminSigner).deploy(true);

      const initializeArgs = [
        [owner, keeper, feeRecipient, managementFee, performanceFee, tokenName],
        [
          isCall,
          tokenDecimals,
          depositAssetDecimals,
          assetContract.address,
          underlyingAssetDecimals,
          underlyingAsset,
          minimumSupply,
          minimumContractSize,
          parseUnits("500", tokenDecimals > 18 ? tokenDecimals : 18),
        ],
      ];

      whaleSigner = await utils.impersonateWhale(whale, "1000");

      vaultContract = (
        await utils.deployProxy(
          "ThetaVault",
          adminSigner,
          initializeArgs,
          [mockPremiaPool.address, WETH_ADDRESS[chainId], mockRegistry.address],
          {
            libraries: {
              VaultLifecycle: vaultLifecycleLib.address,
              VaultLogic: vaultLogicLib.address,
            },
          }
        )
      ).connect(whaleSigner);

      if (depositAsset === WETH_ADDRESS[chainId]) {
        await assetContract
          .connect(whaleSigner)
          .deposit({ value: parseEther("500") });

        await assetContract
          .connect(whaleSigner)
          .transfer(admin, parseEther("300"));
      } else {
        await assetContract
          .connect(whaleSigner)
          .transfer(admin, parseUnits("1000000", depositAssetDecimals));
      }
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
          .connect(adminSigner)
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

        const whaleWrappedTokenBalance = await vaultContract.balanceOf(
          whale,
          LONG_TOKEN_ID
        );

        assert.bnEqual(whaleWrappedTokenBalance, size);
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
          .connect(adminSigner)
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

        await vaultContract.connect(keeperSigner).harvest();

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
          .connect(adminSigner)
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
          .connect(adminSigner)
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
          whale,
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
        await vaultContract.connect(keeperSigner).harvest();

        vaultState = await vaultContract.vaultState();
        let round = vaultState.round - 1;

        let payout = await vaultContract.payouts(round);

        assert.isFalse(payout.amount.isZero());

        const balance = await vaultContract.balanceOf(whale, LONG_TOKEN_ID);

        let tx = vaultContract.closePosition(
          whale,
          LONG_TOKEN_ID,
          balance.add(parseUnits("10", "wei"))
        );

        await expect(tx).to.be.revertedWith("2");
      });

      it("reverts if shares exceed users balance", async function () {
        await assetContract
          .connect(adminSigner)
          .transfer(vaultContract.address, liquidity);

        let vaultState = await vaultContract.vaultState();
        let expiry = vaultState.expiry;

        await vaultContract
          .connect(userSigner)
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
        await vaultContract.connect(keeperSigner).harvest();

        vaultState = await vaultContract.vaultState();
        let round = vaultState.round - 1;

        let payout = await vaultContract.payouts(round);

        assert.isFalse(payout.amount.isZero());

        const balance = await vaultContract.balanceOf(whale, LONG_TOKEN_ID);

        let tx = vaultContract.closePosition(
          whale,
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
        await vaultContract.connect(keeperSigner).harvest();

        const whaleWrappedTokenBalanceBefore = await vaultContract.balanceOf(
          whale,
          LONG_TOKEN_ID
        );

        const balanceBefore =
          depositAsset === WETH_ADDRESS[chainId]
            ? await whaleSigner.getBalance()
            : await assetContract.balanceOf(whale);

        // Withdraw entire balance
        const tx = await vaultContract.closePosition(
          whale,
          LONG_TOKEN_ID,
          whaleWrappedTokenBalanceBefore,
          { gasPrice }
        );

        const receipt = await tx.wait();
        const gasFee = receipt.gasUsed.mul(gasPrice);

        const whaleWrappedTokenBalanceAfter = await vaultContract.balanceOf(
          whale,
          LONG_TOKEN_ID
        );

        const balanceAfter =
          depositAsset === WETH_ADDRESS[chainId]
            ? await whaleSigner.getBalance()
            : await assetContract.balanceOf(whale);

        const amountClaimed =
          depositAsset === WETH_ADDRESS[chainId]
            ? balanceAfter.sub(balanceBefore).add(gasFee) // uses call.value to send ETH
            : balanceAfter.sub(balanceBefore);

        assert.isTrue(whaleWrappedTokenBalanceAfter.isZero());

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
          .connect(adminSigner)
          .transfer(vaultContract.address, liquidity2);

        let vaultState = await vaultContract.vaultState();
        let expiry = vaultState.expiry;

        await vaultContract
          .connect(userSigner)
          .purchase(BYTES_ZERO, 0, expiry, strike64x64, 0, size2, isCall);

        let userLongHolderBalance = isCall
          ? bnSpot.sub(bnStrike).mul(size2).div(bnSpot)
          : bnStrike.sub(bnSpot).mul(size2);

        let userShortHolderBalance = liquidity2.sub(userLongHolderBalance);

        let whaleLongHolderBalance = longHolderBalance;
        let whaleShortHolderBalance = shortHolderBalance;

        await mockPremiaPool.processExpired(
          vaultContract.address,
          whaleShortHolderBalance.add(userShortHolderBalance),
          whaleLongHolderBalance.add(userLongHolderBalance),
          isCall
        );

        await time.increaseTo(expiry);

        await vaultContract.connect(keeperSigner).harvest();

        const whaleBalanceBefore =
          depositAsset === WETH_ADDRESS[chainId]
            ? await whaleSigner.getBalance()
            : await assetContract.balanceOf(whale);

        const userBalanceBefore =
          depositAsset === WETH_ADDRESS[chainId]
            ? await userSigner.getBalance()
            : await assetContract.balanceOf(user);

        const whaleWrappedTokenBalance = await vaultContract.balanceOf(
          whale,
          LONG_TOKEN_ID
        );

        const userWrappedTokenBalance = await vaultContract.balanceOf(
          user,
          LONG_TOKEN_ID
        );

        // Withdraw entire balance
        let tx1 = await vaultContract.closePosition(
          whale,
          LONG_TOKEN_ID,
          whaleWrappedTokenBalance,
          { gasPrice }
        );

        const receipt1 = await tx1.wait();
        const gasFee1 = receipt1.gasUsed.mul(gasPrice);

        let tx2 = await vaultContract
          .connect(userSigner)
          .closePosition(user, LONG_TOKEN_ID, userWrappedTokenBalance, {
            gasPrice,
          });

        const receipt2 = await tx2.wait();
        const gasFee2 = receipt2.gasUsed.mul(gasPrice);

        assert.isTrue(
          await (await vaultContract.balanceOf(whale, LONG_TOKEN_ID)).isZero()
        );

        assert.isTrue(
          await (await vaultContract.balanceOf(user, LONG_TOKEN_ID)).isZero()
        );

        const whaleBalanceAfter =
          depositAsset === WETH_ADDRESS[chainId]
            ? await whaleSigner.getBalance()
            : await assetContract.balanceOf(whale);

        const whaleAmountClaimed =
          depositAsset === WETH_ADDRESS[chainId]
            ? whaleBalanceAfter.sub(whaleBalanceBefore).add(gasFee1) // uses call.value to send ETH
            : whaleBalanceAfter.sub(whaleBalanceBefore);

        // Acceptable precision error is +/- 10 Wei
        assert.bnLte(
          whaleLongHolderBalance,
          whaleAmountClaimed.add(parseUnits("10", "wei"))
        );
        assert.bnGte(
          whaleLongHolderBalance,
          whaleAmountClaimed.sub(parseUnits("10", "wei"))
        );

        const userBalanceAfter =
          depositAsset === WETH_ADDRESS[chainId]
            ? await userSigner.getBalance()
            : await assetContract.balanceOf(user);

        const userAmountClaimed =
          depositAsset === WETH_ADDRESS[chainId]
            ? userBalanceAfter.sub(userBalanceBefore).add(gasFee2) // uses call.value to send ETH
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
          .connect(adminSigner)
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

      it("reverts if round has not expired", async function () {
        await expect(
          vaultContract.connect(keeperSigner).harvest()
        ).to.be.revertedWith("19");
      });

      it("vault recieves correct repayment amount", async function () {
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

        await vaultContract.connect(keeperSigner).harvest();

        const balanceAfter = await assetContract.balanceOf(
          vaultContract.address
        );

        assert.bnEqual(balanceBefore, balanceAfter.sub(shortHolderBalance));
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

        await vaultContract.connect(keeperSigner).harvest();

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
            await vaultContract.totalSupply(longTokenId)
          )
        );

        await mockPremiaPool.setRound(round);

        strike = 3000;
        size = parseUnits("10", depositAssetDecimals);
        liquidity = isCall ? size : size.mul(strike);
        strike64x64 = fixedFromFloat(strike);

        await assetContract
          .connect(adminSigner)
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

        await vaultContract.connect(keeperSigner).harvest();

        let roundPayout1 = await vaultContract.payouts(round);
        let amount1 = roundPayout1.amount;
        let pricePerShare1 = roundPayout1.pricePerShare;

        assert.bnEqual(amount1, longHolderBalance);
        assert.bnEqual(
          pricePerShare1,
          fixedFromFloat(longHolderBalance).div(
            await vaultContract.totalSupply(LONG_TOKEN_ID + round)
          )
        );
      });
    });
  });
}
