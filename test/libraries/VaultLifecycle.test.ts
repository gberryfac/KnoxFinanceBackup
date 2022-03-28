import { ethers } from "hardhat";
import { BigNumber, Contract } from "ethers";
const { parseUnits } = ethers.utils;

import moment from "moment-timezone";

import { assert } from "../helpers/assertions";
import * as time from "../helpers/time";

moment.tz.setDefault("UTC");

const provider = ethers.provider;

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

  describe("#getNextFriday", () => {
    time.revertToSnapshotAfterEach(async () => {
      const { timestamp } = await provider.getBlock("latest");

      const currentTime = moment.unix(timestamp);

      const nextFriday = moment(currentTime)
        .startOf("isoWeek")
        .add(1, "week")
        .day("friday")
        .hour(9); // needs to be 8am UTC

      await time.increaseTo(nextFriday.unix());
    });

    it("gets the first Friday, given the day of week is Saturday", async () => {
      const { timestamp } = await provider.getBlock("latest");
      const currentTime = moment.unix(timestamp);

      // The block we're hardcoded to is a Friday so we add 1 day to get to Saturday
      const saturday = currentTime.add(1, "days");

      const expectedFriday = moment(saturday)
        .startOf("isoWeek")
        .add(1, "week")
        .day("friday")
        .hour(8); // needs to be 8am UTC

      const nextFriday = await lifecycle.getNextFriday(saturday.unix());
      const fridayDate = moment.unix(nextFriday);
      assert.equal(fridayDate.weekday(), 5);

      assert.isTrue(fridayDate.isSame(expectedFriday));
    });

    it("gets the first Friday, given the day of week is Sunday", async () => {
      const { timestamp } = await provider.getBlock("latest");
      const currentTime = moment.unix(timestamp);

      // The block we're hardcoded to is a Friday so we add 1 day to get to Sunday
      const sunday = currentTime.add(2, "days");

      const expectedFriday = moment(sunday)
        .startOf("isoWeek")
        .add(1, "week")
        .day("friday")
        .hour(8); // needs to be 8am UTC

      const nextFriday = await lifecycle.getNextFriday(sunday.unix());
      const fridayDate = moment.unix(nextFriday);
      assert.equal(fridayDate.weekday(), 5);

      assert.isTrue(fridayDate.isSame(expectedFriday));
    });

    it("gets the first Friday, given the day of week is Thursday", async () => {
      const { timestamp } = await provider.getBlock("latest");
      const currentTime = moment.unix(timestamp);

      // The block we're hardcoded to is a Friday so we subtract 1 day to get to Thursday
      const thursday = currentTime.add(-1, "days");

      const expectedFriday = moment(thursday)
        .startOf("isoWeek")
        .day("friday")
        .hour(8); // needs to be 8am UTC

      const nextFriday = await lifecycle.getNextFriday(thursday.unix());
      const fridayDate = moment.unix(nextFriday);
      assert.equal(fridayDate.weekday(), 5);

      assert.isTrue(fridayDate.isSame(expectedFriday));
    });

    it("gets the next Friday, given the day of week is Friday", async () => {
      const { timestamp } = await provider.getBlock("latest");
      const currentTime = moment.unix(timestamp);

      const thisFriday = currentTime.hours(8).minutes(0).seconds(0); // set to 8am UTc

      const expectedFriday = moment(thisFriday)
        .startOf("isoWeek")
        .add(1, "week")
        .day("friday")
        .hour(8); // needs to be 8am UTC

      const nextFriday = await lifecycle.getNextFriday(thisFriday.unix());
      const fridayDate = moment.unix(nextFriday);
      assert.equal(fridayDate.weekday(), 5);

      assert.isTrue(fridayDate.isSame(expectedFriday));
    });

    it("gets the next Friday, given the day of week is Friday, but after 8am UTC", async () => {
      const { timestamp } = await provider.getBlock("latest");
      const currentTime = moment.unix(timestamp);

      const thisFriday = moment(currentTime);

      const expectedFriday = currentTime
        .startOf("isoWeek")
        .add(1, "week")
        .day("friday")
        .hour(8); // needs to be 8am UTC

      const nextFriday = await lifecycle.getNextFriday(thisFriday.unix());
      const fridayDate = moment.unix(nextFriday);
      assert.equal(fridayDate.weekday(), 5);
      assert.isTrue(fridayDate.isSame(expectedFriday));
    });
  });
});
