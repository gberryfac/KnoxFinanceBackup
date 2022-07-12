import { ethers } from "hardhat";
const { provider } = ethers;

import { TestHelpers, TestHelpers__factory } from "../../types";

import { assert } from "../utils/assertions";
import * as time from "../utils/time";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import moment from "moment-timezone";
moment.tz.setDefault("UTC");

describe.only("Helpers", () => {
  let instance: TestHelpers;
  let signer: SignerWithAddress;

  before(async () => {
    [signer] = await ethers.getSigners();
    instance = await new TestHelpers__factory(signer).deploy();
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

    it("gets the first Friday, given the day of week is Monday", async () => {
      const { timestamp } = await provider.getBlock("latest");
      const currentTime = moment.unix(timestamp);

      // The block we're hardcoded to is a Friday so we subtract 4 day to get to Monday
      const monday = currentTime.add(-4, "days");

      const expectedFriday = moment(monday)
        .startOf("isoWeek")
        .add(1, "week")
        .day("friday")
        .hour(8); // needs to be 8am UTC

      const nextFriday = await instance.getNextFriday(monday.unix());
      const fridayDate = moment.unix(nextFriday.toNumber());

      assert.equal(fridayDate.weekday(), 5);
      assert.isTrue(fridayDate.isSame(expectedFriday));
    });

    it("gets the first Friday, given the day of week is Tuesday", async () => {
      const { timestamp } = await provider.getBlock("latest");
      const currentTime = moment.unix(timestamp);

      // The block we're hardcoded to is a Friday so we subtract 3 days to get to Tuesday
      const tuesday = currentTime.add(-3, "days");

      const expectedFriday = moment(tuesday)
        .startOf("isoWeek")
        .add(1, "week")
        .day("friday")
        .hour(8); // needs to be 8am UTC

      const nextFriday = await instance.getNextFriday(tuesday.unix());
      const fridayDate = moment.unix(nextFriday.toNumber());

      assert.equal(fridayDate.weekday(), 5);
      assert.isTrue(fridayDate.isSame(expectedFriday));
    });

    it("gets the first Friday, given the day of week is Wendesday", async () => {
      const { timestamp } = await provider.getBlock("latest");
      const currentTime = moment.unix(timestamp);

      // The block we're hardcoded to is a Friday so we subtract 2 days to get to Wendesday
      const wendesday = currentTime.add(-2, "days");

      const expectedFriday = moment(wendesday)
        .startOf("isoWeek")
        .add(1, "week")
        .day("friday")
        .hour(8); // needs to be 8am UTC

      const nextFriday = await instance.getNextFriday(wendesday.unix());
      const fridayDate = moment.unix(nextFriday.toNumber());

      assert.equal(fridayDate.weekday(), 5);
      assert.isTrue(fridayDate.isSame(expectedFriday));
    });

    it("gets the next Friday, given the day of week is Thursday", async () => {
      const { timestamp } = await provider.getBlock("latest");
      const currentTime = moment.unix(timestamp);

      // The block we're hardcoded to is a Friday so we subtract 1 day to get to Thursday
      const thursday = currentTime.add(-1, "days");

      const expectedFriday = moment(thursday)
        .startOf("isoWeek")
        .add(1, "week")
        .day("friday")
        .hour(8); // needs to be 8am UTC

      const nextFriday = await instance.getNextFriday(thursday.unix());
      const fridayDate = moment.unix(nextFriday.toNumber());

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

      const nextFriday = await instance.getNextFriday(thisFriday.unix());
      const fridayDate = moment.unix(nextFriday.toNumber());

      assert.equal(fridayDate.weekday(), 5);
      assert.isTrue(fridayDate.isSame(expectedFriday));
    });

    it("gets the next Friday, given the day of week is Friday, but before 8am UTC", async () => {
      const { timestamp } = await provider.getBlock("latest");
      const currentTime = moment.unix(timestamp);

      const thisFriday = currentTime.hours(7).minutes(0).seconds(0); // set to 7am UTc

      const expectedFriday = moment(thisFriday)
        .startOf("isoWeek")
        .add(1, "week")
        .day("friday")
        .hour(8); // needs to be 8am UTC

      const nextFriday = await instance.getNextFriday(thisFriday.unix());
      const fridayDate = moment.unix(nextFriday.toNumber());

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

      const nextFriday = await instance.getNextFriday(thisFriday.unix());
      const fridayDate = moment.unix(nextFriday.toNumber());

      assert.equal(fridayDate.weekday(), 5);
      assert.isTrue(fridayDate.isSame(expectedFriday));
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

      const nextFriday = await instance.getNextFriday(saturday.unix());
      const fridayDate = moment.unix(nextFriday.toNumber());

      assert.equal(fridayDate.weekday(), 5);
      assert.isTrue(fridayDate.isSame(expectedFriday));
    });

    it("gets the first Friday, given the day of week is Sunday", async () => {
      const { timestamp } = await provider.getBlock("latest");
      const currentTime = moment.unix(timestamp);

      // The block we're hardcoded to is a Friday so we add 2 days to get to Sunday
      const sunday = currentTime.add(2, "days");

      const expectedFriday = moment(sunday)
        .startOf("isoWeek")
        .add(1, "week")
        .day("friday")
        .hour(8); // needs to be 8am UTC

      const nextFriday = await instance.getNextFriday(sunday.unix());
      const fridayDate = moment.unix(nextFriday.toNumber());

      assert.equal(fridayDate.weekday(), 5);
      assert.isTrue(fridayDate.isSame(expectedFriday));
    });
  });
});
