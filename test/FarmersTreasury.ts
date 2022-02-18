import hre from "hardhat";
import { expect } from "chai";
import * as time from "./helpers/time";

import { FarmersTreasury } from "./../types/FarmersTreasury";
import { TestERC20 } from "./../types/TestERC20";
import { parseLogs } from "./helpers/utils";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

const { getContractFactory } = hre.ethers;
const { parseUnits } = hre.ethers.utils;

describe.only("Farmers Treasury", () => {
  let signer: SignerWithAddress;
  let signer2: SignerWithAddress;
  let treasury: FarmersTreasury;
  let depositedToken: TestERC20;
  let initSnapshotId: string;

  before(async function () {
    await hre.ethers.provider.send("evm_mine", []);
    let block = await hre.ethers.provider.getBlock(
      await hre.ethers.provider.getBlockNumber()
    );
    [signer, signer2] = await hre.ethers.getSigners();
    let factoryERC20 = await getContractFactory("TestERC20");
    let factoryFarmersTreasury = await getContractFactory("FarmersTreasury");
    depositedToken = (await factoryERC20.deploy(
      "TestToken",
      "TT",
      parseUnits("1", "ether")
    )) as TestERC20;
    await depositedToken.transfer(signer2.address, parseUnits("500", "finney"));
    treasury = (await factoryFarmersTreasury.deploy(
      depositedToken.address,
      block.timestamp,
      signer2.address
    )) as FarmersTreasury;
  });

  describe("initial state", async () => {
    it("should have epoch number equal to -1", async () => {
      let epochNumber = await treasury.currentEpoch();
      expect(epochNumber).to.be.equal(-1);
    });
  });

  describe("withdraw", () => {
    describe("in the same epoch", () => {
      beforeEach(async () => {
        initSnapshotId = await hre.ethers.provider.send("evm_snapshot", []);
        await depositedToken.approve(
          treasury.address,
          parseUnits("2000", "gwei")
        );
        await treasury.deposit(parseUnits("1000", "gwei"));
        await treasury.connect(signer2).createNewEpoch();
        let start = await treasury.currentEpochStart();
        await time.increaseTo(start.add(1));
        await treasury
          .connect(signer2)
          .trustedBorrow(parseUnits("1000", "gwei"));
        await treasury.deposit(parseUnits("900", "gwei"));
      });

      it("should immediately withdraw sum equal this epoch deposit", async () => {
        let balanceBefore = await depositedToken.balanceOf(signer.address);
        let tx = await treasury.withdraw(parseUnits("900", "gwei"));
        await tx.wait();
        let balanceAfter = await depositedToken.balanceOf(signer.address);
        expect(
          balanceBefore.add(parseUnits("900", "gwei")).toString()
        ).to.be.equal(balanceAfter.toString());
      });

      it("should immediately withdraw sum smaller than this epoch deposit", async () => {
        let balanceBefore = await depositedToken.balanceOf(signer.address);
        let tx = await treasury.withdraw(parseUnits("800", "gwei"));
        await tx.wait();
        let balanceAfter = await depositedToken.balanceOf(signer.address);
        expect(
          balanceBefore.add(parseUnits("800", "gwei")).toString()
        ).to.be.equal(balanceAfter.toString());
      });

      it("should only withdraw waiting amount and schedule rest if withdraw is bigger than epoch deposit", async () => {
        let balanceBefore = await depositedToken.balanceOf(signer.address);
        let tx = await treasury.withdraw(parseUnits("1000", "gwei"));
        await tx.wait();
        let balanceAfter = await depositedToken.balanceOf(signer.address);
        expect(
          balanceBefore.add(parseUnits("900", "gwei")).toString()
        ).to.be.equal(balanceAfter.toString());
        let data = await treasury.farmers(signer.address);
        expect(data.waitingAmount.toNumber()).to.be.equal(-100);
      });

      afterEach(async () => {
        await hre.ethers.provider.send("evm_revert", [initSnapshotId]);
      });
    });

    describe("in next epoch", () => {
      beforeEach(async () => {
        initSnapshotId = await hre.ethers.provider.send("evm_snapshot", []);
        await depositedToken.approve(
          treasury.address,
          parseUnits("2000", "gwei")
        );
        await depositedToken
          .connect(signer2)
          .approve(treasury.address, parseUnits("5000", "gwei"));
        await treasury.deposit(parseUnits("1000", "gwei"));
        //console.log("DEP 1000");
        await treasury.connect(signer2).createNewEpoch();
        let start = await treasury.currentEpochStart();
        await time.increaseTo(start.add(1));
        await treasury
          .connect(signer2)
          .trustedBorrow(parseUnits("1000", "gwei"));
        await treasury.deposit(parseUnits("900", "gwei"));
        //console.log("DEP 900");
        await treasury
          .connect(signer2)
          .trustedRepay(parseUnits("1200", "gwei"));
        await treasury.connect(signer2).createNewEpoch();
      });

      afterEach(async () => {
        await hre.ethers.provider.send("evm_revert", [initSnapshotId]);
      });

      it("should schedule withdrawal without payout", async () => {
        let balanceBefore = await depositedToken.balanceOf(signer.address);
        let tx = await treasury.withdraw(parseUnits("900", "gwei"));
        await tx.wait();
        let balanceAfter = await depositedToken.balanceOf(signer.address);
        expect(balanceBefore.toString()).to.be.equal(balanceAfter.toString());
        let farmerDataAfter = await treasury.farmers(signer.address);
        expect(farmerDataAfter.waitingAmount).to.be.equal(-900);
      });

      it("should withdraw after re-request in new epoch", async () => {
        let balanceBefore = await depositedToken.balanceOf(signer.address);
        let tx = await treasury.withdraw(parseUnits("900", "gwei"));
        await tx.wait();
        await treasury.connect(signer2).createNewEpoch();
        await treasury.withdraw(0);
        let balanceAfter = await depositedToken.balanceOf(signer.address);
        expect(
          balanceBefore.add(parseUnits("900", "gwei")).toString()
        ).to.be.equal(balanceAfter.toString());
        let farmerDataAfter = await treasury.farmers(signer.address);
        expect(farmerDataAfter.waitingAmount).to.be.equal(0);
      });
    });

    describe("between epochs", () => {
      beforeEach(async () => {
        initSnapshotId = await hre.ethers.provider.send("evm_snapshot", []);
      });

      afterEach(async () => {
        await hre.ethers.provider.send("evm_revert", [initSnapshotId]);
      });
    });
  });

  describe("deposit", () => {
    beforeEach(async () => {
      initSnapshotId = await hre.ethers.provider.send("evm_snapshot", []);
    });

    afterEach(async () => {
      await hre.ethers.provider.send("evm_revert", [initSnapshotId]);
    });

    it("should fail if called without approval", async function () {
      let tx = treasury.deposit(1000);
      await expect(tx).to.be.revertedWith(
        "ERC20: transfer amount exceeds allowance"
      );
    });

    it("should succed if approval is set", async function () {
      await depositedToken.approve(
        treasury.address,
        parseUnits("1000", "gwei")
      );
      await treasury.deposit(parseUnits("1000", "gwei"));
    });

    it("should change farmer waiting deposit", async () => {
      let farmersDataBefore = await treasury.farmers(signer.address);
      await depositedToken.approve(
        treasury.address,
        parseUnits("1000", "gwei")
      );
      let tx = await treasury.deposit(parseUnits("1000", "gwei"));
      await tx.wait();
      let farmersDataAfter = await treasury.farmers(signer.address);
      expect(farmersDataAfter.waitingAmount.toNumber()).to.be.equal(
        farmersDataBefore.waitingAmount.add(1000).toNumber()
      );
    });

    it("should change total waiting amount by same value", async () => {
      let totalWaitingBefore = await treasury.totalWaitingAmount();
      await depositedToken.approve(
        treasury.address,
        parseUnits("1000", "gwei")
      );
      let tx = await treasury.deposit(parseUnits("1000", "gwei"));
      await tx.wait();
      let totalWaitingAfter = await treasury.totalWaitingAmount();
      expect(totalWaitingAfter.toNumber()).to.be.equal(
        totalWaitingBefore.add(1000).toNumber()
      );
    });

    it("should not change total available amount", async () => {
      let totalWaitingBefore = await treasury.totalAvailableAmount();
      await depositedToken.approve(
        treasury.address,
        parseUnits("1000", "gwei")
      );
      let tx = await treasury.deposit(parseUnits("1000", "gwei"));
      await tx.wait();
      let totalWaitingAfter = await treasury.totalAvailableAmount();
      expect(totalWaitingAfter.toNumber()).to.be.equal(
        totalWaitingBefore.toNumber()
      );
    });

    it("should increase treasury token balance", async () => {
      let balanceBefore = await depositedToken.balanceOf(treasury.address);
      await depositedToken.approve(
        treasury.address,
        parseUnits("1000", "gwei")
      );
      let tx = await treasury.deposit(parseUnits("1000", "gwei"));
      await tx.wait();
      let balanceAfter = await depositedToken.balanceOf(treasury.address);
      expect(balanceBefore.toNumber()).to.be.equal(
        balanceAfter.sub(parseUnits("1000", "gwei")).toNumber()
      );
    });

    it("should decrease users token balance", async () => {
      let balanceBefore = await depositedToken.balanceOf(signer.address);
      await depositedToken.approve(
        treasury.address,
        parseUnits("1000", "gwei")
      );
      let tx = await treasury.deposit(parseUnits("1000", "gwei"));
      await tx.wait();
      let balanceAfter = await depositedToken.balanceOf(signer.address);
      expect(balanceAfter.toString()).to.be.equal(
        balanceBefore.sub(parseUnits("1000", "gwei")).toString()
      );
    });

    describe("epoch -1", async () => {
      beforeEach(async () => {
        initSnapshotId = await hre.ethers.provider.send("evm_snapshot", []);
      });

      afterEach(async () => {
        await hre.ethers.provider.send("evm_revert", [initSnapshotId]);
      });

      it("should not sync farmer", async () => {
        await depositedToken.approve(
          treasury.address,
          parseUnits("1000", "gwei")
        );
        let tx = await treasury.deposit(parseUnits("1000", "gwei"));
        let receipt = await tx.wait();
        let events = await parseLogs("FarmersTreasury", receipt.events);
        expect(
          events.filter((x) => x.name === "FarmerSynced").length
        ).to.be.equal(0);
      });

      it("should emit deposit event", async () => {
        await depositedToken.approve(
          treasury.address,
          parseUnits("1000", "gwei")
        );
        let tx = await treasury.deposit(parseUnits("1000", "gwei"));
        let receipt = await tx.wait();
        let events = await parseLogs("FarmersTreasury", receipt.events);
        expect(
          events.filter((x) => x.name === "FundsDeposited").length
        ).to.be.equal(1);
      });
    });

    describe("epoch > -1", async () => {
      beforeEach(async () => {
        initSnapshotId = await hre.ethers.provider.send("evm_snapshot", []);
        await treasury.connect(signer2).createNewEpoch();
      });

      afterEach(async () => {
        await hre.ethers.provider.send("evm_revert", [initSnapshotId]);
      });

      it("should sync farmer", async () => {
        await depositedToken.approve(
          treasury.address,
          parseUnits("1000", "gwei")
        );
        let tx = await treasury.deposit(parseUnits("1000", "gwei"));
        let receipt = await tx.wait();
        let events = await parseLogs("FarmersTreasury", receipt.events);
        expect(
          events.filter((x) => x.name === "FarmerSynced").length
        ).to.be.equal(1);
      });

      it("should emit deposit event", async () => {
        await depositedToken.approve(
          treasury.address,
          parseUnits("1000", "gwei")
        );
        let tx = await treasury.deposit(parseUnits("1000", "gwei"));
        let receipt = await tx.wait();
        let events = await parseLogs("FarmersTreasury", receipt.events);
        expect(
          events.filter((x) => x.name === "FundsDeposited").length
        ).to.be.equal(1);
      });
    });
  });
});
