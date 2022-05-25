import { ethers } from "hardhat";
import { BigNumber, Contract } from "ethers";
const { parseUnits } = ethers.utils;

import { expect } from "chai";
import { assert } from "../helpers/assertions";


describe.only("VaultDisplay", () => {

  let vaultDisplay;
  let shareMath;

  before(async () => {

    shareMath = await ethers.getContractFactory("TestShareMath").then((contract) =>
      contract.deploy()
    );

    const displayLib = await ethers.getContractFactory("VaultDisplay").then((contract) =>
      contract.deploy()
    );

    vaultDisplay = await ethers.getContractFactory(
      "TestVaultDisplay",
      { libraries: { VaultDisplay: displayLib.address } }
    ).then((contract) =>
      contract.deploy()
    );
  });

  describe("#lpShareBalances", () => {
    it("should return (balance, 0) when receipt round is invalid", async () => {
      const round = 1;
      const decimals = 8;
      const amount = parseUnits("1", decimals);
      const unredeemedShares = parseUnits("2", decimals);
      const assetPerShare = parseUnits("3", decimals);
      const depositReceipt = {
        round: 0,
        amount: amount,
        unredeemedShares: unredeemedShares,
      };

      const [accountBal, vaultBal] = await vaultDisplay.lpShareBalances(
        round,
        decimals,
        amount,
        depositReceipt
      );

      assert.bnEqual(accountBal, amount);
      assert.bnEqual(vaultBal, BigNumber.from("0"));
    });

    it("should return (balance, unreedemedShares) when receipt round is current", async () => {
      const round = 1;
      const decimals = 8;
      const amount = parseUnits("1", decimals);
      const unredeemedShares = parseUnits("2", decimals);
      const assetPerShare = parseUnits("2", decimals);

      const depositReceipt = {
        round: 1,
        amount: amount,
        unredeemedShares: unredeemedShares,
      };
      await vaultDisplay.setLpTokenPricePerShare(round, assetPerShare);

      const [accountBal, vaultBal] = await vaultDisplay.lpShareBalances(
        round,
        decimals,
        amount,
        depositReceipt
      );

      assert.bnEqual(accountBal, amount);
      assert.bnEqual(vaultBal, unredeemedShares);
    });

    it("should return (balance, sharesFromReceipt) when receipt round is a previous round", async () => {
      const round = 2;
      const decimals = 8;
      const amount = parseUnits("1", decimals);
      const unredeemedShares = parseUnits("2", decimals);
      const assetPerShare = parseUnits("3", decimals);

      const depositReceipt = {
        round: 1,
        amount: amount,
        unredeemedShares: unredeemedShares,
      };
      await vaultDisplay.setLpTokenPricePerShare(1, assetPerShare);

      const sharesFromReceipt = await shareMath.getSharesFromReceipt(
        depositReceipt,
        round,
        assetPerShare,
        decimals
      );

      const [accountBal, vaultBal] = await vaultDisplay.lpShareBalances(
        round,
        decimals,
        amount,
        depositReceipt
      );

      assert.bnEqual(accountBal, amount);
      assert.bnEqual(vaultBal, sharesFromReceipt);
    });
  });
});
