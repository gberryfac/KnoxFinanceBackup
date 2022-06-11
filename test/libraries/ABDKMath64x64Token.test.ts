import { ethers } from "hardhat";

import { fixedFromFloat } from "@premia/utils";

import {
  TestABDKMath64x64Token,
  TestABDKMath64x64Token__factory,
} from "./../../types";

import { expect } from "chai";
import { assert } from "../helpers/assertions";

const decimalValues = ["0", "1", "2.718281828459045", "9223372036854775807"];

const fixedPointValues = [
  "0x00000000000000000",
  "0x10000000000000000",
  "0x2b7e151628aed1975",
  "0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF",
];

let instance: TestABDKMath64x64Token;

describe.only("ABDKMath64x64Token", () => {
  before(async () => {
    const [signer] = await ethers.getSigners();
    instance = await new TestABDKMath64x64Token__factory(signer).deploy();
  });

  describe("#ceil64x64", () => {
    it("should revert if x == 0", async () => {
      await expect(instance.ceil64x64(0)).to.be.reverted;
    });
    it("should round 1.0 to 1.0", async () => {
      const x = fixedFromFloat("1.0");
      assert.equal(
        (await instance.ceil64x64(x)).toString(),
        fixedFromFloat("1.0").toString()
      );
    });
    it("should round 90.0 to 90.0", async () => {
      const x = fixedFromFloat("90.0");
      assert.equal(
        (await instance.ceil64x64(x)).toString(),
        fixedFromFloat("90.0").toString()
      );
    });
    it("should round 53510034427 to 54000000000", async () => {
      const x = fixedFromFloat("53510034427");
      assert.equal(
        (await instance.ceil64x64(x)).toString(),
        fixedFromFloat("54000000000").toString()
      );
    });
    it("should round 53410034427 to 54000000000", async () => {
      const x = fixedFromFloat("53410034427");
      assert.equal(
        (await instance.ceil64x64(x)).toString(),
        fixedFromFloat("54000000000").toString()
      );
    });
    it("should round 24450 to 25000", async () => {
      const x = fixedFromFloat("24450");
      assert.equal(
        (await instance.ceil64x64(x)).toString(),
        fixedFromFloat("25000").toString()
      );
    });
    it("should round 9999 to 10000", async () => {
      const x = fixedFromFloat("9999");
      assert.equal(
        (await instance.ceil64x64(x)).toString(),
        fixedFromFloat("10000").toString()
      );
    });
    it("should round 8863 to 8900", async () => {
      const x = fixedFromFloat("8863");
      assert.equal(
        (await instance.ceil64x64(x)).toString(),
        fixedFromFloat("8900").toString()
      );
    });
    it("should round 521 to 530", async () => {
      const x = fixedFromFloat("521");
      assert.equal(
        (await instance.ceil64x64(x)).toString(),
        fixedFromFloat("530").toString()
      );
    });
    it("should round 12.211 to 13", async () => {
      const x = fixedFromFloat("12.211");
      assert.equal(
        (await instance.ceil64x64(x)).toString(),
        fixedFromFloat("13").toString()
      );
    });
    it("should round 24.550 to 25", async () => {
      const x = fixedFromFloat("24.550");
      assert.equal(
        (await instance.ceil64x64(x)).toString(),
        fixedFromFloat("25").toString()
      );
    });
    it("should round 1.419 to 1.5", async () => {
      const x = fixedFromFloat("1.419");
      assert.equal(
        (await instance.ceil64x64(x)).toString(),
        fixedFromFloat("1.5").toString()
      );
    });
    it("should round 9.9994 to 10", async () => {
      const x = fixedFromFloat("9.9994");
      assert.equal(
        (await instance.ceil64x64(x)).toString(),
        fixedFromFloat("10").toString()
      );
    });
    it("should round 0.07745 to 0.078", async () => {
      const x = fixedFromFloat("0.07745");
      assert.equal(
        (await instance.ceil64x64(x)).toString(),
        fixedFromFloat("0.078").toString()
      );
    });
    it("should round 0.00994 to 0.01", async () => {
      const x = fixedFromFloat("0.00994");
      assert.equal(
        (await instance.ceil64x64(x)).toString(),
        fixedFromFloat("0.01").toString()
      );
    });
    it("should round 0.0000068841 to 0.0000069", async () => {
      const x = fixedFromFloat("0.0000068841");
      assert.equal(
        (await instance.ceil64x64(x)).toString(),
        fixedFromFloat("0.0000069").toString()
      );
    });
    it("should round 45 to 45", async () => {
      const x = fixedFromFloat("45");
      assert.equal(
        (await instance.ceil64x64(x)).toString(),
        fixedFromFloat("45").toString()
      );
    });
  });

  describe("#floor64x64", () => {
    it("should round 1.0 to 1.0", async () => {
      const x = fixedFromFloat("1.0");
      assert.equal(
        (await instance.floor64x64(x)).toString(),
        fixedFromFloat("1.0").toString()
      );
    });
    it("should round 90.0 to 90.0", async () => {
      const x = fixedFromFloat("90.0");
      assert.equal(
        (await instance.floor64x64(x)).toString(),
        fixedFromFloat("90.0").toString()
      );
    });
    it("should round 53510034427 to 53000000000", async () => {
      const x = fixedFromFloat("53510034427");
      assert.equal(
        (await instance.floor64x64(x)).toString(),
        fixedFromFloat("53000000000").toString()
      );
    });
    it("should round 53410034427 to 53000000000", async () => {
      const x = fixedFromFloat("53410034427");
      assert.equal(
        (await instance.floor64x64(x)).toString(),
        fixedFromFloat("53000000000").toString()
      );
    });
    it("should round 24450 to 24000", async () => {
      const x = fixedFromFloat("24450");
      assert.equal(
        (await instance.floor64x64(x)).toString(),
        fixedFromFloat("24000").toString()
      );
    });
    it("should round 9999 to 9900", async () => {
      const x = fixedFromFloat("9999");
      assert.equal(
        (await instance.floor64x64(x)).toString(),
        fixedFromFloat("9900").toString()
      );
    });
    it("should round 8863 to 8800", async () => {
      const x = fixedFromFloat("8863");
      assert.equal(
        (await instance.floor64x64(x)).toString(),
        fixedFromFloat("8800").toString()
      );
    });
    it("should round 521 to 520", async () => {
      const x = fixedFromFloat("521");
      assert.equal(
        (await instance.floor64x64(x)).toString(),
        fixedFromFloat("520").toString()
      );
    });
    it("should round 12.211 to 12", async () => {
      const x = fixedFromFloat("12.211");
      assert.equal(
        (await instance.floor64x64(x)).toString(),
        fixedFromFloat("12").toString()
      );
    });
    it("should round 24.550 to 25", async () => {
      const x = fixedFromFloat("24.550");
      assert.equal(
        (await instance.floor64x64(x)).toString(),
        fixedFromFloat("24").toString()
      );
    });
    it("should round 1.419 to 1.4", async () => {
      const x = fixedFromFloat("1.419");
      assert.equal(
        (await instance.floor64x64(x)).toString(),
        fixedFromFloat("1.4").toString()
      );
    });
    it("should round 9.9994 to 9.9", async () => {
      const x = fixedFromFloat("9.9994");
      assert.equal(
        (await instance.floor64x64(x)).toString(),
        fixedFromFloat("9.9").toString()
      );
    });
    it("should round 0.07745 to 0.077", async () => {
      const x = fixedFromFloat("0.07745");
      assert.equal(
        (await instance.floor64x64(x)).toString(),
        fixedFromFloat("0.077").toString()
      );
    });
    it("should round 0.00994 to 0.0099", async () => {
      const x = fixedFromFloat("0.00994");
      assert.equal(
        (await instance.floor64x64(x)).toString(),
        fixedFromFloat("0.0099").toString()
      );
    });
    it("should round 0.0000068841 to 0.0000068", async () => {
      const x = fixedFromFloat("0.0000068841");
      assert.equal(
        (await instance.floor64x64(x)).toString(),
        fixedFromFloat("0.0000068").toString()
      );
    });
    it("should round 45 to 45", async () => {
      const x = fixedFromFloat("45");
      assert.equal(
        (await instance.floor64x64(x)).toString(),
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

  describe("#toDecimals", () => {
    it("returns scaled decimal representation of 64x64 fixed point number", async () => {
      for (let decimals = 0; decimals < 22; decimals++) {
        for (let fixed of fixedPointValues) {
          const bn = ethers.BigNumber.from(fixed);

          expect(await instance.toDecimals(bn, decimals)).to.equal(
            bn.mul(ethers.BigNumber.from(`1${"0".repeat(decimals)}`)).shr(64)
          );
        }
      }
    });

    describe("reverts if", () => {
      it("given 64x64 fixed point number is negative", async () => {
        for (let decimals = 0; decimals < 22; decimals++) {
          for (let fixed of fixedPointValues.filter((f) => Number(f) > 0)) {
            const bn = ethers.constants.Zero.sub(ethers.BigNumber.from(fixed));

            await expect(instance.toDecimals(bn, decimals)).to.be.reverted;
          }
        }
      });
    });
  });

  describe("#fromDecimals", () => {
    it("returns 64x64 fixed point representation of scaled decimal number", async () => {
      for (let decimals = 0; decimals < 22; decimals++) {
        for (let decimal of decimalValues) {
          const truncatedArray = decimal.match(
            new RegExp(`^\\d+(.\\d{,${decimals}})?`)
          );

          const truncated = truncatedArray?.[0] ?? "0";

          const bn = ethers.utils.parseUnits(truncated, decimals);

          expect(await instance.fromDecimals(bn, decimals)).to.equal(
            bn.shl(64).div(ethers.BigNumber.from(`1${"0".repeat(decimals)}`))
          );
        }
      }
    });

    describe("reverts if", () => {
      it("given number exceeds range of 64x64 fixed point representation", async () => {
        const max = ethers.BigNumber.from("0x7FFFFFFFFFFFFFFF");

        for (let decimals = 0; decimals < 22; decimals++) {
          const bn = max
            .add(ethers.constants.One)
            .mul(ethers.BigNumber.from(`1${"0".repeat(decimals)}`))
            .sub(ethers.constants.One);

          await expect(instance.fromDecimals(bn, decimals)).not.to.be.reverted;

          await expect(
            instance.fromDecimals(bn.add(ethers.constants.One), decimals)
          ).to.be.reverted;
        }
      });
    });
  });

  describe("#toWei", () => {
    it("returns wei representation of 64x64 fixed point number", async () => {
      for (let fixed of fixedPointValues) {
        const bn = ethers.BigNumber.from(fixed);

        expect(await instance.toWei(bn)).to.equal(
          bn.mul(ethers.BigNumber.from(`1${"0".repeat(18)}`)).shr(64)
        );
      }
    });

    describe("reverts if", () => {
      it("given 64x64 fixed point number is negative", async () => {
        for (let fixed of fixedPointValues.filter((f) => Number(f) > 0)) {
          const bn = ethers.constants.Zero.sub(ethers.BigNumber.from(fixed));

          await expect(instance.toWei(bn)).to.be.reverted;
        }
      });
    });
  });

  describe("#fromWei", () => {
    it("returns 64x64 fixed point representation of wei number", async () => {
      for (let decimal of decimalValues) {
        const bn = ethers.utils.parseEther(decimal);

        expect(await instance.fromWei(bn)).to.equal(
          bn.shl(64).div(ethers.BigNumber.from(`1${"0".repeat(18)}`))
        );
      }
    });

    describe("reverts if", () => {
      it("given wei number exceeds range of 64x64 fixed point representation", async () => {
        const max = ethers.BigNumber.from("0x7FFFFFFFFFFFFFFF");

        const bn = max
          .add(ethers.constants.One)
          .mul(ethers.BigNumber.from(`1${"0".repeat(18)}`))
          .sub(ethers.constants.One);

        await expect(instance.fromWei(bn)).not.to.be.reverted;

        await expect(instance.fromWei(bn.add(ethers.constants.One))).to.be
          .reverted;
      });
    });
  });
});
