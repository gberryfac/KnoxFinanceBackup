import hre from "hardhat";
const { getContractFactory } = hre.ethers;
const { parseUnits } = hre.ethers.utils;

import * as time from "./helpers/time";
import * as utils from "./helpers/utils";

import { Vault } from "./../types/Vault";
import { TestERC20 } from "./../types/TestERC20";

import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

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
      parseUnits("3", "ether")
    )) as TestERC20;

    await baseToken.transfer(farmer.address, parseUnits("1", "ether"));
    await baseToken.transfer(controller.address, parseUnits("1", "ether"));

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
    beforeEach(async () => {
      initSnapshotId = await hre.ethers.provider.send("evm_snapshot", []);
    });

    afterEach(async () => {
      await hre.ethers.provider.send("evm_revert", [initSnapshotId]);
    });

    it("should fail if called without approval", async () => {
      let tx = vault.deposit(1000);
      await expect(tx).to.be.revertedWith("ERC20: insufficient allowance");
    });

    it("should succeed if approval is set", async () => {
      await utils.approveAndDepositToVault(vault, baseToken, farmer, "1000");
    });

    it("should change farmer waiting deposit", async () => {
      let farmersDataBefore = await vault.depositors(farmer.address);

      await utils.approveAndDepositToVault(vault, baseToken, farmer, "1000");

      let farmersDataAfter = await vault.depositors(farmer.address);

      expect(farmersDataAfter.waitingAmount.toNumber()).to.be.equal(
        farmersDataBefore.waitingAmount.add(1000).toNumber()
      );
    });

    it("should update farmer waiting deposit", async () => {
      let farmersDataBefore = await vault.depositors(farmer.address);

      await utils.approveAndDepositToVault(vault, baseToken, farmer, "1000");
      await utils.approveAndDepositToVault(vault, baseToken, farmer, "1000");

      let farmersDataAfter = await vault.depositors(farmer.address);

      expect(farmersDataAfter.waitingAmount.toNumber()).to.be.equal(
        farmersDataBefore.waitingAmount.add(2000).toNumber()
      );
    });

    it("should update correct farmer waiting deposit", async () => {
      let farmersDataBefore = await vault.depositors(farmer.address);
      let deployerDataBefore = await vault.depositors(deployer.address);

      await utils.approveAndDepositToVault(vault, baseToken, farmer, "1000");
      await utils.approveAndDepositToVault(vault, baseToken, deployer, "1000");
      await utils.approveAndDepositToVault(vault, baseToken, farmer, "1000");

      let farmersDataAfter = await vault.depositors(farmer.address);
      let deployerDataAfter = await vault.depositors(deployer.address);

      expect(farmersDataAfter.waitingAmount.toNumber()).to.be.equal(
        farmersDataBefore.waitingAmount.add(2000).toNumber()
      );

      expect(deployerDataAfter.waitingAmount.toNumber()).to.be.equal(
        deployerDataBefore.waitingAmount.add(1000).toNumber()
      );
    });

    it("should change total waiting amount by same value", async () => {
      let totalWaitingBefore = await vault.totalWaitingAmount();

      await utils.approveAndDepositToVault(vault, baseToken, farmer, "1000");

      let totalWaitingAfter = await vault.totalWaitingAmount();

      expect(totalWaitingAfter.toNumber()).to.be.equal(
        totalWaitingBefore.add(1000).toNumber()
      );
    });

    it("should not change total available amount", async () => {
      let totalAvailableAmountBefore = await vault.totalAvailableAmount();

      await utils.approveAndDepositToVault(vault, baseToken, farmer, "1000");

      let totalAvailableAmountAfter = await vault.totalAvailableAmount();

      expect(totalAvailableAmountAfter.toNumber()).to.be.equal(
        totalAvailableAmountBefore.toNumber()
      );
    });

    it("should increase vault token balance", async () => {
      let farmerBalanceBefore = await baseToken.balanceOf(vault.address);

      await utils.approveAndDepositToVault(vault, baseToken, farmer, "1000");

      let farmerBalanceAfter = await baseToken.balanceOf(vault.address);

      expect(farmerBalanceBefore.toNumber()).to.be.equal(
        farmerBalanceAfter.sub(parseUnits("1000", "gwei")).toNumber()
      );
    });

    it("should decrease farmers token balance", async () => {
      let farmerBalanceBefore = await baseToken.balanceOf(farmer.address);

      await utils.approveAndDepositToVault(vault, baseToken, farmer, "1000");

      let farmerBalanceAfter = await baseToken.balanceOf(farmer.address);

      expect(farmerBalanceAfter.toString()).to.be.equal(
        farmerBalanceBefore.sub(parseUnits("1000", "gwei")).toString()
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
        let receipt = await utils.approveAndDepositToVault(
          vault,
          baseToken,
          farmer,
          "1000"
        );
        let events = await utils.parseLogs("Vault", receipt.events);

        expect(
          events.filter((x) => x.name === "DepositorSynced").length
        ).to.be.equal(0);
      });

      it("should emit deposit event", async () => {
        let receipt = await utils.approveAndDepositToVault(
          vault,
          baseToken,
          farmer,
          "1000"
        );
        let events = await utils.parseLogs("Vault", receipt.events);

        expect(
          events.filter((x) => x.name === "FundsDeposited").length
        ).to.be.equal(1);
      });
    });

    describe("epoch > -1", async () => {
      beforeEach(async () => {
        initSnapshotId = await hre.ethers.provider.send("evm_snapshot", []);
        await vault.connect(controller).createNewEpoch();
        let startEpoch = await vault.currentEpochStart();
        await time.increaseTo(startEpoch.add(1));
      });

      afterEach(async () => {
        await hre.ethers.provider.send("evm_revert", [initSnapshotId]);
      });

      it("should sync farmer", async () => {
        let receipt = await utils.approveAndDepositToVault(
          vault,
          baseToken,
          farmer,
          "1000"
        );
        let events = await utils.parseLogs("Vault", receipt.events);

        expect(
          events.filter((x) => x.name === "DepositorSynced").length
        ).to.be.equal(1);
      });

      it("should emit deposit event", async () => {
        await baseToken.approve(vault.address, parseUnits("1000", "gwei"));

        let tx = await vault.deposit(parseUnits("1000", "gwei"));
        let receipt = await tx.wait();
        let events = await utils.parseLogs("Vault", receipt.events);

        expect(
          events.filter((x) => x.name === "FundsDeposited").length
        ).to.be.equal(1);
      });

      it("should have funds waiting", async () => {
        await utils.approveAndDepositToVault(vault, baseToken, farmer, "1000");

        let totalWaiting = await vault.totalWaitingAmount();
        let farmerWaitingAmount = await vault.depositors(farmer.address);

        expect(totalWaiting.toNumber()).to.be.equal(1000);
        expect(farmerWaitingAmount.waitingAmount.toNumber()).to.be.equal(1000);
      });

      it("should update funds waiting", async () => {
        await utils.approveAndDepositToVault(vault, baseToken, farmer, "1000");
        await utils.approveAndDepositToVault(
          vault,
          baseToken,
          deployer,
          "1000"
        );

        let totalWaiting = await vault.totalWaitingAmount();
        let farmerWaitingAmount = await vault.depositors(farmer.address);
        let deployerWaitingAmount = await vault.depositors(deployer.address);

        expect(totalWaiting.toNumber()).to.be.equal(2000);
        expect(farmerWaitingAmount.waitingAmount.toNumber()).to.be.equal(1000);
        expect(deployerWaitingAmount.waitingAmount.toNumber()).to.be.equal(
          1000
        );

        await utils.approveAndDepositToVault(vault, baseToken, farmer, "1000");

        totalWaiting = await vault.totalWaitingAmount();
        farmerWaitingAmount = await vault.depositors(farmer.address);
        deployerWaitingAmount = await vault.depositors(deployer.address);

        expect(totalWaiting.toNumber()).to.be.equal(3000);
        expect(farmerWaitingAmount.waitingAmount.toNumber()).to.be.equal(2000);
        expect(deployerWaitingAmount.waitingAmount.toNumber()).to.be.equal(
          1000
        );
      });

      it("should move vault funds to available on new epoch", async () => {
        await utils.approveAndDepositToVault(vault, baseToken, farmer, "1000");
        await utils.approveAndDepositToVault(
          vault,
          baseToken,
          deployer,
          "1000"
        );

        let totalAvailable = await vault.totalAvailableAmount();
        let totalWaiting = await vault.totalWaitingAmount();

        expect(totalAvailable.toNumber()).to.be.equal(0);
        expect(totalWaiting.toNumber()).to.be.equal(2000);

        await vault.connect(controller).createNewEpoch();
        let startEpoch = await vault.currentEpochStart();
        await time.increaseTo(startEpoch.add(1));

        totalAvailable = await vault.totalAvailableAmount();
        totalWaiting = await vault.totalWaitingAmount();

        expect(totalAvailable.toNumber()).to.be.equal(2000);
        expect(totalWaiting.toNumber()).to.be.equal(0);
      });

      it("should remove waiting funds after new epoch, on deposit", async () => {
        await utils.approveAndDepositToVault(vault, baseToken, farmer, "1000");

        let farmerWaitingAmount = await vault.depositors(farmer.address);

        expect(farmerWaitingAmount.waitingAmount.toNumber()).to.be.equal(1000);

        await vault.connect(controller).createNewEpoch();
        let startEpoch = await vault.currentEpochStart();
        await time.increaseTo(startEpoch.add(1));

        await utils.approveAndDepositToVault(vault, baseToken, farmer, "100");

        farmerWaitingAmount = await vault.depositors(farmer.address);

        expect(farmerWaitingAmount.waitingAmount.toNumber()).to.be.equal(100);
      });

      it("should update normialized balance after new epoch, on deposit", async () => {
        await utils.approveAndDepositToVault(vault, baseToken, farmer, "1000");

        let farmerWaitingAmount = await vault.depositors(farmer.address);

        expect(farmerWaitingAmount.normalizedBalance.toNumber()).to.be.equal(0);

        await vault.connect(controller).createNewEpoch();
        let startEpoch = await vault.currentEpochStart();
        await time.increaseTo(startEpoch.add(1));

        await utils.approveAndDepositToVault(vault, baseToken, farmer, "100");

        farmerWaitingAmount = await vault.depositors(farmer.address);

        expect(farmerWaitingAmount.normalizedBalance.toNumber()).to.be.equal(
          1000
        );
      });
    });
  });

  describe("withdraw", () => {
    describe("no deposits made within the current epoch", () => {
      beforeEach(async () => {
        initSnapshotId = await hre.ethers.provider.send("evm_snapshot", []);

        await vault.connect(controller).createNewEpoch();
        let startEpoch = await vault.currentEpochStart();
        await time.increaseTo(startEpoch.add(1));
      });

      afterEach(async () => {
        await hre.ethers.provider.send("evm_revert", [initSnapshotId]);
      });

      it("should fail if no deposits made", async () => {
        let tx = vault.initiateWithdraw(parseUnits("1000", "gwei"));

        await expect(tx).to.be.revertedWith("vault/no-funds-deposited");
      });
    });

    describe("deposits made within the current epoch", () => {
      beforeEach(async () => {
        initSnapshotId = await hre.ethers.provider.send("evm_snapshot", []);

        await utils.approveVault(vault, baseToken, farmer, "2000");
        await utils.depositToVault(vault, farmer, "1000");

        await vault.connect(controller).createNewEpoch();
        let startEpoch = await vault.currentEpochStart();
        await time.increaseTo(startEpoch.add(1));

        await utils.depositToVault(vault, farmer, "900");
      });

      afterEach(async () => {
        await hre.ethers.provider.send("evm_revert", [initSnapshotId]);
      });

      // TODO: CHECK totalAvailableAmount & totalWaitingAmount
      // CHECK

      it("should instantly withdraw sum equal to current epoch deposit", async () => {
        let farmerBalanceBefore = await baseToken.balanceOf(farmer.address);

        await utils.initiateWithdrawFromVault(vault, farmer, "900");

        let farmerBalanceAfter = await baseToken.balanceOf(farmer.address);

        expect(
          farmerBalanceBefore.add(parseUnits("900", "gwei")).toString()
        ).to.be.equal(farmerBalanceAfter.toString());
      });

      it("should instantly withdraw sum smaller than current epoch deposit", async () => {
        let farmerBalanceBefore = await baseToken.balanceOf(farmer.address);

        await utils.initiateWithdrawFromVault(vault, farmer, "800");

        let farmerBalanceAfter = await baseToken.balanceOf(farmer.address);

        expect(
          farmerBalanceBefore.add(parseUnits("800", "gwei")).toString()
        ).to.be.equal(farmerBalanceAfter.toString());
      });

      it("should only withdraw waiting amount and schedule rest if withdraw is bigger than epoch deposit", async () => {
        let farmerBalanceBefore = await baseToken.balanceOf(farmer.address);

        await utils.withdrawFromVault(vault, farmer, "1000");

        let farmerBalanceAfter = await baseToken.balanceOf(farmer.address);

        expect(
          farmerBalanceBefore.add(parseUnits("900", "gwei")).toString()
        ).to.be.equal(farmerBalanceAfter.toString());

        let farmerVaultBalance = await vault.depositors(farmer.address);

        expect(farmerVaultBalance.waitingAmount.toNumber()).to.be.equal(-100);
      });
    });

    describe("in next epoch", () => {
      beforeEach(async () => {
        initSnapshotId = await hre.ethers.provider.send("evm_snapshot", []);

        await utils.approveVault(vault, baseToken, farmer, "2000");
        await utils.approveVault(vault, baseToken, controller, "5000");

        await utils.depositToVault(vault, farmer, "1000");

        await vault.connect(controller).createNewEpoch();
        let startEpoch = await vault.currentEpochStart();
        await time.increaseTo(startEpoch.add(1));

        await utils.depositToVault(vault, farmer, "900");

        await vault.connect(controller).createNewEpoch();
        startEpoch = await vault.currentEpochStart();
        await time.increaseTo(startEpoch.add(1));
      });

      afterEach(async () => {
        await hre.ethers.provider.send("evm_revert", [initSnapshotId]);
      });

      // TODO: CHECK totalAvailableAmount & totalWaitingAmount!

      it("should schedule withdrawal without payout", async () => {
        let farmerBalanceBefore = await baseToken.balanceOf(farmer.address);

        await utils.withdrawFromVault(vault, farmer, "900");

        let farmerBalanceAfter = await baseToken.balanceOf(farmer.address);

        expect(farmerBalanceBefore.toString()).to.be.equal(
          farmerBalanceAfter.toString()
        );

        let farmerDataAfter = await vault.depositors(farmer.address);
        let totalWaitingAmount = await vault.totalWaitingAmount();

        console.log(totalWaitingAmount);

        expect(farmerDataAfter.waitingAmount).to.be.equal(-900);
        expect(totalWaitingAmount).to.be.equal(-1000);
      });

      it("should withdraw after re-request in new epoch", async () => {
        let farmerBalanceBefore = await baseToken.balanceOf(farmer.address);

        await utils.withdrawFromVault(vault, farmer, "900");

        await vault.connect(controller).createNewEpoch();
        let startEpoch = await vault.currentEpochStart();
        await time.increaseTo(startEpoch.add(1));

        await utils.withdrawFromVault(vault, farmer, "0");

        let farmerBalanceAfter = await baseToken.balanceOf(farmer.address);

        expect(
          farmerBalanceBefore.add(parseUnits("900", "gwei")).toString()
        ).to.be.equal(farmerBalanceAfter.toString());

        let farmerDataAfter = await vault.depositors(farmer.address);

        expect(farmerDataAfter.waitingAmount).to.be.equal(0);
      });

      it("should fail to withdraw more funds than deposited", async () => {
        await utils.withdrawFromVault(vault, farmer, "2000");

        await vault.connect(controller).createNewEpoch();
        let startEpoch = await vault.currentEpochStart();
        await time.increaseTo(startEpoch.add(1));

        let tx = utils.withdrawFromVault(vault, farmer, "0");

        await expect(tx).to.be.revertedWith("vault/insufficient-balance");
      });

      it("should fail to withdraw more funds than deposited", async () => {
        console.log(
          "totalAvailableAmount1",
          await vault.totalAvailableAmount()
        );
        console.log("totalWaitingAmount1", await vault.totalWaitingAmount());

        await utils.withdrawFromVault(vault, farmer, "1900");

        console.log(
          "totalAvailableAmount2",
          await vault.totalAvailableAmount()
        );
        console.log("totalWaitingAmount2", await vault.totalWaitingAmount());

        await vault.connect(controller).createNewEpoch();
        let startEpoch = await vault.currentEpochStart();
        await time.increaseTo(startEpoch.add(1));

        console.log(
          "totalAvailableAmount3",
          await vault.totalAvailableAmount()
        );
        console.log("totalWaitingAmount3", await vault.totalWaitingAmount());

        await utils.withdrawFromVault(vault, farmer, "0");

        console.log(
          "totalAvailableAmount4",
          await vault.totalAvailableAmount()
        );
        console.log("totalWaitingAmount4", await vault.totalWaitingAmount());

        // await expect(tx).to.be.revertedWith("vault/insufficient-balance");
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

    describe("with payout", () => {
      beforeEach(async () => {
        initSnapshotId = await hre.ethers.provider.send("evm_snapshot", []);

        await utils.approveVault(vault, baseToken, farmer, "2000");
        await utils.approveVault(vault, baseToken, controller, "5000");

        await utils.depositToVault(vault, farmer, "1000");

        await vault.connect(controller).createNewEpoch();
        let startEpoch = await vault.currentEpochStart();
        await time.increaseTo(startEpoch.add(1));

        await vault.connect(controller).borrow(parseUnits("1000", "gwei"));

        await utils.depositToVault(vault, farmer, "900");

        await vault.connect(controller).repay(parseUnits("1200", "gwei"));

        await vault.connect(controller).createNewEpoch();
        startEpoch = await vault.currentEpochStart();
        await time.increaseTo(startEpoch.add(1));
      });

      afterEach(async () => {
        await hre.ethers.provider.send("evm_revert", [initSnapshotId]);
      });
    });
  });
});
