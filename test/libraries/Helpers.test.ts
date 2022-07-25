import { ethers } from "hardhat";
const { provider } = ethers;

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import { TestHelpers, TestHelpers__factory } from "../../types";

import { assert, time } from "../utils";

import moment from "moment-timezone";
moment.tz.setDefault("UTC");

describe.only("Helpers", () => {
  let instance: TestHelpers;
  let signer: SignerWithAddress;

  let thisFriday: moment.Moment;
  let nextFriday: moment.Moment;

  before(async () => {
    [signer] = await ethers.getSigners();
    instance = await new TestHelpers__factory(signer).deploy();
  });

  time.revertToSnapshotAfterEach(async () => {
    const { timestamp } = await provider.getBlock("latest");

    // The block we're hardcoded to is a Monday
    const currentTime = moment.unix(timestamp);

    const monday = moment(currentTime)
      .startOf("isoWeek")
      .add(1, "week")
      .day("monday")
      .hour(9);

    await time.increaseTo(monday.unix());

    thisFriday = moment(monday).startOf("isoWeek").day("friday").hour(8);

    nextFriday = moment(monday)
      .startOf("isoWeek")
      .add(1, "week")
      .day("friday")
      .hour(8);
  });

  describe("#getFriday(uint256)", () => {
    it("should return this Friday, given the day of week is Monday", async () => {
      const { timestamp } = await provider.getBlock("latest");
      const currentTime = moment.unix(timestamp);

      // The block we're hardcoded to is a Monday
      const monday = currentTime;

      const actualFriday = await instance.getFriday(monday.unix());
      const fridayDate = moment.unix(actualFriday.toNumber());

      assert.equal(fridayDate.weekday(), 5);
      assert.isTrue(fridayDate.isSame(thisFriday));
    });

    it("should return this Friday, given the day of week is Tuesday", async () => {
      const { timestamp } = await provider.getBlock("latest");
      const currentTime = moment.unix(timestamp);

      // The block we're hardcoded to is a Monday so we add 1 day to get to Tuesday
      const tuesday = currentTime.add(1, "days");

      const actualFriday = await instance.getFriday(tuesday.unix());
      const fridayDate = moment.unix(actualFriday.toNumber());

      assert.equal(fridayDate.weekday(), 5);
      assert.isTrue(fridayDate.isSame(thisFriday));
    });

    it("should return this Friday, given the day of week is Wendesday", async () => {
      const { timestamp } = await provider.getBlock("latest");
      const currentTime = moment.unix(timestamp);

      // The block we're hardcoded to is a Monday so we add 2 days to get to Wendesday
      const wendesday = currentTime.add(2, "days");

      const actualFriday = await instance.getFriday(wendesday.unix());
      const fridayDate = moment.unix(actualFriday.toNumber());

      assert.equal(fridayDate.weekday(), 5);
      assert.isTrue(fridayDate.isSame(thisFriday));
    });

    it("should return this Friday, given the day of week is Thursday", async () => {
      const { timestamp } = await provider.getBlock("latest");
      const currentTime = moment.unix(timestamp);

      // The block we're hardcoded to is a Monday so we add 3 days to get to Thursday
      const thursday = currentTime.add(3, "days");

      const actualFriday = await instance.getFriday(thursday.unix());
      const fridayDate = moment.unix(actualFriday.toNumber());

      assert.equal(fridayDate.weekday(), 5);
      assert.isTrue(fridayDate.isSame(thisFriday));
    });

    it("should return this Friday, given the day of week is Friday at 7am UTC", async () => {
      const { timestamp } = await provider.getBlock("latest");
      const currentTime = moment.unix(timestamp);

      // The block we're hardcoded to is a Monday so we add 4 days to get to Friday
      const friday = currentTime.add(4, "days").hours(7).minutes(0).seconds(0); // set to 7am UTC

      const actualFriday = await instance.getFriday(friday.unix());
      const fridayDate = moment.unix(actualFriday.toNumber());

      assert.equal(fridayDate.weekday(), 5);
      assert.isTrue(fridayDate.isSame(thisFriday));
    });

    it("should return next Friday, given the day of week is Friday at 8am UTC", async () => {
      const { timestamp } = await provider.getBlock("latest");
      const currentTime = moment.unix(timestamp);

      // The block we're hardcoded to is a Monday so we add 4 days to get to Friday
      const friday = currentTime.add(4, "days").hours(8).minutes(0).seconds(0); // set to 8am UTC

      const actualFriday = await instance.getFriday(friday.unix());
      const fridayDate = moment.unix(actualFriday.toNumber());

      assert.equal(fridayDate.weekday(), 5);
      assert.isTrue(fridayDate.isSame(nextFriday));
    });

    it("should return next Friday, given the day of week is Friday at 9am UTC", async () => {
      const { timestamp } = await provider.getBlock("latest");
      const currentTime = moment.unix(timestamp);

      // The block we're hardcoded to is a Monday so we add 4 days to get to Friday
      const friday = currentTime.add(4, "days").hours(9).minutes(0).seconds(0); // set to 9am UTC

      const actualFriday = await instance.getFriday(friday.unix());
      const fridayDate = moment.unix(actualFriday.toNumber());

      assert.equal(fridayDate.weekday(), 5);
      assert.isTrue(fridayDate.isSame(nextFriday));
    });

    it("should return next Friday, given the day of week is Saturday", async () => {
      const { timestamp } = await provider.getBlock("latest");
      const currentTime = moment.unix(timestamp);

      // The block we're hardcoded to is a Monday so we add 5 days to get to Saturday
      const saturday = currentTime.add(5, "days");

      const actualFriday = await instance.getFriday(saturday.unix());
      const fridayDate = moment.unix(actualFriday.toNumber());

      assert.equal(fridayDate.weekday(), 5);
      assert.isTrue(fridayDate.isSame(nextFriday));
    });

    it("should return next Friday, given the day of week is Sunday", async () => {
      const { timestamp } = await provider.getBlock("latest");
      const currentTime = moment.unix(timestamp);

      // The block we're hardcoded to is a Monday so we add 6 days to get to Sunday
      const sunday = currentTime.add(6, "days");

      const actualFriday = await instance.getFriday(sunday.unix());
      const fridayDate = moment.unix(actualFriday.toNumber());

      assert.equal(fridayDate.weekday(), 5);
      assert.isTrue(fridayDate.isSame(nextFriday));
    });
  });

  describe("#getNextFriday(uint256)", () => {
    it("should return next Friday, given the day of week is Monday", async () => {
      const { timestamp } = await provider.getBlock("latest");
      const currentTime = moment.unix(timestamp);

      // The block we're hardcoded to is a Monday
      const monday = currentTime;

      const actualFriday = await instance.getNextFriday(monday.unix());
      const fridayDate = moment.unix(actualFriday.toNumber());

      assert.equal(fridayDate.weekday(), 5);
      assert.isTrue(fridayDate.isSame(nextFriday));
    });

    it("should return next Friday, given the day of week is Tuesday", async () => {
      const { timestamp } = await provider.getBlock("latest");
      const currentTime = moment.unix(timestamp);

      // The block we're hardcoded to is a Monday so we add 1 day to get to Tuesday
      const tuesday = currentTime.add(1, "days");

      const actualFriday = await instance.getNextFriday(tuesday.unix());
      const fridayDate = moment.unix(actualFriday.toNumber());

      assert.equal(fridayDate.weekday(), 5);
      assert.isTrue(fridayDate.isSame(nextFriday));
    });

    it("should return next Friday, given the day of week is Wendesday", async () => {
      const { timestamp } = await provider.getBlock("latest");
      const currentTime = moment.unix(timestamp);

      // The block we're hardcoded to is a Monday so we add 2 days to get to Wendesday
      const wendesday = currentTime.add(2, "days");

      const actualFriday = await instance.getNextFriday(wendesday.unix());
      const fridayDate = moment.unix(actualFriday.toNumber());

      assert.equal(fridayDate.weekday(), 5);
      assert.isTrue(fridayDate.isSame(nextFriday));
    });

    it("should return next Friday, given the day of week is Thursday", async () => {
      const { timestamp } = await provider.getBlock("latest");
      const currentTime = moment.unix(timestamp);

      // The block we're hardcoded to is a Monday so we add 3 days to get to Thursday
      const thursday = currentTime.add(3, "days");

      const actualFriday = await instance.getNextFriday(thursday.unix());
      const fridayDate = moment.unix(actualFriday.toNumber());

      assert.equal(fridayDate.weekday(), 5);
      assert.isTrue(fridayDate.isSame(nextFriday));
    });

    it("should return next Friday, given the day of week is Friday at 7am UTC", async () => {
      const { timestamp } = await provider.getBlock("latest");
      const currentTime = moment.unix(timestamp);

      // The block we're hardcoded to is a Monday so we add 4 days to get to Friday
      const friday = currentTime.add(4, "days").hours(7).minutes(0).seconds(0); // set to 7am UTC

      const actualFriday = await instance.getNextFriday(friday.unix());
      const fridayDate = moment.unix(actualFriday.toNumber());

      assert.equal(fridayDate.weekday(), 5);
      assert.isTrue(fridayDate.isSame(nextFriday));
    });

    it("should return next Friday, given the day of week is Friday at 8am UTC", async () => {
      const { timestamp } = await provider.getBlock("latest");
      const currentTime = moment.unix(timestamp);

      // The block we're hardcoded to is a Monday so we add 4 days to get to Friday
      const friday = currentTime.add(4, "days").hours(8).minutes(0).seconds(0); // set to 8am UTC

      const actualFriday = await instance.getNextFriday(friday.unix());
      const fridayDate = moment.unix(actualFriday.toNumber());

      assert.equal(fridayDate.weekday(), 5);
      assert.isTrue(fridayDate.isSame(nextFriday));
    });

    it("should return next Friday, given the day of week is Friday at 9am UTC", async () => {
      const { timestamp } = await provider.getBlock("latest");
      const currentTime = moment.unix(timestamp);

      // The block we're hardcoded to is a Monday so we add 4 days to get to Friday
      const friday = currentTime.add(4, "days").hours(9).minutes(0).seconds(0); // set to 9am UTC

      const actualFriday = await instance.getNextFriday(friday.unix());
      const fridayDate = moment.unix(actualFriday.toNumber());

      assert.equal(fridayDate.weekday(), 5);
      assert.isTrue(fridayDate.isSame(nextFriday));
    });

    it("should return next Friday, given the day of week is Saturday", async () => {
      const { timestamp } = await provider.getBlock("latest");
      const currentTime = moment.unix(timestamp);

      // The block we're hardcoded to is a Monday so we add 5 days to get to Saturday
      const saturday = currentTime.add(5, "days");

      const actualFriday = await instance.getNextFriday(saturday.unix());
      const fridayDate = moment.unix(actualFriday.toNumber());

      assert.equal(fridayDate.weekday(), 5);
      assert.isTrue(fridayDate.isSame(nextFriday));
    });

    it("should return next Friday, given the day of week is Sunday", async () => {
      const { timestamp } = await provider.getBlock("latest");
      const currentTime = moment.unix(timestamp);

      // The block we're hardcoded to is a Monday so we add 6 days to get to Sunday
      const sunday = currentTime.add(6, "days");

      const actualFriday = await instance.getNextFriday(sunday.unix());
      const fridayDate = moment.unix(actualFriday.toNumber());

      assert.equal(fridayDate.weekday(), 5);
      assert.isTrue(fridayDate.isSame(nextFriday));
    });
  });
});
