import { ethers } from "hardhat";
import { BigNumber, Contract } from "ethers";
const { parseUnits } = ethers.utils;

import moment from "moment-timezone";

import { assert } from "../helpers/assertions";
import * as time from "../helpers/time";

moment.tz.setDefault("UTC");

describe.only("VaultLifecycle", () => {
  let lifecycle: Contract;

  before(async () => {
    const VaultLifecycle = await ethers.getContractFactory("VaultLifecycle");
    const lifecycleLib = await VaultLifecycle.deploy();

    const TestVaultLifecycle = await ethers.getContractFactory(
      "TestVaultLifecycle",
      { libraries: { VaultLifecycle: lifecycleLib.address } }
    );
    lifecycle = await TestVaultLifecycle.deploy();
  });

  describe("#getBalanceForVaultFees", () => {
    time.revertToSnapshotAfterEach(async () => {});
    it("calculate correct balance for vault fees with no withdrawals", async () => {
      const currentBalance = parseUnits("2", 18);
      const currentShareSupply = parseUnits("5", 18);
      const decimals = BigNumber.from("18");
      const queuedDeposits = parseUnits("0.25", 18);
      const queuedWithdrawShares = parseUnits("0", 18);
      const queuedWithdrawals = parseUnits("0", 18);

      const balanceForVaultFees = await lifecycle.getBalanceForVaultFees(
        currentBalance,
        currentShareSupply,
        decimals,
        queuedDeposits,
        queuedWithdrawShares,
        queuedWithdrawals
      );

      assert.bnEqual(balanceForVaultFees, currentBalance);
    });

    it("calculate correct balance for vault fees with no withdrawal shares", async () => {
      const currentBalance = parseUnits("2", 18);
      const currentShareSupply = parseUnits("5", 18);
      const decimals = BigNumber.from("18");
      const queuedDeposits = parseUnits("0.25", 18);
      const queuedWithdrawShares = parseUnits("0", 18);
      const queuedWithdrawals = parseUnits("0.1", 18);

      const balanceForVaultFees = await lifecycle.getBalanceForVaultFees(
        currentBalance,
        currentShareSupply,
        decimals,
        queuedDeposits,
        queuedWithdrawShares,
        queuedWithdrawals
      );

      assert.bnEqual(balanceForVaultFees, currentBalance);
    });

    it("calculate correct balance for vault fees, where queuedWithdrawBeforeFee < queuedWithdrawals", async () => {
      const currentBalance = parseUnits("2", 18);
      const currentShareSupply = parseUnits("5", 18);
      const decimals = BigNumber.from("18");
      const queuedDeposits = parseUnits("0.25", 18);
      const queuedWithdrawShares = parseUnits("0.2", 18);
      const queuedWithdrawals = parseUnits("0.1", 18);

      const balanceForVaultFees = await lifecycle.getBalanceForVaultFees(
        currentBalance,
        currentShareSupply,
        decimals,
        queuedDeposits,
        queuedWithdrawShares,
        queuedWithdrawals
      );

      assert.bnEqual(balanceForVaultFees, parseUnits("1.93", 18));
    });

    it("calculate correct balance for vault fees, where queuedWithdrawBeforeFee > queuedWithdrawals", async () => {
      const currentBalance = parseUnits("2", 18);
      const currentShareSupply = parseUnits("5", 18);
      const decimals = BigNumber.from("18");
      const queuedDeposits = parseUnits("0.25", 18);
      const queuedWithdrawShares = parseUnits("1", 18);
      const queuedWithdrawals = parseUnits("0.1", 18);

      const balanceForVaultFees = await lifecycle.getBalanceForVaultFees(
        currentBalance,
        currentShareSupply,
        decimals,
        queuedDeposits,
        queuedWithdrawShares,
        queuedWithdrawals
      );

      assert.bnEqual(balanceForVaultFees, parseUnits("1.9", 18));
    });
  });

  describe("#getVaultFees", () => {
    time.revertToSnapshotAfterEach(async () => {});
    it("vault takes no fees", async () => {
      const balanceForVaultFees = parseUnits("0", 18);
      const lastlockedCollateral = parseUnits("0.75", 18);
      const queuedDeposits = parseUnits("0", 18);
      const performanceFeePercent = BigNumber.from("20000000");
      const managementFeePercent = BigNumber.from("2000000");

      const { performanceFeeInAsset, managementFeeInAsset, vaultFee } =
        await lifecycle.getVaultFees(
          balanceForVaultFees,
          lastlockedCollateral,
          queuedDeposits,
          performanceFeePercent,
          managementFeePercent
        );

      assert.isTrue(performanceFeeInAsset.isZero());
      assert.isTrue(managementFeeInAsset.isZero());
      assert.isTrue(vaultFee.isZero());
    });

    it("vault fee calculation is correct", async () => {
      const balanceForVaultFees = parseUnits("1", 18);
      const lastlockedCollateral = parseUnits("0.5", 18);
      const queuedDeposits = parseUnits("0.25", 18);
      const performanceFeePercent = BigNumber.from("20000000");
      const managementFeePercent = BigNumber.from("2000000");

      const { performanceFeeInAsset, managementFeeInAsset, vaultFee } =
        await lifecycle.getVaultFees(
          balanceForVaultFees,
          lastlockedCollateral,
          queuedDeposits,
          performanceFeePercent,
          managementFeePercent
        );

      assert.bnEqual(performanceFeeInAsset, parseUnits("0.05", 18));
      assert.bnEqual(managementFeeInAsset, parseUnits("0.015", 18));
      assert.bnEqual(vaultFee, parseUnits("0.065", 18));
    });
  });

  describe("#rollover", () => {
    time.revertToSnapshotAfterEach(async () => {});
    it("calculate correct newPricePerShare", async () => {
      const currentBalance = parseUnits("2", 18);
      const currentShareSupply = parseUnits("5", 18);
      const decimals = BigNumber.from("18");
      const queuedDeposits = parseUnits("0.25", 18);
      const queuedWithdrawShares = parseUnits("0", 18);

      const [, newPricePerShare] = await lifecycle.rollover(
        currentBalance,
        currentShareSupply,
        decimals,
        queuedDeposits,
        queuedWithdrawShares
      );

      assert.bnEqual(newPricePerShare, parseUnits("0.35", 18));
    });

    it("calculate correct mintShares when queuedDeposits === 0", async () => {
      const currentBalance = parseUnits("2", 18);
      const currentShareSupply = parseUnits("5", 18);
      const decimals = BigNumber.from("18");
      const queuedDeposits = parseUnits("0", 18);
      const queuedWithdrawShares = parseUnits("0", 18);

      const [, , mintShares] = await lifecycle.rollover(
        currentBalance,
        currentShareSupply,
        decimals,
        queuedDeposits,
        queuedWithdrawShares
      );

      assert.isTrue(mintShares.isZero());
    });

    it("calculate correct queuedWithdrawals when queuedWithdrawShares === 0", async () => {
      const currentBalance = parseUnits("2", 18);
      const currentShareSupply = parseUnits("5", 18);
      const decimals = BigNumber.from("18");
      const queuedDeposits = parseUnits("0.25", 18);
      const queuedWithdrawShares = parseUnits("0", 18);

      const [queuedWithdrawals] = await lifecycle.rollover(
        currentBalance,
        currentShareSupply,
        decimals,
        queuedDeposits,
        queuedWithdrawShares
      );

      assert.isTrue(queuedWithdrawals.isZero());
    });
  });
});
