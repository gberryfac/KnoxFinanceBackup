import hre from "hardhat";
const { getContractFactory } = hre.ethers;
const { parseUnits } = hre.ethers.utils;

import * as time from "./helpers/time";
import * as utils from "./helpers/utils";

import { Vault } from "./../types/Vault";
import { TestERC20 } from "./../types/TestERC20";

import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

let block;

describe.only("Knox Vault", async () => {
  let deployer: SignerWithAddress;
  let farmer: SignerWithAddress;
  let controller: SignerWithAddress;
  let vault: Vault;
  let baseToken: TestERC20;
  let initSnapshotId: string;

  before(async () => {
    await hre.ethers.provider.send("evm_mine", []);
    block = await hre.ethers.provider.getBlock(
      await hre.ethers.provider.getBlockNumber()
    );

    [deployer, farmer, controller] = await hre.ethers.getSigners();

    let factoryERC20 = await getContractFactory("TestERC20");
    let factoryFarmersTreasury = await getContractFactory("Vault");

    baseToken = (await factoryERC20.deploy(
      "TestToken",
      "TT",
      parseUnits("1000", "ether")
    )) as TestERC20;

    await baseToken.transfer(farmer.address, parseUnits("100", "ether"));
    await baseToken.transfer(controller.address, parseUnits("100", "ether"));

    vault = (await factoryFarmersTreasury.deploy(
      "Knox Vault LP Token",
      "KV-LPT",
      baseToken.address,
      controller.address,
      block.timestamp
    )) as Vault;
  });

  describe("deposit (user state)", () => {
    describe("epoch == 0", () => {
      beforeEach(async () => {
        initSnapshotId = await hre.ethers.provider.send("evm_snapshot", []);
      });

      afterEach(async () => {
        await hre.ethers.provider.send("evm_revert", [initSnapshotId]);
      });

      // it("console.log", async () => {
      //   await utils.approveAndDepositToVault(vault, baseToken, deployer, "100");

      //   let data = {
      //     "Next Epoch Balance": await (await vault.epoch()).balance.toString(),
      //     "Current Epoch Balance": await (
      //       await vault.epochBalance()
      //     ).toString(),
      //     "Current Epoch Withholding": await (
      //       await vault.epoch()
      //     ).withholding.toString(),
      //     "Deployer LP Token Balance": await (
      //       await vault.balanceOf(deployer.address)
      //     ).toString(),
      //     "Farmer LP Token Balance": await (
      //       await vault.balanceOf(farmer.address)
      //     ).toString(),
      //     "Controller LP Token Balance": await (
      //       await vault.balanceOf(controller.address)
      //     ).toString(),
      //     "Current PPFS": await (await vault.getPricePerFullShare()).toString(),
      //   };

      //   console.table(data);

      //   await utils.approveAndDepositToVault(vault, baseToken, farmer, "35");

      //   data = {
      //     "Next Epoch Balance": await (await vault.epoch()).balance.toString(),
      //     "Current Epoch Balance": await (
      //       await vault.epochBalance()
      //     ).toString(),
      //     "Current Epoch Withholding": await (
      //       await vault.epoch()
      //     ).withholding.toString(),
      //     "Deployer LP Token Balance": await (
      //       await vault.balanceOf(deployer.address)
      //     ).toString(),
      //     "Farmer LP Token Balance": await (
      //       await vault.balanceOf(farmer.address)
      //     ).toString(),
      //     "Controller LP Token Balance": await (
      //       await vault.balanceOf(controller.address)
      //     ).toString(),
      //     "Current PPFS": await (await vault.getPricePerFullShare()).toString(),
      //   };

      //   console.table(data);

      //   await baseToken
      //     .connect(farmer)
      //     .transfer(vault.address, parseUnits("20", "ether"));
      //   await utils.approveAndDepositToVault(vault, baseToken, deployer, "100");
      //   await utils.approveAndDepositToVault(
      //     vault,
      //     baseToken,
      //     controller,
      //     "15"
      //   );

      //   data = {
      //     "Next Epoch Balance": await (await vault.epoch()).balance.toString(),
      //     "Current Epoch Balance": await (
      //       await vault.epochBalance()
      //     ).toString(),
      //     "Current Epoch Withholding": await (
      //       await vault.epoch()
      //     ).withholding.toString(),
      //     "Deployer LP Token Balance": await (
      //       await vault.balanceOf(deployer.address)
      //     ).toString(),
      //     "Farmer LP Token Balance": await (
      //       await vault.balanceOf(farmer.address)
      //     ).toString(),
      //     "Controller LP Token Balance": await (
      //       await vault.balanceOf(controller.address)
      //     ).toString(),
      //     "Current PPFS": await (await vault.getPricePerFullShare()).toString(),
      //   };

      //   console.table(data);

      //   await vault.rollover();
      //   let epoch = await vault.epoch();
      //   await time.increaseTo(epoch.expiry.add(1));

      //   await utils.approveAndDepositToVault(vault, baseToken, farmer, "10");

      //   data = {
      //     "Next Epoch Balance": await (await vault.epoch()).balance.toString(),
      //     "Current Epoch Balance": await (
      //       await vault.epochBalance()
      //     ).toString(),
      //     "Current Epoch Withholding": await (
      //       await vault.epoch()
      //     ).withholding.toString(),
      //     "Deployer LP Token Balance": await (
      //       await vault.balanceOf(deployer.address)
      //     ).toString(),
      //     "Farmer LP Token Balance": await (
      //       await vault.balanceOf(farmer.address)
      //     ).toString(),
      //     "Controller LP Token Balance": await (
      //       await vault.balanceOf(controller.address)
      //     ).toString(),
      //     "Current PPFS": await (await vault.getPricePerFullShare()).toString(),
      //   };

      //   console.table(data);

      //   await utils.approveAndDepositToVault(
      //     vault,
      //     baseToken,
      //     controller,
      //     "15"
      //   );

      //   data = {
      //     "Next Epoch Balance": await (await vault.epoch()).balance.toString(),
      //     "Current Epoch Balance": await (
      //       await vault.epochBalance()
      //     ).toString(),
      //     "Current Epoch Withholding": await (
      //       await vault.epoch()
      //     ).withholding.toString(),
      //     "Deployer LP Token Balance": await (
      //       await vault.balanceOf(deployer.address)
      //     ).toString(),
      //     "Farmer LP Token Balance": await (
      //       await vault.balanceOf(farmer.address)
      //     ).toString(),
      //     "Controller LP Token Balance": await (
      //       await vault.balanceOf(controller.address)
      //     ).toString(),
      //     "Current PPFS": await (await vault.getPricePerFullShare()).toString(),
      //   };

      //   console.table(data);
      // });

      it("should fail if called without approval", async () => {
        let tx = vault.deposit(1000);
        await expect(tx).to.be.revertedWith("ERC20: insufficient allowance");
      });

      it("should succeed if approval is set", async () => {
        await utils.approveAndDepositToVault(vault, baseToken, farmer, "100");
      });

      // TODO: CHECK LP TOKENS HAVE BEEN SENT TO USER IN SEPARATE TEST
      it("should create deposit receipt if funds are provided", async () => {
        await utils.approveAndDepositToVault(vault, baseToken, farmer, "100");

        let amount = await (await vault.deposits(farmer.address)).amount;

        expect(amount.toString()).to.be.equal(
          parseUnits("100", "ether").toString()
        );
      });

      // TODO: CHECK LP TOKENS HAVE BEEN SENT TO USER IN SEPARATE TEST
      it("should update deposit receipt if funds are provided", async () => {
        await utils.approveAndDepositToVault(vault, baseToken, farmer, "50");
        await utils.approveAndDepositToVault(vault, baseToken, farmer, "50");

        let amount = await (await vault.deposits(farmer.address)).amount;

        expect(amount.toString()).to.be.equal(
          parseUnits("100", "ether").toString()
        );
      });

      // TODO: CHECK LP TOKENS HAVE BEEN SENT TO USER IN SEPARATE TEST
      it("should create/update deposit receipt for each user if funds are provided", async () => {
        await utils.approveAndDepositToVault(vault, baseToken, farmer, "10");
        await utils.approveAndDepositToVault(vault, baseToken, deployer, "100");
        await utils.approveAndDepositToVault(vault, baseToken, farmer, "10");

        let farmerAmount = await (await vault.deposits(farmer.address)).amount;
        let deployerAmount = await (
          await vault.deposits(deployer.address)
        ).amount;

        expect(farmerAmount.toString()).to.be.equal(
          parseUnits("20", "ether").toString()
        );
        expect(deployerAmount.toString()).to.be.equal(
          parseUnits("100", "ether").toString()
        );
      });
    });

    describe("epoch == 1", () => {
      beforeEach(async () => {
        initSnapshotId = await hre.ethers.provider.send("evm_snapshot", []);

        await utils.approveAndDepositToVault(vault, baseToken, farmer, "10");

        await vault.rollover();
        let epoch = await vault.epoch();
        await time.increaseTo(epoch.expiry.add(1));
      });

      afterEach(async () => {
        await hre.ethers.provider.send("evm_revert", [initSnapshotId]);
      });

      // TODO: CHECK LP TOKENS HAVE BEEN SENT TO USER IN SEPARATE TEST
      it("should update deposit receipt with amount and epochIndex if funds are sent", async () => {
        await utils.approveAndDepositToVault(vault, baseToken, farmer, "50");

        let receipt = await vault.deposits(farmer.address);

        expect(receipt.epochIndex.toNumber()).to.be.equal(1);
        expect(receipt.amount.toString()).to.be.equal(
          parseUnits("50", "ether")
        );
      });
    });
  });

  describe("deposit (vault state)", () => {
    describe("epoch == 0", () => {
      beforeEach(async () => {
        initSnapshotId = await hre.ethers.provider.send("evm_snapshot", []);
      });

      afterEach(async () => {
        await hre.ethers.provider.send("evm_revert", [initSnapshotId]);
      });

      it("should increase vault token balance", async () => {
        let vaultBalanceBefore = await baseToken.balanceOf(vault.address);

        await utils.approveAndDepositToVault(vault, baseToken, farmer, "100");

        let vaultBalanceAfter = await baseToken.balanceOf(vault.address);

        expect(vaultBalanceBefore.toNumber()).to.be.equal(
          vaultBalanceAfter.sub(parseUnits("100", "ether")).toNumber()
        );
      });
    });
  });

  describe("deposit (epoch state)", () => {
    describe("epoch == 0", () => {
      beforeEach(async () => {
        initSnapshotId = await hre.ethers.provider.send("evm_snapshot", []);
      });

      afterEach(async () => {
        await hre.ethers.provider.send("evm_revert", [initSnapshotId]);
      });

      it("should not change current epoch state if rollover isn't called", async () => {
        let epoch = await vault.epoch();

        expect(epoch.index.toNumber()).to.be.equal(0);
        expect(epoch.expiry.toNumber()).to.be.equal(block.timestamp);
        expect(epoch.balance.toString()).to.be.equal(parseUnits("0", "ether"));
        expect(epoch.pricePerFullShare.toNumber()).to.be.equal(0);
        expect(epoch.withholding.toString()).to.be.equal(
          parseUnits("0", "ether")
        );
      });
    });

    describe("epoch == 1", () => {
      beforeEach(async () => {
        initSnapshotId = await hre.ethers.provider.send("evm_snapshot", []);

        await utils.approveAndDepositToVault(vault, baseToken, farmer, "10");

        await vault.rollover();
        let epoch = await vault.epoch();
        await time.increaseTo(epoch.expiry.add(1));
      });

      afterEach(async () => {
        await hre.ethers.provider.send("evm_revert", [initSnapshotId]);
      });

      it("should change epoch state after rollover is called", async () => {
        await utils.approveAndDepositToVault(vault, baseToken, farmer, "50");

        let epoch = await vault.epoch();

        expect(epoch.index.toNumber()).to.be.equal(1);
        expect(epoch.expiry.toNumber()).to.be.equal(
          block.timestamp + (7 * 24 * 3600 - 7200)
        );
        expect(epoch.balance.toString()).to.be.equal(parseUnits("10", "ether"));
        expect(epoch.pricePerFullShare.toNumber()).to.be.equal(0);
        expect(epoch.withholding.toString()).to.be.equal(
          parseUnits("0", "ether")
        );
      });
    });
  });

  describe("instant withdraw (user state)", () => {
    describe("epoch == 0", () => {
      beforeEach(async () => {
        initSnapshotId = await hre.ethers.provider.send("evm_snapshot", []);
      });

      afterEach(async () => {
        await hre.ethers.provider.send("evm_revert", [initSnapshotId]);
      });

      // TODO: CHECK LP TOKENS HAVE BEEN SENT TO USER IN SEPARATE TEST
      it("should fail if no funds have been deposited`", async () => {
        let tx = vault.instantWithdraw(1000);

        await expect(tx).to.be.revertedWith(
          "vault/insufficient-lp-token-balance"
        );
      });

      // TODO: CHECK LP TOKENS HAVE BEEN SENT TO USER IN SEPARATE TEST
      it("should fail if withdraw amount > deposit amount", async () => {
        await utils.approveAndDepositToVault(vault, baseToken, farmer, "10");

        let tx = utils.instantWithdraw(vault, farmer, "1000");

        await expect(tx).to.be.revertedWith(
          "vault/insufficient-lp-token-balance"
        );
      });

      // TODO: CHECK LP TOKENS HAVE BEEN SENT TO USER IN SEPARATE TEST
      it("should withdraw funds that were deposited", async () => {
        await utils.approveAndDepositToVault(vault, baseToken, farmer, "50");
        await utils.instantWithdraw(vault, farmer, "50");

        let amount = await (await vault.deposits(farmer.address)).amount;

        expect(amount.toString()).to.be.equal(parseUnits("0", "ether"));
      });
    });

    describe("epoch == 1", () => {
      beforeEach(async () => {
        initSnapshotId = await hre.ethers.provider.send("evm_snapshot", []);

        await utils.approveAndDepositToVault(vault, baseToken, farmer, "10");

        await vault.rollover();
        let epoch = await vault.epoch();
        await time.increaseTo(epoch.expiry.add(1));
      });

      afterEach(async () => {
        await hre.ethers.provider.send("evm_revert", [initSnapshotId]);
      });

      it("should fail if funds have not been deposited in current epoch", async () => {
        let tx = utils.instantWithdraw(vault, farmer, "10");
        await expect(tx).to.be.revertedWith("vault/instant-withdraw-failed");
      });

      // TODO: FIX THIS TEST :^)
      it("should withdraw funds at 1:1 ratio", async () => {
        await utils.approveAndDepositToVault(vault, baseToken, farmer, "50");

        // // Price Per Share should not affect the instant withdrawals.
        // await baseToken.transfer(vault.address, parseUnits("2", "ether"));

        let balance = await vault.balanceOf(farmer.address);
        balance = balance.div(2);

        await vault.connect(farmer).instantWithdraw(balance);

        let amount = await (await vault.deposits(farmer.address)).amount;
        console.log("Amount!:", amount);

        // await utils.instantWithdraw(vault, farmer, "25");
        expect(amount.toString()).to.be.equal(parseUnits("30", "ether"));
      });

      // TODO: CHECK THAT TOKENS RECEIVED WITH instantWithdraw() DO NOT INCLUDE PROFITS IF TOKENS
      // ARE SENT TO VAULT
      // it("should withdraw funds at 1:1 ratio", async () => {
      //   await utils.approveAndDepositToVault(vault, baseToken, farmer, "50");

      //   // // Price Per Share should not affect the instant withdrawals.
      //   // await baseToken.transfer(vault.address, parseUnits("2", "ether"));

      //   let balance = await vault.balanceOf(farmer.address);
      //   balance = balance.div(2);

      //   await vault.connect(farmer).instantWithdraw(balance);

      //   let amount = await (await vault.deposits(farmer.address)).amount;
      //   console.log("Amount!:", amount);

      //   // await utils.instantWithdraw(vault, farmer, "25");
      //   expect(amount.toString()).to.be.equal(parseUnits("30", "ether"));
      // });
    });
  });

  describe("instant withdraw (vault state)", () => {
    describe("epoch == 0", () => {
      beforeEach(async () => {
        initSnapshotId = await hre.ethers.provider.send("evm_snapshot", []);
      });

      afterEach(async () => {
        await hre.ethers.provider.send("evm_revert", [initSnapshotId]);
      });

      it("should decrease vault token balance", async () => {
        let vaultBalanceBefore = await baseToken.balanceOf(vault.address);

        await utils.approveAndDepositToVault(vault, baseToken, farmer, "100");
        await utils.instantWithdraw(vault, farmer, "25");

        let vaultBalanceAfter = await baseToken.balanceOf(vault.address);

        expect(vaultBalanceBefore.toNumber()).to.be.equal(
          vaultBalanceAfter.sub(parseUnits("75", "ether")).toNumber()
        );
      });
    });
  });

  describe("instant withdraw (epoch state)", () => {
    describe("epoch == 0", () => {
      beforeEach(async () => {
        initSnapshotId = await hre.ethers.provider.send("evm_snapshot", []);

        await utils.approveAndDepositToVault(vault, baseToken, farmer, "50");
        await utils.instantWithdraw(vault, farmer, "25");
      });

      afterEach(async () => {
        await hre.ethers.provider.send("evm_revert", [initSnapshotId]);
      });

      it("should not change current epoch state if rollover isn't called", async () => {
        let epoch = await vault.epoch();

        expect(epoch.index.toNumber()).to.be.equal(0);
        expect(epoch.expiry.toNumber()).to.be.equal(block.timestamp);
        expect(epoch.balance.toString()).to.be.equal(parseUnits("0", "ether"));
        expect(epoch.pricePerFullShare.toNumber()).to.be.equal(0);
        expect(epoch.withholding.toString()).to.be.equal(
          parseUnits("0", "ether")
        );
      });
    });
  });

  describe("initiate withdraw (user state)", () => {
    describe("epoch == 0", () => {
      beforeEach(async () => {
        initSnapshotId = await hre.ethers.provider.send("evm_snapshot", []);
      });

      afterEach(async () => {
        await hre.ethers.provider.send("evm_revert", [initSnapshotId]);
      });

      it("should fail if no funds have been deposited`", async () => {
        let tx = vault.initiateWithdraw(parseUnits("100", "ether"));

        await expect(tx).to.be.revertedWith(
          "vault/insufficient-lp-token-balance"
        );
      });
    });

    describe("epoch == 1", () => {
      beforeEach(async () => {
        initSnapshotId = await hre.ethers.provider.send("evm_snapshot", []);

        await utils.approveAndDepositToVault(vault, baseToken, farmer, "10");
        await utils.approveAndDepositToVault(vault, baseToken, deployer, "100");

        await vault.rollover();
        let epoch = await vault.epoch();
        await time.increaseTo(epoch.expiry.add(1));
      });

      afterEach(async () => {
        await hre.ethers.provider.send("evm_revert", [initSnapshotId]);
      });

      it("should fail if withdrawal amount exceeds deposit amount`", async () => {
        let tx = vault
          .connect(farmer)
          .initiateWithdraw(parseUnits("11", "ether"));

        await expect(tx).to.be.revertedWith(
          "vault/insufficient-lp-token-balance"
        );
      });

      it("should create withholding receipt if lp tokens are provided`", async () => {
        await utils.initiateWithdraw(vault, farmer, "10");

        let amount = (await vault.withholding(farmer.address)).amount;

        expect(amount.toString()).to.be.equal(parseUnits("10", "ether"));
      });

      it("should update withholding receipt if lp tokens are provided`", async () => {
        await utils.initiateWithdraw(vault, farmer, "3");
        await utils.initiateWithdraw(vault, farmer, "5");

        let amount = (await vault.withholding(farmer.address)).amount;

        expect(amount.toString()).to.be.equal(parseUnits("8", "ether"));
      });

      it("should update withholding receipt of correct user if lp tokens are provided", async () => {
        await utils.initiateWithdraw(vault, farmer, "5");
        await utils.initiateWithdraw(vault, deployer, "65");
        await utils.initiateWithdraw(vault, farmer, "4");

        let farmerAmount = (await vault.withholding(farmer.address)).amount;
        let deployerAmount = (await vault.withholding(deployer.address)).amount;

        expect(farmerAmount.toString()).to.be.equal(parseUnits("9", "ether"));
        expect(deployerAmount.toString()).to.be.equal(
          parseUnits("65", "ether")
        );
      });
    });

    describe("epoch == 2", () => {
      beforeEach(async () => {
        initSnapshotId = await hre.ethers.provider.send("evm_snapshot", []);

        await utils.approveAndDepositToVault(vault, baseToken, farmer, "50");

        await vault.rollover();
        let epoch = await vault.epoch();
        await time.increaseTo(epoch.expiry.add(1));

        await utils.initiateWithdraw(vault, farmer, "10");

        await vault.rollover();
        epoch = await vault.epoch();
        await time.increaseTo(epoch.expiry.add(1));
      });

      afterEach(async () => {
        await hre.ethers.provider.send("evm_revert", [initSnapshotId]);
      });

      it("should update withholding receipt between epochs", async () => {
        await utils.initiateWithdraw(vault, farmer, "15");

        let amount = await (await vault.withholding(farmer.address)).amount;

        expect(amount.toString()).to.be.equal(parseUnits("25", "ether"));
      });
    });
  });
});

// TODO: COMBINATIONS OF instantWithdraw() & initiateWithdraw()
