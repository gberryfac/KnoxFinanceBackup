import { ethers, network } from "hardhat";
import { BigNumber, Contract } from "ethers";

const { getContractFactory, provider } = ethers;
const { parseEther, parseUnits } = ethers.utils;

import { expect } from "chai";
import moment from "moment-timezone";
import { fixedFromFloat } from "@premia/utils";

import * as time from "./helpers/time";
import * as fixtures from "./helpers/fixtures";
import * as types from "./helpers/types";

import { assert } from "./helpers/assertions";

import {
  BYTES_ZERO,
  TEST_URI,
  WHALE_ADDRESS,
  BLOCK_NUMBER,
  WETH_ADDRESS,
  WETH_DECIMALS,
  DAI_ADDRESS,
  DAI_DECIMALS,
} from "../constants";

const chainId = network.config.chainId;

const LONG_TOKEN_ID = 8;

moment.tz.setDefault("UTC");

let block;
describe("PremiaThetaVault", () => {
  behavesLikeRibbonOptionsVault({
    whale: WHALE_ADDRESS[chainId],
    name: `Knox ETH Theta Vault (Call)`,
    tokenName: `Knox ETH Theta Vault`,
    tokenSymbol: `kETH-THETA-LP`,
    tokenDecimals: 18,
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
    name: `Knox ETH Theta Vault (Call)`,
    tokenName: `Knox ETH Theta Vault`,
    tokenSymbol: `kETH-THETA-LP`,
    tokenDecimals: 18,
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
  let tokenName = params.tokenName;
  let tokenSymbol = params.tokenSymbol;
  let tokenDecimals = params.tokenDecimals;
  let asset = params.asset;
  let depositAssetDecimals = params.depositAssetDecimals;
  let baseAssetDecimals = params.baseAssetDecimals;
  let underlyingAssetDecimals = params.underlyingAssetDecimals;
  let cap = params.cap;
  let minimumSupply = params.minimumSupply;
  let minimumContractSize = params.minimumContractSize;
  let managementFee = params.managementFee;
  let performanceFee = params.performanceFee;
  let isCall = params.isCall;

  // Contracts
  let commonLogicLibrary: Contract;
  let vaultDisplayLibrary: Contract;
  let vaultLifecycleLibrary: Contract;
  let vaultLogicLibrary: Contract;
  let vaultContract: Contract;
  let registryContract: Contract;
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

      premiaPool = await getContractFactory("MockPremiaPool").then((contract) =>
        contract.deploy(depositAssetDecimals, baseAssetDecimals, asset)
      );

      addresses["pool"] = premiaPool.address;

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

      registryContract = await getContractFactory(
        "MockRegistry",
        signers.admin
      ).then((contract) => contract.deploy(true));

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
      addresses["registry"] = registryContract.address;
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

    describe("#setNewKeeper", () => {
      time.revertToSnapshotAfterEach(async () => {});

      it("should revert when not owner", async () => {
        await expect(
          strategyContract.setNewKeeper(addresses.owner)
        ).to.be.revertedWith("caller is not the owner");
      });

      it("should set new keeper to owner when owner calls setNewKeeper", async () => {
        assert.equal(await strategyContract.keeper(), addresses.keeper);

        await strategyContract
          .connect(signers.owner)
          .setNewKeeper(addresses.owner);

        assert.equal(await strategyContract.keeper(), addresses.owner);
      });
    });

    describe("#purchase", () => {
      time.revertToSnapshotAfterEach(async () => {});

      it("should adjust balances by premium amount when strategy borrows from vault", async () => {
        const strike = 2500;
        const size = parseUnits("15", depositAssetDecimals);

        const liquidity = isCall ? size : size.mul(strike);

        // Transfers enough liquidity in vault for transaction
        await assetContract
          .connect(signers.admin)
          .transfer(addresses.vault, liquidity);

        const vaultBalanceBefore = await assetContract.balanceOf(
          addresses.vault
        );
        const strategyBalanceBefore = await assetContract.balanceOf(
          addresses.strategy
        );
        const userBalanceBefore = await assetContract.balanceOf(addresses.user);

        let vaultState = await vaultContract.vaultState();
        let expiry = vaultState.expiry;

        const maturity = expiry;

        const strike64x64 = fixedFromFloat(strike);
        const premium64x64 = fixedFromFloat(0.1);
        const premium = parseUnits("1.5", depositAssetDecimals);

        await assetContract
          .connect(signers.user)
          .approve(addresses.strategy, premium);

        await strategyContract.purchase(
          BYTES_ZERO,
          0,
          maturity,
          strike64x64,
          premium64x64,
          size
        );

        const vaultBalanceAfter = await assetContract.balanceOf(
          addresses.vault
        );

        const strategyBalanceAfter = await assetContract.balanceOf(
          addresses.strategy
        );

        const userBalanceAfter = await assetContract.balanceOf(addresses.user);

        assert.bnEqual(strategyBalanceBefore, strategyBalanceAfter);

        // Acceptable precision error is +/- 10 Wei
        assert.bnLte(
          vaultBalanceBefore,
          vaultBalanceAfter
            .add(liquidity)
            .sub(premium)
            .add(parseUnits("10", "wei"))
        );
        assert.bnGte(
          vaultBalanceBefore,
          vaultBalanceAfter
            .add(liquidity)
            .sub(premium)
            .sub(parseUnits("10", "wei"))
        );

        // Acceptable precision error is +/- 10 Wei
        assert.bnLte(
          userBalanceBefore,
          userBalanceAfter.add(premium).add(parseUnits("10", "wei"))
        );
        assert.bnGte(
          userBalanceBefore,
          userBalanceAfter.add(premium).sub(parseUnits("10", "wei"))
        );
      });

      it("should send correct amount to strategy when strategy borrows from vault", async () => {
        const strike = 2500;
        const size = parseUnits("15", depositAssetDecimals);

        const liquidity = isCall ? size : size.mul(strike);

        // Transfers enough liquidity in vault for transaction
        await assetContract
          .connect(signers.admin)
          .transfer(addresses.vault, liquidity);

        const balanceBefore = await assetContract.balanceOf(addresses.vault);

        let vaultState = await vaultContract.vaultState();
        let expiry = vaultState.expiry;

        const maturity = expiry;
        const strike64x64 = fixedFromFloat(strike);

        await strategyContract.purchase(
          BYTES_ZERO,
          0,
          maturity,
          strike64x64,
          0,
          size
        );

        const balanceAfter = await assetContract.balanceOf(addresses.vault);

        assert.bnEqual(balanceBefore, balanceAfter.add(liquidity));
      });

      it("should mint correct number of wrapped long tokens when user purchases option", async () => {
        const strike = 2500;
        const size = parseUnits("15", depositAssetDecimals);

        const liquidity = isCall ? size : size.mul(strike);

        // Transfers enough liquidity in vault for transaction
        await assetContract
          .connect(signers.admin)
          .transfer(addresses.vault, liquidity);

        let vaultState = await vaultContract.vaultState();
        let expiry = vaultState.expiry;

        const maturity = expiry;
        const strike64x64 = fixedFromFloat(strike);

        await strategyContract.purchase(
          BYTES_ZERO,
          0,
          maturity,
          strike64x64,
          0,
          size
        );

        const userWrappedTokenBalance = await strategyContract.balanceOf(
          addresses.user,
          LONG_TOKEN_ID
        );

        assert.bnEqual(userWrappedTokenBalance, size);
      });

      it("should mint wrapped long tokens with correct tokenId when user purchases option", async () => {
        let vaultState = await vaultContract.vaultState();
        let round = vaultState.round;

        let claim = await strategyContract.claims(round);
        assert.bnEqual(claim.longTokenId, BigNumber.from("0"));

        const strike = 2500;
        let size = parseUnits("15", depositAssetDecimals);

        let liquidity = isCall ? size : size.mul(strike);
        liquidity = liquidity.mul(2);

        // transfers enough liquidity in vault for transaction
        await assetContract
          .connect(signers.admin)
          .transfer(addresses.vault, liquidity);

        vaultState = await vaultContract.vaultState();
        let expiry = vaultState.expiry;

        const maturity = expiry;
        const strike64x64 = fixedFromFloat(strike);

        await strategyContract.purchase(
          BYTES_ZERO,
          0,
          maturity,
          strike64x64,
          0,
          size
        );

        vaultState = await vaultContract.vaultState();
        round = vaultState.round;

        claim = await strategyContract.claims(round);
        assert.bnEqual(claim.longTokenId, BigNumber.from(LONG_TOKEN_ID));

        await strategyContract.purchase(
          BYTES_ZERO,
          0,
          maturity,
          strike64x64,
          0,
          size
        );

        // current token id should not change
        claim = await strategyContract.claims(round);
        assert.bnEqual(claim.longTokenId, BigNumber.from(LONG_TOKEN_ID));

        await premiaPool.processExpired(
          addresses.strategy,
          liquidity,
          0,
          isCall
        );

        vaultState = await vaultContract.vaultState();
        expiry = vaultState.expiry;

        await time.increaseTo(expiry);

        await strategyContract.connect(signers.keeper).harvest();

        vaultState = await vaultContract.vaultState();
        round = vaultState.round;

        await premiaPool.setRound(round);

        claim = await strategyContract.claims(round);
        assert.bnEqual(claim.longTokenId, BigNumber.from("0"));

        await strategyContract.purchase(
          BYTES_ZERO,
          0,
          maturity,
          strike64x64,
          0,
          size
        );

        // current token id should be different from last round
        claim = await strategyContract.claims(round);

        assert.bnEqual(
          claim.longTokenId,
          BigNumber.from(LONG_TOKEN_ID + round)
        );
      });

      it("should adjust vault locked collateral when strategy borrows from vault", async () => {
        let vaultState = await vaultContract.vaultState();
        let balance = await assetContract.balanceOf(addresses.vault);
        let lockedCollateral = vaultState.lockedCollateral;
        let queuedDeposits = vaultState.queuedDeposits;
        let queuedWithdrawShares = vaultState.queuedWithdrawShares;
        let queuedWithdrawals = vaultState.queuedWithdrawals;

        assert.bnEqual(balance, BigNumber.from("0"));
        assert.bnEqual(lockedCollateral, BigNumber.from("0"));
        assert.bnEqual(queuedDeposits, BigNumber.from("0"));
        assert.bnEqual(queuedWithdrawShares, BigNumber.from("0"));
        assert.bnEqual(queuedWithdrawals, BigNumber.from("0"));

        const strike = 2500;
        let size = parseUnits("15", depositAssetDecimals);

        let liquidity = isCall ? size : size.mul(strike);

        // transfers enough liquidity in vault for transaction
        await assetContract
          .connect(signers.admin)
          .transfer(addresses.vault, liquidity);

        vaultState = await vaultContract.vaultState();
        let expiry = vaultState.expiry;

        const maturity = expiry;
        const strike64x64 = fixedFromFloat(strike);

        await strategyContract.purchase(
          BYTES_ZERO,
          0,
          maturity,
          strike64x64,
          0,
          size
        );

        vaultState = await vaultContract.vaultState();
        balance = await assetContract.balanceOf(addresses.vault);
        lockedCollateral = vaultState.lockedCollateral;
        queuedDeposits = vaultState.queuedDeposits;
        queuedWithdrawShares = vaultState.queuedWithdrawShares;
        queuedWithdrawals = vaultState.queuedWithdrawals;

        assert.bnEqual(balance, BigNumber.from("0"));
        assert.bnEqual(lockedCollateral, BigNumber.from(liquidity));
        assert.bnEqual(queuedDeposits, BigNumber.from("0"));
        assert.bnEqual(queuedWithdrawShares, BigNumber.from("0"));
        assert.bnEqual(queuedWithdrawals, BigNumber.from("0"));
      });
    });

    describe("#claim", () => {
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

      // this is the amount of funds sent back to the vault as "queued claims" designated for option buyers
      let shortHolderBalance = liquidity.sub(longHolderBalance);

      time.revertToSnapshotAfterEach(async () => {
        let vaultState = await vaultContract.vaultState();
        let expiry = vaultState.expiry;

        await assetContract
          .connect(signers.admin)
          .transfer(addresses.vault, liquidity);

        await strategyContract.purchase(
          BYTES_ZERO,
          0,
          expiry,
          strike64x64,
          0,
          size
        );
      });

      it("should revert when claim amount is 0", async () => {
        let vaultState = await vaultContract.vaultState();
        let round = vaultState.round - 1;

        let claim = await strategyContract.claims(round);

        assert.isTrue(claim.amount.isZero());

        let tx = strategyContract.claim(
          addresses.user,
          LONG_TOKEN_ID,
          parseEther("1")
        );

        await expect(tx).to.be.revertedWith("23");
      });

      it("should revert when amount exceeds claim amount", async () => {
        await premiaPool.processExpired(
          addresses.strategy,
          shortHolderBalance,
          longHolderBalance,
          isCall
        );

        let vaultState = await vaultContract.vaultState();
        let expiry = vaultState.expiry;

        await time.increaseTo(expiry);
        await strategyContract.connect(signers.keeper).harvest();

        vaultState = await vaultContract.vaultState();
        let round = vaultState.round - 1;

        let claim = await strategyContract.claims(round);

        assert.isFalse(claim.amount.isZero());

        const balance = await strategyContract.balanceOf(
          addresses.user,
          LONG_TOKEN_ID
        );

        let tx = strategyContract.claim(
          addresses.user,
          LONG_TOKEN_ID,
          balance.add(parseUnits("10", "wei"))
        );

        await expect(tx).to.be.revertedWith("2");
      });

      it("should revert when shares exceed users balance", async () => {
        await assetContract
          .connect(signers.admin)
          .transfer(addresses.vault, liquidity);

        let vaultState = await vaultContract.vaultState();
        let expiry = vaultState.expiry;

        await strategyContract
          .connect(signers.user2)
          .purchase(BYTES_ZERO, 0, expiry, strike64x64, 0, size);

        await premiaPool.processExpired(
          addresses.strategy,
          shortHolderBalance.mul(2),
          longHolderBalance.mul(2),
          isCall
        );

        vaultState = await vaultContract.vaultState();
        expiry = vaultState.expiry;

        await time.increaseTo(expiry);
        await strategyContract.connect(signers.keeper).harvest();

        vaultState = await vaultContract.vaultState();
        let round = vaultState.round - 1;

        let claim = await strategyContract.claims(round);

        assert.isFalse(claim.amount.isZero());

        const balance = await strategyContract.balanceOf(
          addresses.user,
          LONG_TOKEN_ID
        );

        let tx = strategyContract.claim(
          addresses.user,
          LONG_TOKEN_ID,
          balance.add(parseUnits("10", "wei"))
        );

        await expect(tx).to.be.revertedWith(
          "ERC1155: burn amount exceeds balance"
        );
      });

      it("should withdraw correct claim amount when user claims", async () => {
        await premiaPool.processExpired(
          addresses.strategy,
          shortHolderBalance,
          longHolderBalance,
          isCall
        );

        let vaultState = await vaultContract.vaultState();
        let expiry = vaultState.expiry;

        await time.increaseTo(expiry);
        await strategyContract.connect(signers.keeper).harvest();

        const userWrappedTokenBalanceBefore = await strategyContract.balanceOf(
          addresses.user,
          LONG_TOKEN_ID
        );

        // Withdraw entire balance
        await strategyContract.claim(
          addresses.user,
          LONG_TOKEN_ID,
          userWrappedTokenBalanceBefore
        );
      });

      it("should withdraw correct amount when user claims", async () => {
        await premiaPool.processExpired(
          addresses.strategy,
          shortHolderBalance,
          longHolderBalance,
          isCall
        );

        let vaultState = await vaultContract.vaultState();
        let expiry = vaultState.expiry;

        await time.increaseTo(expiry);
        await strategyContract.connect(signers.keeper).harvest();

        const userWrappedTokenBalanceBefore = await strategyContract.balanceOf(
          addresses.user,
          LONG_TOKEN_ID
        );

        const balanceBefore = await assetContract.balanceOf(addresses.user);

        // Withdraw entire balance
        await strategyContract.claim(
          addresses.user,
          LONG_TOKEN_ID,
          userWrappedTokenBalanceBefore
        );

        const userWrappedTokenBalanceAfter = await strategyContract.balanceOf(
          addresses.user,
          LONG_TOKEN_ID
        );

        const balanceAfter = await assetContract.balanceOf(addresses.user);
        const amountClaimed = balanceAfter.sub(balanceBefore);

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

      it("should withdraw correct share of claim when user claims", async () => {
        let size2 = parseUnits("5", depositAssetDecimals);
        let liquidity2 = isCall ? size2 : size2.mul(strike);

        await assetContract
          .connect(signers.admin)
          .transfer(addresses.vault, liquidity2);

        let vaultState = await vaultContract.vaultState();
        let expiry = vaultState.expiry;

        await strategyContract
          .connect(signers.user2)
          .purchase(BYTES_ZERO, 0, expiry, strike64x64, 0, size2);

        let user2LongHolderBalance = isCall
          ? bnSpot.sub(bnStrike).mul(size2).div(bnSpot)
          : bnStrike.sub(bnSpot).mul(size2);

        let user2ShortHolderBalance = liquidity2.sub(user2LongHolderBalance);

        let userLongHolderBalance = longHolderBalance;
        let userShortHolderBalance = shortHolderBalance;

        await premiaPool.processExpired(
          addresses.strategy,
          userShortHolderBalance.add(user2ShortHolderBalance),
          userLongHolderBalance.add(user2LongHolderBalance),
          isCall
        );

        await time.increaseTo(expiry);

        await strategyContract.connect(signers.keeper).harvest();

        const userBalanceBefore = await assetContract.balanceOf(addresses.user);

        const user2BalanceBefore = await assetContract.balanceOf(
          addresses.user2
        );

        const userWrappedTokenBalance = await strategyContract.balanceOf(
          addresses.user,
          LONG_TOKEN_ID
        );

        const user2WrappedTokenBalance = await strategyContract.balanceOf(
          addresses.user2,
          LONG_TOKEN_ID
        );

        // Withdraw entire balance
        await strategyContract.claim(
          addresses.user,
          LONG_TOKEN_ID,
          userWrappedTokenBalance
        );

        await strategyContract
          .connect(signers.user2)
          .claim(addresses.user2, LONG_TOKEN_ID, user2WrappedTokenBalance);

        assert.isTrue(
          await (
            await strategyContract.balanceOf(addresses.user, LONG_TOKEN_ID)
          ).isZero()
        );

        assert.isTrue(
          await (
            await strategyContract.balanceOf(addresses.user2, LONG_TOKEN_ID)
          ).isZero()
        );

        const userBalanceAfter = await assetContract.balanceOf(addresses.user);
        const userAmountClaimed = userBalanceAfter.sub(userBalanceBefore);

        // Acceptable precision error is +/- 10 Wei
        assert.bnLte(
          userLongHolderBalance,
          userAmountClaimed.add(parseUnits("10", "wei"))
        );
        assert.bnGte(
          userLongHolderBalance,
          userAmountClaimed.sub(parseUnits("10", "wei"))
        );

        const user2BalanceAfter = await assetContract.balanceOf(
          addresses.user2
        );

        const user2AmountClaimed = user2BalanceAfter.sub(user2BalanceBefore);

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

      time.revertToSnapshotAfterEach(async () => {
        let vaultState = await vaultContract.vaultState();
        let expiry = vaultState.expiry;

        await assetContract
          .connect(signers.admin)
          .transfer(addresses.vault, liquidity);

        await strategyContract.purchase(
          BYTES_ZERO,
          0,
          expiry,
          strike64x64,
          0,
          size
        );
      });

      it("should revert when round has not expired", async () => {
        await expect(
          strategyContract.connect(signers.keeper).harvest()
        ).to.be.revertedWith("19");
      });

      it("should adjust vault asset balance when option expires ITM", async () => {
        const bnSpot = BigNumber.from(isCall ? 3000 : 2000);
        const bnStrike = BigNumber.from(strike);

        const longHolderBalance = isCall
          ? bnSpot.sub(bnStrike).mul(size).div(bnSpot)
          : bnStrike.sub(bnSpot).mul(size);

        const shortHolderBalance = liquidity.sub(longHolderBalance);

        await premiaPool.processExpired(
          addresses.strategy,
          shortHolderBalance,
          longHolderBalance,
          isCall
        );

        const balanceBefore = await assetContract.balanceOf(addresses.vault);

        let vaultState = await vaultContract.vaultState();
        let expiry = vaultState.expiry;

        await time.increaseTo(expiry);
        await strategyContract.connect(signers.keeper).harvest();

        const balanceAfter = await assetContract.balanceOf(addresses.vault);

        assert.bnEqual(balanceAfter, balanceBefore.add(shortHolderBalance));
      });

      it("claim amount and price per share are set correctly for each round", async () => {
        let bnSpot = BigNumber.from(isCall ? 3000 : 2000);
        let bnStrike = BigNumber.from(strike);

        let longHolderBalance = isCall
          ? bnSpot.sub(bnStrike).mul(size).div(bnSpot)
          : bnStrike.sub(bnSpot).mul(size);

        let shortHolderBalance = liquidity.sub(longHolderBalance);

        await premiaPool.processExpired(
          addresses.strategy,
          shortHolderBalance,
          longHolderBalance,
          isCall
        );

        let vaultState = await vaultContract.vaultState();
        let expiry = vaultState.expiry;
        let round = vaultState.round;

        let longTokenId = LONG_TOKEN_ID;

        await time.increaseTo(expiry);

        await strategyContract.connect(signers.keeper).harvest();

        vaultState = await vaultContract.vaultState();
        expiry = vaultState.expiry;
        round = vaultState.round;

        // check claim of last round
        let roundPayout0 = await strategyContract.claims(round - 1);
        let amount0 = roundPayout0.amount;
        let pricePerShare0 = roundPayout0.pricePerShare;

        assert.bnEqual(amount0, longHolderBalance);
        assert.bnEqual(
          pricePerShare0,
          fixedFromFloat(longHolderBalance).div(
            await strategyContract.totalSupply(longTokenId)
          )
        );

        await premiaPool.setRound(round);

        strike = 3000;
        size = parseUnits("10", depositAssetDecimals);
        liquidity = isCall ? size : size.mul(strike);
        strike64x64 = fixedFromFloat(strike);

        await assetContract
          .connect(signers.admin)
          .transfer(addresses.vault, liquidity);

        await strategyContract.purchase(
          BYTES_ZERO,
          0,
          expiry,
          strike64x64,
          0,
          size
        );

        bnSpot = BigNumber.from(isCall ? 3500 : 2500);
        bnStrike = BigNumber.from(strike);

        longHolderBalance = isCall
          ? bnSpot.sub(bnStrike).mul(size).div(bnSpot)
          : bnStrike.sub(bnSpot).mul(size);

        shortHolderBalance = liquidity.sub(longHolderBalance);

        await premiaPool.processExpired(
          addresses.strategy,
          shortHolderBalance,
          longHolderBalance,
          isCall
        );

        vaultState = await vaultContract.vaultState();
        expiry = vaultState.expiry;
        round = vaultState.round;

        await time.increaseTo(expiry);

        await strategyContract.connect(signers.keeper).harvest();

        let roundPayout1 = await strategyContract.claims(round);
        let amount1 = roundPayout1.amount;
        let pricePerShare1 = roundPayout1.pricePerShare;

        assert.bnEqual(amount1, longHolderBalance);
        assert.bnEqual(
          pricePerShare1,
          fixedFromFloat(longHolderBalance).div(
            await strategyContract.totalSupply(LONG_TOKEN_ID + round)
          )
        );
      });
    });
  });
}
