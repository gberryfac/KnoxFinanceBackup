import hre from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import { KnoxVault } from "./../types/KnoxVault";
import { TestERC20 } from "./../types/TestERC20";
import { parseLogs } from "./helpers/utils";
import * as time from "./helpers/time";

const { getContractFactory } = hre.ethers;
const { parseUnits } = hre.ethers.utils;

describe.only("Knox Vault", () => {
  let deployer: SignerWithAddress;
  let farmer: SignerWithAddress;
  let strategy: SignerWithAddress;
  let vault: KnoxVault;
  let depositedToken: TestERC20;
  let initSnapshotId: string;

  before(async function () {
    await hre.ethers.provider.send("evm_mine", []);
    let block = await hre.ethers.provider.getBlock(
      await hre.ethers.provider.getBlockNumber()
    );
    [deployer, farmer, strategy] = await hre.ethers.getSigners();
    let factoryERC20 = await getContractFactory("TestERC20");
    let factoryKnoxVault = await getContractFactory("KnoxVault");
    depositedToken = (await factoryERC20.deploy(
      "TestToken",
      "TT",
      parseUnits("1", "ether")
    )) as TestERC20;
    await depositedToken.transfer(farmer.address, parseUnits("500", "finney"));
    vault = (await factoryKnoxVault.deploy(
      strategy.address,
      depositedToken.address
    )) as KnoxVault;
  });

  describe("initial state", async () => {
    it("should have epoch number equal to -1", async () => {
      let epochNumber = await vault.currentEpoch();
      expect(epochNumber).to.be.equal(-1);
    });
  });

  describe("", () => {
    describe("", () => {
      beforeEach(async () => {
        initSnapshotId = await hre.ethers.provider.send("evm_snapshot", []);
        await depositedToken.approve(vault.address, parseUnits("2000", "gwei"));
        await vault.deposit(parseUnits("1000", "gwei"));
        // await vault.connect(farmer).createNewEpoch();
        // let start = await vault.currentEpochStart();
        // await time.increaseTo(start.add(1));
        // await vault.connect(farmer).trustedBorrow(parseUnits("1000", "gwei"));
        // await vault.deposit(parseUnits("900", "gwei"));
      });
    });
  });

  //   describe("withdraw", () => {
  //     describe("in the same epoch", () => {
  //       beforeEach(async () => {
  //         initSnapshotId = await hre.ethers.provider.send("evm_snapshot", []);
  //         await depositedToken.approve(vault.address, parseUnits("2000", "gwei"));
  //         await vault.deposit(parseUnits("1000", "gwei"));
  //         await vault.connect(farmer).createNewEpoch();
  //         let start = await vault.currentEpochStart();
  //         await time.increaseTo(start.add(1));
  //         await vault.connect(farmer).trustedBorrow(parseUnits("1000", "gwei"));
  //         await vault.deposit(parseUnits("900", "gwei"));
  //       });

  //       it("should immediately withdraw sum equal this epoch deposit", async () => {
  //         let balanceBefore = await depositedToken.balanceOf(deployer.address);
  //         let tx = await vault.withdraw(parseUnits("900", "gwei"));
  //         await tx.wait();
  //         let balanceAfter = await depositedToken.balanceOf(deployer.address);
  //         expect(
  //           balanceBefore.add(parseUnits("900", "gwei")).toString()
  //         ).to.be.equal(balanceAfter.toString());
  //       });

  //       it("should immediately withdraw sum smaller than this epoch deposit", async () => {
  //         let balanceBefore = await depositedToken.balanceOf(deployer.address);
  //         let tx = await vault.withdraw(parseUnits("800", "gwei"));
  //         await tx.wait();
  //         let balanceAfter = await depositedToken.balanceOf(deployer.address);
  //         expect(
  //           balanceBefore.add(parseUnits("800", "gwei")).toString()
  //         ).to.be.equal(balanceAfter.toString());
  //       });

  //       it("should only withdraw waiting amount and schedule rest if withdraw is bigger than epoch deposit", async () => {
  //         let balanceBefore = await depositedToken.balanceOf(deployer.address);
  //         let tx = await vault.withdraw(parseUnits("1000", "gwei"));
  //         await tx.wait();
  //         let balanceAfter = await depositedToken.balanceOf(deployer.address);
  //         expect(
  //           balanceBefore.add(parseUnits("900", "gwei")).toString()
  //         ).to.be.equal(balanceAfter.toString());
  //         let data = await vault.farmers(deployer.address);
  //         expect(data.waitingAmount.toNumber()).to.be.equal(-100);
  //       });

  //       afterEach(async () => {
  //         await hre.ethers.provider.send("evm_revert", [initSnapshotId]);
  //       });
  //     });

  //     describe("in next epoch", () => {
  //       beforeEach(async () => {
  //         initSnapshotId = await hre.ethers.provider.send("evm_snapshot", []);
  //         await depositedToken.approve(vault.address, parseUnits("2000", "gwei"));
  //         await depositedToken
  //           .connect(farmer)
  //           .approve(vault.address, parseUnits("5000", "gwei"));
  //         await vault.deposit(parseUnits("1000", "gwei"));
  //         //console.log("DEP 1000");
  //         await vault.connect(farmer).createNewEpoch();
  //         let start = await vault.currentEpochStart();
  //         await time.increaseTo(start.add(1));
  //         await vault.connect(farmer).trustedBorrow(parseUnits("1000", "gwei"));
  //         await vault.deposit(parseUnits("900", "gwei"));
  //         //console.log("DEP 900");
  //         await vault.connect(farmer).trustedRepay(parseUnits("1200", "gwei"));
  //         await vault.connect(farmer).createNewEpoch();
  //       });

  //       afterEach(async () => {
  //         await hre.ethers.provider.send("evm_revert", [initSnapshotId]);
  //       });

  //       it("should schedule withdrawal without payout", async () => {
  //         let balanceBefore = await depositedToken.balanceOf(deployer.address);
  //         let tx = await vault.withdraw(parseUnits("900", "gwei"));
  //         await tx.wait();
  //         let balanceAfter = await depositedToken.balanceOf(deployer.address);
  //         expect(balanceBefore.toString()).to.be.equal(balanceAfter.toString());
  //         let farmerDataAfter = await vault.farmers(deployer.address);
  //         expect(farmerDataAfter.waitingAmount).to.be.equal(-900);
  //       });

  //       it("should withdraw after re-request in new epoch", async () => {
  //         let balanceBefore = await depositedToken.balanceOf(deployer.address);
  //         let tx = await vault.withdraw(parseUnits("900", "gwei"));
  //         await tx.wait();
  //         await vault.connect(farmer).createNewEpoch();
  //         await vault.withdraw(0);
  //         let balanceAfter = await depositedToken.balanceOf(deployer.address);
  //         expect(
  //           balanceBefore.add(parseUnits("900", "gwei")).toString()
  //         ).to.be.equal(balanceAfter.toString());
  //         let farmerDataAfter = await vault.farmers(deployer.address);
  //         expect(farmerDataAfter.waitingAmount).to.be.equal(0);
  //       });
  //     });

  //     describe("between epochs", () => {
  //       beforeEach(async () => {
  //         initSnapshotId = await hre.ethers.provider.send("evm_snapshot", []);
  //       });

  //       afterEach(async () => {
  //         await hre.ethers.provider.send("evm_revert", [initSnapshotId]);
  //       });
  //     });
  //   });

  //   describe("deposit", () => {
  //     beforeEach(async () => {
  //       initSnapshotId = await hre.ethers.provider.send("evm_snapshot", []);
  //     });

  //     afterEach(async () => {
  //       await hre.ethers.provider.send("evm_revert", [initSnapshotId]);
  //     });

  //     it("should fail if called without approval", async function () {
  //       let tx = vault.deposit(1000);
  //       await expect(tx).to.be.revertedWith(
  //         "ERC20: transfer amount exceeds allowance"
  //       );
  //     });

  //     it("should succed if approval is set", async function () {
  //       await depositedToken.approve(vault.address, parseUnits("1000", "gwei"));
  //       await vault.deposit(parseUnits("1000", "gwei"));
  //     });

  //     it("should change farmer waiting deposit", async () => {
  //       let farmersDataBefore = await vault.farmers(deployer.address);
  //       await depositedToken.approve(vault.address, parseUnits("1000", "gwei"));
  //       let tx = await vault.deposit(parseUnits("1000", "gwei"));
  //       await tx.wait();
  //       let farmersDataAfter = await vault.farmers(deployer.address);
  //       expect(farmersDataAfter.waitingAmount.toNumber()).to.be.equal(
  //         farmersDataBefore.waitingAmount.add(1000).toNumber()
  //       );
  //     });

  //     it("should change total waiting amount by same value", async () => {
  //       let totalWaitingBefore = await vault.totalWaitingAmount();
  //       await depositedToken.approve(vault.address, parseUnits("1000", "gwei"));
  //       let tx = await vault.deposit(parseUnits("1000", "gwei"));
  //       await tx.wait();
  //       let totalWaitingAfter = await vault.totalWaitingAmount();
  //       expect(totalWaitingAfter.toNumber()).to.be.equal(
  //         totalWaitingBefore.add(1000).toNumber()
  //       );
  //     });

  //     it("should not change total available amount", async () => {
  //       let totalWaitingBefore = await vault.totalAvailableAmount();
  //       await depositedToken.approve(vault.address, parseUnits("1000", "gwei"));
  //       let tx = await vault.deposit(parseUnits("1000", "gwei"));
  //       await tx.wait();
  //       let totalWaitingAfter = await vault.totalAvailableAmount();
  //       expect(totalWaitingAfter.toNumber()).to.be.equal(
  //         totalWaitingBefore.toNumber()
  //       );
  //     });

  //     it("should increase vault token balance", async () => {
  //       let balanceBefore = await depositedToken.balanceOf(vault.address);
  //       await depositedToken.approve(vault.address, parseUnits("1000", "gwei"));
  //       let tx = await vault.deposit(parseUnits("1000", "gwei"));
  //       await tx.wait();
  //       let balanceAfter = await depositedToken.balanceOf(vault.address);
  //       expect(balanceBefore.toNumber()).to.be.equal(
  //         balanceAfter.sub(parseUnits("1000", "gwei")).toNumber()
  //       );
  //     });

  //     it("should decrease users token balance", async () => {
  //       let balanceBefore = await depositedToken.balanceOf(deployer.address);
  //       await depositedToken.approve(vault.address, parseUnits("1000", "gwei"));
  //       let tx = await vault.deposit(parseUnits("1000", "gwei"));
  //       await tx.wait();
  //       let balanceAfter = await depositedToken.balanceOf(deployer.address);
  //       expect(balanceAfter.toString()).to.be.equal(
  //         balanceBefore.sub(parseUnits("1000", "gwei")).toString()
  //       );
  //     });

  //     describe("epoch -1", async () => {
  //       beforeEach(async () => {
  //         initSnapshotId = await hre.ethers.provider.send("evm_snapshot", []);
  //       });

  //       afterEach(async () => {
  //         await hre.ethers.provider.send("evm_revert", [initSnapshotId]);
  //       });

  //       it("should not sync farmer", async () => {
  //         await depositedToken.approve(vault.address, parseUnits("1000", "gwei"));
  //         let tx = await vault.deposit(parseUnits("1000", "gwei"));
  //         let receipt = await tx.wait();
  //         let events = await parseLogs("KnoxVault", receipt.events);
  //         expect(
  //           events.filter((x) => x.name === "FarmerSynced").length
  //         ).to.be.equal(0);
  //       });

  //       it("should emit deposit event", async () => {
  //         await depositedToken.approve(vault.address, parseUnits("1000", "gwei"));
  //         let tx = await vault.deposit(parseUnits("1000", "gwei"));
  //         let receipt = await tx.wait();
  //         let events = await parseLogs("KnoxVault", receipt.events);
  //         expect(
  //           events.filter((x) => x.name === "FundsDeposited").length
  //         ).to.be.equal(1);
  //       });
  //     });

  //     describe("epoch > -1", async () => {
  //       beforeEach(async () => {
  //         initSnapshotId = await hre.ethers.provider.send("evm_snapshot", []);
  //         await vault.connect(farmer).createNewEpoch();
  //       });

  //       afterEach(async () => {
  //         await hre.ethers.provider.send("evm_revert", [initSnapshotId]);
  //       });

  //       it("should sync farmer", async () => {
  //         await depositedToken.approve(vault.address, parseUnits("1000", "gwei"));
  //         let tx = await vault.deposit(parseUnits("1000", "gwei"));
  //         let receipt = await tx.wait();
  //         let events = await parseLogs("KnoxVault", receipt.events);
  //         expect(
  //           events.filter((x) => x.name === "FarmerSynced").length
  //         ).to.be.equal(1);
  //       });

  //       it("should emit deposit event", async () => {
  //         await depositedToken.approve(vault.address, parseUnits("1000", "gwei"));
  //         let tx = await vault.deposit(parseUnits("1000", "gwei"));
  //         let receipt = await tx.wait();
  //         let events = await parseLogs("KnoxVault", receipt.events);
  //         expect(
  //           events.filter((x) => x.name === "FundsDeposited").length
  //         ).to.be.equal(1);
  //       });
  //     });
  // });
});
