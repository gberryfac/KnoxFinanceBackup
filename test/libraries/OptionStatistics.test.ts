import { ethers } from "hardhat";
const { parseEther } = ethers.utils;

import {
  TestOptionStatistics,
  TestOptionStatistics__factory,
} from "../../types";

import { expect } from "chai";

import { FixedPointX64 } from "web3-units";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

const POSITIVE = false;
const NEGATIVE = true;

const maxError = {
  cdf: 3.15e-3,
  centralInverseCDF: 1.16e-4,
  tailInverseCDF: 2.458e-5,
};

// array values below calculated with https://keisan.casio.com/calculator
const cdfs = {
  [-5.0]: 2.86651571879193911674e-7,
  [-2.0]: 0.02275013194817920720028,
  [-1.0]: 0.1586552539314570514148,
  [-0.9]: 0.1840601253467594885542,
  [-0.8]: 0.2118553985833966855755,
  [-0.7]: 0.2419636522230730147494,
  [-0.6]: 0.2742531177500735802944,
  [-0.5]: 0.3085375387259868963623,
  [-0.4]: 0.3445782583896758332631,
  [-0.3]: 0.3820885778110473626935,
  [-0.2]: 0.4207402905608969769576,
  [-0.1]: 0.4601721627229710185346,
  [0.0]: 0.5,
  [0.1]: 0.5398278372770289814654,
  [0.2]: 0.5792597094391030230424,
  [0.3]: 0.6179114221889526373065,
  [0.4]: 0.6554217416103241667369,
  [0.5]: 0.6914624612740131036377,
  [0.6]: 0.7257468822499264197056,
  [0.7]: 0.7580363477769269852507,
  [0.8]: 0.7881446014166033144245,
  [0.9]: 0.8159398746532405114458,
  [1.0]: 0.8413447460685429485852,
  [2.0]: 0.9772498680518207927997,
  [5.0]: 0.9999997133484281208061,
};

const icdfs = {
  [0.01]: -2.32634787404084110089,
  [0.02]: -2.053748910631823052937,
  [0.1]: -1.281551565544600466965,
  [0.2]: -0.8416212335729142051787,
  [0.3]: -0.5244005127080407840383,
  [0.4]: -0.2533471031357997987982,
  [0.5]: 0,
  [0.6]: 0.2533471031357997987982,
  [0.7]: 0.5244005127080407840383,
  [0.8]: 0.8416212335729142051787,
  [0.9]: 1.281551565544600466965,
  [0.98]: 2.053748910631823052937,
  [0.99]: 2.326347874040841100886,
};

describe.only("OptionStatistics", () => {
  let signer: SignerWithAddress;
  let instance: TestOptionStatistics;

  before(async function () {
    [signer] = await ethers.getSigners();
    instance = await new TestOptionStatistics__factory(signer).deploy();
  });

  describe("#invCDF64x64", () => {
    for (let x in icdfs) {
      const expected = +icdfs[x];
      const tolerance =
        +x > 0.975 || +x < 0.025
          ? maxError.tailInverseCDF
          : maxError.centralInverseCDF;

      it(`value of ${x} equals ${expected}`, async function () {
        const value = await instance.invCDF64x64(parseEther(x), POSITIVE);
        const actual = new FixedPointX64(value).parsed;
        expect(expected).to.be.closeTo(actual, tolerance);
      });
    }

    it("should revert values less than or equal to 0", async () => {
      await expect(
        instance.invCDF64x64(parseEther("100"), NEGATIVE)
      ).to.be.revertedWith("InverseOutOfBounds");
      await expect(
        instance.invCDF64x64(parseEther("0.001"), NEGATIVE)
      ).to.be.revertedWith("InverseOutOfBounds");
      await expect(
        instance.invCDF64x64(parseEther("0.0"), POSITIVE)
      ).to.be.revertedWith("InverseOutOfBounds");
    });

    it("should revert values greater than or equal to 1", async function () {
      await expect(
        instance.invCDF64x64(parseEther("1"), POSITIVE)
      ).to.be.revertedWith("InverseOutOfBounds");
      await expect(
        instance.invCDF64x64(parseEther("1.001"), POSITIVE)
      ).to.be.revertedWith("InverseOutOfBounds");
      await expect(
        instance.invCDF64x64(parseEther("100"), POSITIVE)
      ).to.be.revertedWith("InverseOutOfBounds");
    });
  });
});
