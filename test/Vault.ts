import hre from "hardhat";
import { expect } from "chai";
import * as time from "./helpers/time";

import { Vault } from "./../types/Vault";
import { TestERC20 } from "../types/TestERC20";
import { parseLogs, depositToVault } from "./helpers/utils";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

const { getContractFactory } = hre.ethers;
const { parseUnits } = hre.ethers.utils;

describe.only("Knox Vault", () => {
  let deployer: SignerWithAddress;
  let farmer: SignerWithAddress;
  let controller: SignerWithAddress;
  let vault: Vault;
  let baseToken: TestERC20;
  let initSnapshotId: string;

  before(async () => {
    await hre.ethers.provider.send("evm_mine", []);
    let block = await hre.ethers.provider.getBlock(
      await hre.ethers.provider.getBlockNumber()
    );

    [deployer, farmer, controller] = await hre.ethers.getSigners();

    let factoryERC20 = await getContractFactory("TestERC20");
    let factoryFarmersTreasury = await getContractFactory("Vault");

    baseToken = (await factoryERC20.deploy(
      "TestToken",
      "TT",
      parseUnits("1", "ether")
    )) as TestERC20;

    await baseToken.transfer(farmer.address, parseUnits("500", "finney"));

    vault = (await factoryFarmersTreasury.deploy(
      baseToken.address,
      block.timestamp,
      controller.address
    )) as Vault;
  });

  describe("initial state", async () => {
    it("should have epoch number equal to -1", async () => {
      let epochNumber = await vault.currentEpoch();
      expect(epochNumber).to.be.equal(-1);
    });
  });

  describe("deposit", () => {
    // beforeEach(async () => {
    //   initSnapshotId = await hre.ethers.provider.send("evm_snapshot", []);
    // });

    // afterEach(async () => {
    //   await hre.ethers.provider.send("evm_revert", [initSnapshotId]);
    // });

    // it("should fail if called without approval", async () => {
    //   let tx = vault.deposit(1000);
    //   await expect(tx).to.be.revertedWith("ERC20: insufficient allowance");
    // });

    // it("should succeed if approval is set", async () => {
    //   await depositToVault(vault, baseToken, farmer, "1000");
    // });

    // it("should change farmer waiting deposit", async () => {
    //   let farmersDataBefore = await vault.depositors(farmer.address);

    //   await depositToVault(vault, baseToken, farmer, "1000");

    //   let farmersDataAfter = await vault.depositors(farmer.address);

    //   expect(farmersDataAfter.waitingAmount.toNumber()).to.be.equal(
    //     farmersDataBefore.waitingAmount.add(1000).toNumber()
    //   );
    // });

    // it("should update farmer waiting deposit", async () => {
    //   let farmersDataBefore = await vault.depositors(farmer.address);

    //   await depositToVault(vault, baseToken, farmer, "1000");
    //   await depositToVault(vault, baseToken, farmer, "1000");

    //   let farmersDataAfter = await vault.depositors(farmer.address);

    //   expect(farmersDataAfter.waitingAmount.toNumber()).to.be.equal(
    //     farmersDataBefore.waitingAmount.add(2000).toNumber()
    //   );
    // });

    // it("should update correct farmer waiting deposit", async () => {
    //   let farmersDataBefore = await vault.depositors(farmer.address);
    //   let deployerDataBefore = await vault.depositors(deployer.address);

    //   await depositToVault(vault, baseToken, farmer, "1000");
    //   await depositToVault(vault, baseToken, deployer, "1000");
    //   await depositToVault(vault, baseToken, farmer, "1000");

    //   let farmersDataAfter = await vault.depositors(farmer.address);
    //   let deployerDataAfter = await vault.depositors(deployer.address);

    //   expect(farmersDataAfter.waitingAmount.toNumber()).to.be.equal(
    //     farmersDataBefore.waitingAmount.add(2000).toNumber()
    //   );

    //   expect(deployerDataAfter.waitingAmount.toNumber()).to.be.equal(
    //     deployerDataBefore.waitingAmount.add(1000).toNumber()
    //   );
    // });

    // it("should change total waiting amount by same value", async () => {
    //   let totalWaitingBefore = await vault.totalWaitingAmount();

    //   await depositToVault(vault, baseToken, farmer, "1000");

    //   let totalWaitingAfter = await vault.totalWaitingAmount();

    //   expect(totalWaitingAfter.toNumber()).to.be.equal(
    //     totalWaitingBefore.add(1000).toNumber()
    //   );
    // });

    // it("should not change total available amount", async () => {
    //   let totalAvailableAmountBefore = await vault.totalAvailableAmount();

    //   await depositToVault(vault, baseToken, farmer, "1000");

    //   let totalAvailableAmountAfter = await vault.totalAvailableAmount();

    //   expect(totalAvailableAmountAfter.toNumber()).to.be.equal(
    //     totalAvailableAmountBefore.toNumber()
    //   );
    // });

    // it("should increase vault token balance", async () => {
    //   let balanceBefore = await baseToken.balanceOf(vault.address);

    //   await depositToVault(vault, baseToken, farmer, "1000");

    //   let balanceAfter = await baseToken.balanceOf(vault.address);

    //   expect(balanceBefore.toNumber()).to.be.equal(
    //     balanceAfter.sub(parseUnits("1000", "gwei")).toNumber()
    //   );
    // });

    // it("should decrease farmers token balance", async () => {
    //   let balanceBefore = await baseToken.balanceOf(farmer.address);

    //   await depositToVault(vault, baseToken, farmer, "1000");

    //   let balanceAfter = await baseToken.balanceOf(farmer.address);

    //   expect(balanceAfter.toString()).to.be.equal(
    //     balanceBefore.sub(parseUnits("1000", "gwei")).toString()
    //   );
    // });

    // describe("epoch -1", async () => {
    //   beforeEach(async () => {
    //     initSnapshotId = await hre.ethers.provider.send("evm_snapshot", []);
    //   });

    //   afterEach(async () => {
    //     await hre.ethers.provider.send("evm_revert", [initSnapshotId]);
    //   });

    //   it("should not sync farmer", async () => {
    //     let receipt = await depositToVault(vault, baseToken, farmer, "1000");
    //     let events = await parseLogs("Vault", receipt.events);

    //     expect(
    //       events.filter((x) => x.name === "DepositorSynced").length
    //     ).to.be.equal(0);
    //   });

    //   it("should emit deposit event", async () => {
    //     let receipt = await depositToVault(vault, baseToken, farmer, "1000");
    //     let events = await parseLogs("Vault", receipt.events);

    //     expect(
    //       events.filter((x) => x.name === "FundsDeposited").length
    //     ).to.be.equal(1);
    //   });
    // });

    describe("epoch > -1", async () => {
      beforeEach(async () => {
        initSnapshotId = await hre.ethers.provider.send("evm_snapshot", []);
        await vault.connect(controller).createNewEpoch();
      });

      afterEach(async () => {
        await hre.ethers.provider.send("evm_revert", [initSnapshotId]);
      });

      it("should sync farmer", async () => {
        let receipt = await depositToVault(vault, baseToken, farmer, "1000");
        let events = await parseLogs("Vault", receipt.events);

        expect(
          events.filter((x) => x.name === "DepositorSynced").length
        ).to.be.equal(1);
      });

      it("should emit deposit event", async () => {
        await baseToken.approve(vault.address, parseUnits("1000", "gwei"));
        let tx = await vault.deposit(parseUnits("1000", "gwei"));
        let receipt = await tx.wait();
        let events = await parseLogs("Vault", receipt.events);
        expect(
          events.filter((x) => x.name === "FundsDeposited").length
        ).to.be.equal(1);
      });
    });
  });

  // describe("withdraw", () => {
  //   describe("in the same epoch", () => {
  //     beforeEach(async () => {
  //       initSnapshotId = await hre.ethers.provider.send("evm_snapshot", []);
  //       await baseToken.approve(vault.address, parseUnits("2000", "gwei"));
  //       await vault.deposit(parseUnits("1000", "gwei"));
  //       await vault.connect(farmer).createNewEpoch();
  //       let start = await vault.currentEpochStart();
  //       await time.increaseTo(start.add(1));
  //       await vault.connect(farmer).trustedBorrow(parseUnits("1000", "gwei"));
  //       await vault.deposit(parseUnits("900", "gwei"));
  //     });

  //     it("should immediately withdraw sum equal this epoch deposit", async () => {
  //       let balanceBefore = await baseToken.balanceOf(deployer.address);
  //       let tx = await vault.withdraw(parseUnits("900", "gwei"));
  //       await tx.wait();
  //       let balanceAfter = await baseToken.balanceOf(deployer.address);
  //       expect(
  //         balanceBefore.add(parseUnits("900", "gwei")).toString()
  //       ).to.be.equal(balanceAfter.toString());
  //     });

  //     it("should immediately withdraw sum smaller than this epoch deposit", async () => {
  //       let balanceBefore = await baseToken.balanceOf(deployer.address);
  //       let tx = await vault.withdraw(parseUnits("800", "gwei"));
  //       await tx.wait();
  //       let balanceAfter = await baseToken.balanceOf(deployer.address);
  //       expect(
  //         balanceBefore.add(parseUnits("800", "gwei")).toString()
  //       ).to.be.equal(balanceAfter.toString());
  //     });

  //     it("should only withdraw waiting amount and schedule rest if withdraw is bigger than epoch deposit", async () => {
  //       let balanceBefore = await baseToken.balanceOf(deployer.address);
  //       let tx = await vault.withdraw(parseUnits("1000", "gwei"));
  //       await tx.wait();
  //       let balanceAfter = await baseToken.balanceOf(deployer.address);
  //       expect(
  //         balanceBefore.add(parseUnits("900", "gwei")).toString()
  //       ).to.be.equal(balanceAfter.toString());
  //       let data = await vault.depositors(deployer.address);
  //       expect(data.waitingAmount.toNumber()).to.be.equal(-100);
  //     });

  //     afterEach(async () => {
  //       await hre.ethers.provider.send("evm_revert", [initSnapshotId]);
  //     });
  //   });

  //   describe("in next epoch", () => {
  //     beforeEach(async () => {
  //       initSnapshotId = await hre.ethers.provider.send("evm_snapshot", []);
  //       await baseToken.approve(vault.address, parseUnits("2000", "gwei"));
  //       await baseToken
  //         .connect(farmer)
  //         .approve(vault.address, parseUnits("5000", "gwei"));
  //       await vault.deposit(parseUnits("1000", "gwei"));
  //       //console.log("DEP 1000");
  //       await vault.connect(farmer).createNewEpoch();
  //       let start = await vault.currentEpochStart();
  //       await time.increaseTo(start.add(1));
  //       await vault.connect(farmer).trustedBorrow(parseUnits("1000", "gwei"));
  //       await vault.deposit(parseUnits("900", "gwei"));
  //       //console.log("DEP 900");
  //       await vault.connect(farmer).trustedRepay(parseUnits("1200", "gwei"));
  //       await vault.connect(farmer).createNewEpoch();
  //     });

  //     afterEach(async () => {
  //       await hre.ethers.provider.send("evm_revert", [initSnapshotId]);
  //     });

  //     it("should schedule withdrawal without payout", async () => {
  //       let balanceBefore = await baseToken.balanceOf(deployer.address);
  //       let tx = await vault.withdraw(parseUnits("900", "gwei"));
  //       await tx.wait();
  //       let balanceAfter = await baseToken.balanceOf(deployer.address);
  //       expect(balanceBefore.toString()).to.be.equal(balanceAfter.toString());
  //       let farmerDataAfter = await vault.depositors(deployer.address);
  //       expect(farmerDataAfter.waitingAmount).to.be.equal(-900);
  //     });

  //     it("should withdraw after re-request in new epoch", async () => {
  //       let balanceBefore = await baseToken.balanceOf(deployer.address);
  //       let tx = await vault.withdraw(parseUnits("900", "gwei"));
  //       await tx.wait();
  //       await vault.connect(farmer).createNewEpoch();
  //       await vault.withdraw(0);
  //       let balanceAfter = await baseToken.balanceOf(deployer.address);
  //       expect(
  //         balanceBefore.add(parseUnits("900", "gwei")).toString()
  //       ).to.be.equal(balanceAfter.toString());
  //       let farmerDataAfter = await vault.depositors(deployer.address);
  //       expect(farmerDataAfter.waitingAmount).to.be.equal(0);
  //     });
  //   });

  //   describe("between epochs", () => {
  //     beforeEach(async () => {
  //       initSnapshotId = await hre.ethers.provider.send("evm_snapshot", []);
  //     });

  //     afterEach(async () => {
  //       await hre.ethers.provider.send("evm_revert", [initSnapshotId]);
  //     });
  //   });
  // });
});
