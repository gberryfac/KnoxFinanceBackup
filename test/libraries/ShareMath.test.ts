import { ethers } from "hardhat";
import { Contract } from "ethers";
const { parseUnits } = ethers.utils;

import { expect } from "chai";
import { assert } from "../helpers/assertions";

let shareMath: Contract;

describe.only("ShareMath", () => {
  before(async () => {
    const TestShareMath = await ethers.getContractFactory("TestShareMath");
    shareMath = await TestShareMath.deploy();
  });

  describe("#sharesToAsset", () => {
    it("reverts if assetPerShare is less than 1", async () => {
      const shares = parseUnits("1", 8);
      await expect(shareMath.sharesToAsset(shares, 0, 8)).to.be.revertedWith(
        "share-math/invalid-assetPerShare"
      );
    });

    it("calculates the correct number", async () => {
      const decimals = 8;
      const shares = parseUnits("1", decimals);
      const pps = parseUnits("2", decimals);

      assert.bnEqual(
        await shareMath.sharesToAsset(shares, pps, decimals),
        parseUnits("2", decimals)
      );
    });
  });

  describe("#assetToShares", () => {
    it("reverts if assetPerShare is less than 1", async () => {
      const shares = parseUnits("1", 8);
      await expect(shareMath.assetToShares(shares, 0, 8)).to.be.revertedWith(
        "share-math/invalid-assetPerShare"
      );
    });

    it("calculates the correct number", async () => {
      const decimals = 8;
      const underlyingAmount = parseUnits("1", decimals);
      const pps = parseUnits("2", decimals);

      assert.bnEqual(
        await shareMath.assetToShares(underlyingAmount, pps, decimals),
        parseUnits("0.5", decimals)
      );
    });
  });

  describe("#getSharesFromReceipt", () => {
    it("calculates the undredeemed shares only", async () => {
      const decimals = 8;
      const amount = parseUnits("1", decimals);
      const unredeemedShares = parseUnits("1", decimals);

      const depositReceipt = {
        round: 0,
        amount: amount,
        unredeemedShares: unredeemedShares,
      };
      const assetPerShare = parseUnits("2", decimals);

      assert.bnEqual(
        await shareMath.getSharesFromReceipt(
          depositReceipt,
          1,
          assetPerShare,
          decimals
        ),
        unredeemedShares
      );
    });

    it("calculates the undredeemed shares only", async () => {
      const decimals = 8;
      const amount = parseUnits("1", decimals);
      const unredeemedShares = parseUnits("1", decimals);

      const depositReceipt = {
        round: 2,
        amount: amount,
        unredeemedShares: unredeemedShares,
      };
      const assetPerShare = parseUnits("2", decimals);

      assert.bnEqual(
        await shareMath.getSharesFromReceipt(
          depositReceipt,
          1,
          assetPerShare,
          decimals
        ),
        unredeemedShares
      );
    });

    it("calculates the undredeemed shares and shares from round", async () => {
      const decimals = 8;
      const amount = parseUnits("1", decimals);
      const unredeemedShares = parseUnits("1", decimals);

      const depositReceipt = {
        round: 1,
        amount: amount,
        unredeemedShares: unredeemedShares,
      };
      const assetPerShare = parseUnits("2", decimals);

      assert.bnEqual(
        await shareMath.getSharesFromReceipt(
          depositReceipt,
          2,
          assetPerShare,
          decimals
        ),
        parseUnits("1.5", decimals)
      );
    });
  });

  describe("#pricePerShare", () => {
    it("calculates pps if total supply <= 0", async () => {
      const decimals = 8;
      const totalBalance = parseUnits("1", decimals);
      const pendingBalance = parseUnits("0.5", decimals);

      assert.bnEqual(
        await shareMath.pricePerShare(
          0,
          totalBalance,
          pendingBalance,
          decimals
        ),
        parseUnits("1", decimals)
      );
    });

    it("calculates pps if total supply > 0", async () => {
      const decimals = 8;
      const totalSupply = parseUnits("1", decimals);
      const totalBalance = parseUnits("1", decimals);
      const pendingBalance = parseUnits("0.5", decimals);

      assert.bnEqual(
        await shareMath.pricePerShare(
          totalSupply,
          totalBalance,
          pendingBalance,
          decimals
        ),
        parseUnits("0.5", decimals)
      );
    });
  });
});
