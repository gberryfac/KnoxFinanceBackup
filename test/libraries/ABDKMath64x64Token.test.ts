import { ethers } from "hardhat";

import { fixedFromFloat } from "@premia/utils";

import {
  TestABDKMath64x64Token,
  TestABDKMath64x64Token__factory,
} from "./../../types";

import { expect } from "chai";
import { assert } from "../helpers/assertions";

let instance: TestABDKMath64x64Token;

describe("ABDKMath64x64Token", () => {
  before(async () => {
    const [signer] = await ethers.getSigners();
    instance = await new TestABDKMath64x64Token__factory(signer).deploy();
  });

  describe("#roundUp64x64", () => {
    it("should revert if x == 0", async () => {
      await expect(instance.roundUp64x64(0)).to.be.reverted;
    });
    it("should round 1.0 to 1.0", async () => {
      const x = fixedFromFloat("1.0");
      assert.equal(
        (await instance.roundUp64x64(x)).toString(),
        fixedFromFloat("1.0").toString()
      );
    });
    it("should round 90.0 to 90.0", async () => {
      const x = fixedFromFloat("90.0");
      assert.equal(
        (await instance.roundUp64x64(x)).toString(),
        fixedFromFloat("90.0").toString()
      );
    });
    it("should round 53510034427 to 54000000000", async () => {
      const x = fixedFromFloat("53510034427");
      assert.equal(
        (await instance.roundUp64x64(x)).toString(),
        fixedFromFloat("54000000000").toString()
      );
    });
    it("should round 53410034427 to 54000000000", async () => {
      const x = fixedFromFloat("53410034427");
      assert.equal(
        (await instance.roundUp64x64(x)).toString(),
        fixedFromFloat("54000000000").toString()
      );
    });
    it("should round 24450 to 25000", async () => {
      const x = fixedFromFloat("24450");
      assert.equal(
        (await instance.roundUp64x64(x)).toString(),
        fixedFromFloat("25000").toString()
      );
    });
    it("should round 9999 to 10000", async () => {
      const x = fixedFromFloat("9999");
      assert.equal(
        (await instance.roundUp64x64(x)).toString(),
        fixedFromFloat("10000").toString()
      );
    });
    it("should round 8863 to 8900", async () => {
      const x = fixedFromFloat("8863");
      assert.equal(
        (await instance.roundUp64x64(x)).toString(),
        fixedFromFloat("8900").toString()
      );
    });
    it("should round 521 to 530", async () => {
      const x = fixedFromFloat("521");
      assert.equal(
        (await instance.roundUp64x64(x)).toString(),
        fixedFromFloat("530").toString()
      );
    });
    it("should round 12.211 to 13", async () => {
      const x = fixedFromFloat("12.211");
      assert.equal(
        (await instance.roundUp64x64(x)).toString(),
        fixedFromFloat("13").toString()
      );
    });
    it("should round 24.550 to 25", async () => {
      const x = fixedFromFloat("24.550");
      assert.equal(
        (await instance.roundUp64x64(x)).toString(),
        fixedFromFloat("25").toString()
      );
    });
    it("should round 1.419 to 1.5", async () => {
      const x = fixedFromFloat("1.419");
      assert.equal(
        (await instance.roundUp64x64(x)).toString(),
        fixedFromFloat("1.5").toString()
      );
    });
    it("should round 9.9994 to 10", async () => {
      const x = fixedFromFloat("9.9994");
      assert.equal(
        (await instance.roundUp64x64(x)).toString(),
        fixedFromFloat("10").toString()
      );
    });
    it("should round 0.07745 to 0.078", async () => {
      const x = fixedFromFloat("0.07745");
      assert.equal(
        (await instance.roundUp64x64(x)).toString(),
        fixedFromFloat("0.078").toString()
      );
    });
    it("should round 0.00994 to 0.01", async () => {
      const x = fixedFromFloat("0.00994");
      assert.equal(
        (await instance.roundUp64x64(x)).toString(),
        fixedFromFloat("0.01").toString()
      );
    });
    it("should round 0.0000068841 to 0.0000069", async () => {
      const x = fixedFromFloat("0.0000068841");
      assert.equal(
        (await instance.roundUp64x64(x)).toString(),
        fixedFromFloat("0.0000069").toString()
      );
    });
    it("should round 45 to 45", async () => {
      const x = fixedFromFloat("45");
      assert.equal(
        (await instance.roundUp64x64(x)).toString(),
        fixedFromFloat("45").toString()
      );
    });
  });

  describe("#roundHalfToEven64x64", () => {
    it("should revert if x == 0", async () => {
      await expect(instance.roundHalfToEven64x64(0)).to.be.reverted;
    });
    it("should round 1.0 to 1.0", async () => {
      const x = fixedFromFloat("1.0");
      assert.equal(
        (await instance.roundHalfToEven64x64(x)).toString(),
        fixedFromFloat("1.0").toString()
      );
    });
    it("should round 90.0 to 90.0", async () => {
      const x = fixedFromFloat("90.0");
      assert.equal(
        (await instance.roundHalfToEven64x64(x)).toString(),
        fixedFromFloat("90.0").toString()
      );
    });
    it("should round 4.5 to 4.5", async () => {
      const x = fixedFromFloat("4.5");
      assert.equal(
        (await instance.roundHalfToEven64x64(x)).toString(),
        fixedFromFloat("4.5").toString()
      );
    });
    it("should round 53500000000 to 54000000000", async () => {
      const x = fixedFromFloat("53500000000");
      assert.equal(
        (await instance.roundHalfToEven64x64(x)).toString(),
        fixedFromFloat("54000000000").toString()
      );
    });
    it("should round 54500000000 to 54000000000", async () => {
      const x = fixedFromFloat("54500000000");
      assert.equal(
        (await instance.roundHalfToEven64x64(x)).toString(),
        fixedFromFloat("54000000000").toString()
      );
    });
    it("should round 54510000000 to 55000000000", async () => {
      const x = fixedFromFloat("54510000000");
      assert.equal(
        (await instance.roundHalfToEven64x64(x)).toString(),
        fixedFromFloat("55000000000").toString()
      );
    });
    it("should round 9999 to 10000", async () => {
      const x = fixedFromFloat("9999");
      assert.equal(
        (await instance.roundHalfToEven64x64(x)).toString(),
        fixedFromFloat("10000").toString()
      );
    });
    it("should round 8863 to 8900", async () => {
      const x = fixedFromFloat("8863");
      assert.equal(
        (await instance.roundHalfToEven64x64(x)).toString(),
        fixedFromFloat("8900").toString()
      );
    });
    it("should round 521 to 520", async () => {
      const x = fixedFromFloat("521");
      assert.equal(
        (await instance.roundHalfToEven64x64(x)).toString(),
        fixedFromFloat("520").toString()
      );
    });
    it("should round 12.211 to 12", async () => {
      const x = fixedFromFloat("12.211");
      assert.equal(
        (await instance.roundHalfToEven64x64(x)).toString(),
        fixedFromFloat("12").toString()
      );
    });
    it("should round 24.550 to 25", async () => {
      const x = fixedFromFloat("24.550");
      assert.equal(
        (await instance.roundHalfToEven64x64(x)).toString(),
        fixedFromFloat("25").toString()
      );
    });
    it("should round 1.419 to 1.4", async () => {
      const x = fixedFromFloat("1.419");
      assert.equal(
        (await instance.roundHalfToEven64x64(x)).toString(),
        fixedFromFloat("1.4").toString()
      );
    });
    it("should round 9.9994 to 10", async () => {
      const x = fixedFromFloat("9.9994");
      assert.equal(
        (await instance.roundHalfToEven64x64(x)).toString(),
        fixedFromFloat("10").toString()
      );
    });
    it("should round 0.5 to 0.5", async () => {
      const x = fixedFromFloat("0.5");
      assert.equal(
        (await instance.roundHalfToEven64x64(x)).toString(),
        fixedFromFloat("0.5").toString()
      );
    });
    it("should round 0.45 to 0.45", async () => {
      const x = fixedFromFloat("0.45");
      assert.equal(
        (await instance.roundHalfToEven64x64(x)).toString(),
        fixedFromFloat("0.45").toString()
      );
    });
    it("should round 0.451 to 0.45", async () => {
      const x = fixedFromFloat("0.451");
      assert.equal(
        (await instance.roundHalfToEven64x64(x)).toString(),
        fixedFromFloat("0.45").toString()
      );
    });
    it("should round 0.445 to 0.44", async () => {
      const x = fixedFromFloat("0.445");
      assert.equal(
        (await instance.roundHalfToEven64x64(x)).toString(),
        fixedFromFloat("0.44").toString()
      );
    });
    it("should round 0.07745 to 0.077", async () => {
      const x = fixedFromFloat("0.07745");
      assert.equal(
        (await instance.roundHalfToEven64x64(x)).toString(),
        fixedFromFloat("0.077").toString()
      );
    });
    it("should round 0.00994 to 0.0099", async () => {
      const x = fixedFromFloat("0.00994");
      assert.equal(
        (await instance.roundHalfToEven64x64(x)).toString(),
        fixedFromFloat("0.0099").toString()
      );
    });
    it("should round 0.0000068841 to 0.0000069", async () => {
      const x = fixedFromFloat("0.0000068841");
      assert.equal(
        (await instance.roundHalfToEven64x64(x)).toString(),
        fixedFromFloat("0.0000069").toString()
      );
    });
  });
});
