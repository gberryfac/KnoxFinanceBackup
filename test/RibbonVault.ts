import { ethers, network } from "hardhat";
import { BigNumber, BigNumberish, constants, Contract } from "ethers";
import { parseUnits } from "ethers/lib/utils";
const { getContractFactory, provider } = ethers;
const { parseEther } = ethers.utils;

import { expect } from "chai";
import moment from "moment-timezone";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import * as time from "./helpers/time";
import { deployProxy } from "./helpers/utils";
import { assert } from "./helpers/assertions";
import {
  BLOCK_NUMBER,
  WETH_ADDRESS,
  WETH_NAME,
  WETH_DECIMALS,
  DAI_ADDRESS,
  DAI_NAME,
  DAI_DECIMALS,
} from "../constants/constants";

import { MockWETH9__factory } from "./../types";

import { TEST_URI } from "../scripts/helpers/getDefaultEthersProvider";

moment.tz.setDefault("UTC");

const gasPrice = parseUnits("100", "gwei");
const FEE_SCALING = BigNumber.from(10).pow(6);
const WEEKS_PER_YEAR = 52142857;

const chainId = network.config.chainId;

describe("RibbonVault", () => {
  behavesLikeRibbonOptionsVault({
    name: `Ribbon ETH Theta Vault (Call)`,
    tokenName: "Ribbon ETH Theta Vault",
    tokenSymbol: "rETH-THETA",
    tokenDecimals: 18,
    depositAssetName: WETH_NAME,
    depositAssetDecimals: WETH_DECIMALS,
    underlying: WETH_ADDRESS[chainId],
    mintAmount: parseEther("1000"),
    depositAmount: parseEther("1"),
    minimumSupply: BigNumber.from("10").pow("10").toString(),
    managementFee: BigNumber.from("2000000"),
    performanceFee: BigNumber.from("20000000"),
    isPut: false,
    gasLimits: {
      depositWorstCase: 101000,
      depositBestCase: 90000,
    },
  });

  behavesLikeRibbonOptionsVault({
    name: `Ribbon ETH Theta Vault (Put)`,
    tokenName: "Ribbon ETH Theta Vault",
    tokenSymbol: "rETH-THETA-P",
    tokenDecimals: 18,
    depositAssetName: DAI_NAME,
    depositAssetDecimals: DAI_DECIMALS,
    underlying: WETH_ADDRESS[chainId],
    mintAmount: parseEther("1000"),
    depositAmount: parseEther("1"),
    minimumSupply: BigNumber.from("10").pow("3").toString(),
    managementFee: BigNumber.from("2000000"),
    performanceFee: BigNumber.from("20000000"),
    isPut: true,
    gasLimits: {
      depositWorstCase: 115000,
      depositBestCase: 98000,
    },
  });
});

// /**
//  *
//  * @param {Object} params - Parameter of option vault
//  * @param {string} params.name - Name of test
//  * @param {string} params.tokenName - Name of Option Vault
//  * @param {string} params.tokenSymbol - Symbol of Option Vault
//  * @param {number} params.tokenDecimals - Decimals of the vault shares
//  * @param {string} params.mockAsset - Address of assets
//  * @param {string} params.depositAssetName - Name of collateral mockAsset contract
//  * @param {string} params.strikeAsset - Address of strike assets
//  * @param {string} params.underlying - Address of mockAsset used for collateral
//  * @param {string} params.chainlinkPricer - Address of chainlink pricer
//  * @param {BigNumber} params.deltaFirstOption - Delta of first option
//  * @param {BigNumber} params.deltaSecondOption - Delta of second option
//  * @param {BigNumber} params.deltaStep - Step to use for iterating over strike prices and corresponding deltas
//  * @param {Object=} params.mintConfig - Optional: For minting mockAsset, if mockAsset can be minted
//  * @param {string} params.mintConfig.contractOwnerAddress - Impersonate address of mintable mockAsset contract owner
//  * @param {BigNumber} params.depositAmount - Deposit amount
//  * @param {string} params.minimumSupply - Minimum supply to maintain for share and mockAsset balance
//  * @param {BigNumber} params.expectedMintAmount - Expected oToken amount to be minted with our deposit
//  * @param {number} params.auctionDuration - Duration of gnosis auction in seconds
//  * @param {BigNumber} params.premiumDiscount - Premium discount of the sold options to incentivize arbitraguers (thousandths place: 000 - 999)
//  * @param {BigNumber} params.managementFee - Management fee (6 decimals)
//  * @param {BigNumber} params.performanceFee - PerformanceFee fee (6 decimals)
//  * @param {boolean} params.isPut - Boolean flag for if the vault sells call or put options
//  * @param {boolean} params.isUsdcAuction - Boolean flag whether auction is denominated in USDC
//  * @param {Object=} params.swapPath - Swap path for DEX swaps
//  * @param {string[]} params.swapPath.tokens - List of tokens e.g. USDC, WETH
//  * @param {number[]} params.swapPath.fees - List of fees for each pools .e.g 10000 (1%)
//  * @param {number[]} params.availableChains - ChainIds where the tests for the vault will be executed
//  */
function behavesLikeRibbonOptionsVault(params: {
  name: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimals: number;
  depositAssetName: string;
  depositAssetDecimals: number;
  underlying: string;
  mintAmount: BigNumber;
  depositAmount: BigNumber;
  minimumSupply: string;
  managementFee: BigNumber;
  performanceFee: BigNumber;
  isPut: boolean;
  gasLimits: {
    depositWorstCase: number;
    depositBestCase: number;
  };
}) {
  // Addresses
  let owner: string, keeper: string, user: string, feeRecipient: string;

  // Signers
  let adminSigner: SignerWithAddress,
    userSigner: SignerWithAddress,
    ownerSigner: SignerWithAddress,
    keeperSigner: SignerWithAddress,
    feeRecipientSigner: SignerWithAddress;

  // Parameters
  let tokenName = params.tokenName;
  let tokenSymbol = params.tokenSymbol;
  let tokenDecimals = params.tokenDecimals;
  let minimumSupply = params.minimumSupply;
  let depositAssetName = params.depositAssetName;
  let depositAssetDecimals = params.depositAssetDecimals;
  let underlying = params.underlying;
  let mintAmount = params.mintAmount;
  let depositAmount = params.depositAmount;
  let managementFee = params.managementFee;
  let performanceFee = params.performanceFee;
  let isPut = params.isPut;

  // Contracts
  let vaultLifecycleLib: Contract;
  let vault: Contract;
  let mockAsset: Contract;

  describe.only(`${params.name}`, () => {
    let initSnapshotId: string;

    before(async function () {
      // Reset block
      await network.provider.request({
        method: "hardhat_reset",
        params: [
          {
            forking: {
              jsonRpcUrl: TEST_URI[chainId],
              blockNumber: BLOCK_NUMBER[chainId],
            },
          },
        ],
      });

      initSnapshotId = await time.takeSnapshot();

      [adminSigner, ownerSigner, keeperSigner, userSigner, feeRecipientSigner] =
        await ethers.getSigners();

      owner = ownerSigner.address;
      keeper = keeperSigner.address;
      user = userSigner.address;
      feeRecipient = feeRecipientSigner.address;

      const topOfPeriod = (await time.getTopOfPeriod()) + time.PERIOD;
      await time.increaseTo(topOfPeriod);

      let MockERC20Factory = await getContractFactory("MockERC20");

      if (depositAssetName === WETH_NAME) {
        mockAsset = await new MockWETH9__factory(adminSigner).deploy();
        await mockAsset.deposit({ value: mintAmount });
      } else {
        mockAsset = await MockERC20Factory.deploy(
          depositAssetName,
          depositAssetName,
          mintAmount,
          depositAssetDecimals
        );
      }

      await mockAsset.transfer(owner, parseEther("100"));
      await mockAsset.transfer(keeper, parseEther("100"));
      await mockAsset.transfer(user, parseEther("100"));

      const VaultLifecycle = await ethers.getContractFactory("VaultLifecycle");
      vaultLifecycleLib = await VaultLifecycle.deploy();

      const initializeArgs = [
        [
          owner,
          keeper,
          feeRecipient,
          managementFee,
          performanceFee,
          tokenName,
          tokenSymbol,
        ],
        [
          isPut,
          tokenDecimals,
          mockAsset.address,
          underlying,
          minimumSupply,
          parseUnits("500", tokenDecimals > 18 ? tokenDecimals : 18),
        ],
      ];

      vault = (
        await deployProxy(
          "RibbonVault",
          adminSigner,
          initializeArgs,
          [
            depositAssetName === WETH_NAME
              ? mockAsset.address
              : WETH_ADDRESS[chainId],
          ],
          {
            libraries: {
              VaultLifecycle: vaultLifecycleLib.address,
            },
          }
        )
      ).connect(userSigner);

      await vault.initRounds(50);
    });

    after(async () => {
      await time.revertToSnapShot(initSnapshotId);
    });

    let testVault: Contract;
    describe("#initialize", () => {
      time.revertToSnapshotAfterEach(async function () {
        const RibbonVault = await ethers.getContractFactory("RibbonVault", {
          libraries: {
            VaultLifecycle: vaultLifecycleLib.address,
          },
        });

        const wethAddress =
          depositAssetName === WETH_NAME
            ? mockAsset.address
            : WETH_ADDRESS[chainId];

        testVault = await RibbonVault.deploy(wethAddress);
      });

      it("initializes with correct values", async function () {
        assert.equal(
          (await vault.cap()).toString(),
          parseUnits("500", tokenDecimals > 18 ? tokenDecimals : 18)
        );
        assert.equal(await vault.owner(), owner);
        assert.equal(await vault.keeper(), keeper);
        assert.equal(await vault.feeRecipient(), feeRecipient);
        assert.equal(
          (await vault.managementFee()).toString(),
          managementFee.mul(FEE_SCALING).div(WEEKS_PER_YEAR).toString()
        );
        assert.equal(
          (await vault.performanceFee()).toString(),
          performanceFee.toString()
        );

        const [
          isPut,
          decimals,
          assetAddress,
          underlyingAddress,
          minimumSupply,
          cap,
        ] = await vault.vaultParams();

        assert.equal(await decimals, tokenDecimals);
        assert.equal(decimals, tokenDecimals);
        assert.equal(assetAddress, mockAsset.address);
        assert.equal(underlyingAddress, underlying);
        assert.equal(
          await vault.WETH(),
          depositAssetName === WETH_NAME
            ? mockAsset.address
            : WETH_ADDRESS[chainId]
        );
        assert.bnEqual(await vault.totalPending(), BigNumber.from(0));
        assert.equal(minimumSupply, params.minimumSupply);
        assert.equal(isPut, params.isPut);
        assert.bnEqual(
          cap,
          parseUnits("500", tokenDecimals > 18 ? tokenDecimals : 18)
        );
      });

      it("cannot be initialized twice", async function () {
        await expect(
          vault.initialize(
            [
              owner,
              keeper,
              feeRecipient,
              managementFee,
              performanceFee,
              tokenName,
              tokenSymbol,
            ],
            [
              isPut,
              tokenDecimals,
              mockAsset.address,
              underlying,
              minimumSupply,
              parseEther("500"),
            ]
          )
        ).to.be.revertedWith("Initializable: contract is already initialized");
      });

      it("reverts when initializing with 0 owner", async function () {
        await expect(
          testVault.initialize(
            [
              constants.AddressZero,
              keeper,
              feeRecipient,
              managementFee,
              performanceFee,
              tokenName,
              tokenSymbol,
            ],
            [
              isPut,
              tokenDecimals,
              mockAsset.address,
              underlying,
              minimumSupply,
              parseEther("500"),
            ]
          )
        ).to.be.revertedWith("!owner");
      });

      it("reverts when initializing with 0 keeper", async function () {
        await expect(
          testVault.initialize(
            [
              owner,
              constants.AddressZero,
              feeRecipient,
              managementFee,
              performanceFee,
              tokenName,
              tokenSymbol,
            ],
            [
              isPut,
              tokenDecimals,
              mockAsset.address,
              underlying,
              minimumSupply,
              parseEther("500"),
            ]
          )
        ).to.be.revertedWith("!keeper");
      });

      it("reverts when initializing with 0 feeRecipient", async function () {
        await expect(
          testVault.initialize(
            [
              owner,
              keeper,
              constants.AddressZero,
              managementFee,
              performanceFee,
              tokenName,
              tokenSymbol,
            ],
            [
              isPut,
              tokenDecimals,
              mockAsset.address,
              underlying,
              minimumSupply,
              parseEther("500"),
            ]
          )
        ).to.be.revertedWith("!feeRecipient");
      });

      it("reverts when initializing with 0 initCap", async function () {
        await expect(
          testVault.initialize(
            [
              owner,
              keeper,
              feeRecipient,
              managementFee,
              performanceFee,
              tokenName,
              tokenSymbol,
            ],
            [
              isPut,
              tokenDecimals,
              mockAsset.address,
              underlying,
              minimumSupply,
              0,
            ]
          )
        ).to.be.revertedWith("!cap");
      });

      it("reverts when mockAsset is 0x", async function () {
        await expect(
          testVault.initialize(
            [
              owner,
              keeper,
              feeRecipient,
              managementFee,
              performanceFee,
              tokenName,
              tokenSymbol,
            ],
            [
              isPut,
              tokenDecimals,
              constants.AddressZero,
              underlying,
              minimumSupply,
              parseEther("500"),
            ]
          )
        ).to.be.revertedWith("!asset");
      });
    });

    describe("#setCap", () => {
      time.revertToSnapshotAfterEach();

      it("should revert if not owner", async function () {
        await expect(
          vault.connect(userSigner).setCap(parseEther("10"))
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });

      it("should set the new cap", async function () {
        const tx = await vault.connect(ownerSigner).setCap(parseEther("10"));
        assert.equal((await vault.cap()).toString(), parseEther("10"));
        await expect(tx)
          .to.emit(vault, "CapSet")
          .withArgs(
            parseUnits("500", tokenDecimals > 18 ? tokenDecimals : 18),
            parseEther("10")
          );
      });

      it("should revert when depositing over the cap", async function () {
        const capAmount = BigNumber.from("100000000");
        const depositAmount = BigNumber.from("10000000000");

        await vault.connect(ownerSigner).setCap(capAmount);

        await expect(vault.deposit(depositAmount)).to.be.revertedWith(
          "Exceed cap"
        );
      });
    });

    describe("#decimals", () => {
      it("should return 18 for decimals", async function () {
        assert.equal(
          (await vault.decimals()).toString(),
          tokenDecimals.toString()
        );
      });
    });

    describe("#name", () => {
      it("returns the name", async function () {
        assert.equal(await vault.name(), tokenName);
      });
    });

    describe("#symbol", () => {
      it("returns the symbol", async function () {
        assert.equal(await vault.symbol(), tokenSymbol);
      });
    });

    describe("#owner", () => {
      it("returns the owner", async function () {
        assert.equal(await vault.owner(), owner);
      });
    });

    describe("#managementFee", () => {
      it("returns the management fee", async function () {
        assert.equal(
          (await vault.managementFee()).toString(),
          managementFee.mul(FEE_SCALING).div(WEEKS_PER_YEAR).toString()
        );
      });
    });

    describe("#performanceFee", () => {
      it("returns the performance fee", async function () {
        assert.equal(
          (await vault.performanceFee()).toString(),
          performanceFee.toString()
        );
      });
    });

    describe("#setNewKeeper", () => {
      time.revertToSnapshotAfterTest();

      it("set new keeper to owner", async function () {
        assert.equal(await vault.keeper(), keeper);
        await vault.connect(ownerSigner).setNewKeeper(owner);
        assert.equal(await vault.keeper(), owner);
      });

      it("reverts when not owner call", async function () {
        await expect(vault.setNewKeeper(owner)).to.be.revertedWith(
          "caller is not the owner"
        );
      });
    });

    describe("#setFeeRecipient", () => {
      time.revertToSnapshotAfterTest();

      it("reverts when setting 0x0 as feeRecipient", async function () {
        await expect(
          vault.connect(ownerSigner).setFeeRecipient(constants.AddressZero)
        ).to.be.revertedWith("!newFeeRecipient");
      });

      it("reverts when not owner call", async function () {
        await expect(vault.setFeeRecipient(owner)).to.be.revertedWith(
          "caller is not the owner"
        );
      });

      it("changes the fee recipient", async function () {
        await vault.connect(ownerSigner).setFeeRecipient(owner);
        assert.equal(await vault.feeRecipient(), owner);
      });
    });

    describe("#setManagementFee", () => {
      time.revertToSnapshotAfterTest();

      it("setManagementFee to 0", async function () {
        await vault.connect(ownerSigner).setManagementFee(0);
        assert.bnEqual(await vault.managementFee(), BigNumber.from(0));
      });

      it("reverts when not owner call", async function () {
        await expect(
          vault.setManagementFee(BigNumber.from("1000000").toString())
        ).to.be.revertedWith("caller is not the owner");
      });

      it("changes the management fee", async function () {
        await vault
          .connect(ownerSigner)
          .setManagementFee(BigNumber.from("1000000").toString());
        assert.equal(
          (await vault.managementFee()).toString(),
          BigNumber.from(1000000)
            .mul(FEE_SCALING)
            .div(WEEKS_PER_YEAR)
            .toString()
        );
      });
    });

    describe("#setPerformanceFee", () => {
      time.revertToSnapshotAfterTest();

      it("setPerformanceFee to 0", async function () {
        await vault.connect(ownerSigner).setPerformanceFee(0);
        assert.bnEqual(await vault.performanceFee(), BigNumber.from(0));
      });

      it("reverts when not owner call", async function () {
        await expect(
          vault.setPerformanceFee(BigNumber.from("1000000").toString())
        ).to.be.revertedWith("caller is not the owner");
      });

      it("changes the performance fee", async function () {
        await vault
          .connect(ownerSigner)
          .setPerformanceFee(BigNumber.from("1000000").toString());
        assert.equal(
          (await vault.performanceFee()).toString(),
          BigNumber.from("1000000").toString()
        );
      });
    });

    describe("#shares", () => {
      time.revertToSnapshotAfterEach();

      it("shows correct share balance after redemptions", async function () {
        await mockAsset
          .connect(userSigner)
          .approve(vault.address, depositAmount);
        await vault.deposit(depositAmount);

        await time.increaseTo(await vault.nextRoundReadyAt());
        await vault.connect(keeperSigner).rollover();

        assert.bnEqual(await vault.shares(user), depositAmount);

        const redeemAmount = BigNumber.from(1);
        await vault.redeem(redeemAmount);

        // Share balance should remain the same because the 1 share
        // is transferred to the user
        assert.bnEqual(await vault.shares(user), depositAmount);

        await vault.transfer(owner, redeemAmount);

        assert.bnEqual(
          await vault.shares(user),
          depositAmount.sub(redeemAmount)
        );
        assert.bnEqual(await vault.shares(owner), redeemAmount);
      });

      it("returns the total number of shares", async function () {
        await mockAsset
          .connect(userSigner)
          .approve(vault.address, depositAmount);
        await vault.deposit(depositAmount);

        await time.increaseTo(await vault.nextRoundReadyAt());
        await vault.connect(keeperSigner).rollover();

        assert.bnEqual(await vault.shares(user), depositAmount);

        // Should remain the same after redemption because it's held on balanceOf
        await vault.redeem(1);
        assert.bnEqual(await vault.shares(user), depositAmount);
      });
    });

    describe("#shareBalances", () => {
      time.revertToSnapshotAfterEach();

      it("returns the share balances split", async function () {
        await mockAsset
          .connect(userSigner)
          .approve(vault.address, depositAmount);
        await vault.deposit(depositAmount);

        await time.increaseTo(await vault.nextRoundReadyAt());
        await vault.connect(keeperSigner).rollover();

        const [heldByAccount1, heldByVault1] = await vault.shareBalances(user);
        assert.bnEqual(heldByAccount1, BigNumber.from(0));
        assert.bnEqual(heldByVault1, depositAmount);

        await vault.redeem(1);
        const [heldByAccount2, heldByVault2] = await vault.shareBalances(user);
        assert.bnEqual(heldByAccount2, BigNumber.from(1));
        assert.bnEqual(heldByVault2, depositAmount.sub(1));
      });
    });

    describe("#accountVaultBalance", () => {
      time.revertToSnapshotAfterEach();

      it("returns a lesser underlying amount for user", async function () {});
    });

    describe("#withdrawInstantly", () => {
      time.revertToSnapshotAfterEach();

      it("reverts with 0 amount", async function () {
        await mockAsset
          .connect(userSigner)
          .approve(vault.address, depositAmount);
        await vault.deposit(depositAmount);

        await expect(vault.withdrawInstantly(0)).to.be.revertedWith("!amount");
      });

      it("reverts when withdrawing more than available", async function () {
        await mockAsset
          .connect(userSigner)
          .approve(vault.address, depositAmount);
        await vault.deposit(depositAmount);

        await expect(
          vault.withdrawInstantly(depositAmount.add(1))
        ).to.be.revertedWith("Exceed amount");
      });

      it("reverts when deposit receipt is processed", async function () {
        await mockAsset
          .connect(userSigner)
          .approve(vault.address, depositAmount);
        await vault.deposit(depositAmount);

        await time.increaseTo(await vault.nextRoundReadyAt());
        await vault.connect(keeperSigner).rollover();

        await vault.maxRedeem();

        await expect(
          vault.withdrawInstantly(depositAmount.add(1))
        ).to.be.revertedWith("Invalid round");
      });

      it("reverts when withdrawing next round", async function () {
        await mockAsset
          .connect(userSigner)
          .approve(vault.address, depositAmount);
        await vault.deposit(depositAmount);

        await time.increaseTo(await vault.nextRoundReadyAt());
        await vault.connect(keeperSigner).rollover();

        await expect(
          vault.withdrawInstantly(depositAmount.add(1))
        ).to.be.revertedWith("Invalid round");
      });

      //   it("withdraws the amount in deposit receipt", async function () {
      //     await mockAsset
      //       .connect(userSigner)
      //       .approve(vault.address, depositAmount);
      //     await vault.deposit(depositAmount);

      //     let startBalance: BigNumber;
      //     let withdrawAmount: BigNumber;
      //     if (underlying === WETH_ADDRESS[chainId]) {
      //       startBalance = await provider.getBalance(user);
      //     } else {
      //       startBalance = await mockAsset.balanceOf(user);
      //     }

      //     const tx = await vault.withdrawInstantly(depositAmount, { gasPrice });
      //     const receipt = await tx.wait();

      //     if (underlying === WETH_ADDRESS[chainId]) {
      //       const endBalance = await provider.getBalance(user);
      //       withdrawAmount = endBalance
      //         .sub(startBalance)
      //         .add(receipt.gasUsed.mul(gasPrice));
      //     } else {
      //       const endBalance = await mockAsset.balanceOf(user);
      //       withdrawAmount = endBalance.sub(startBalance);
      //     }
      //     assert.bnEqual(withdrawAmount, depositAmount);

      //     await expect(tx)
      //       .to.emit(vault, "InstantWithdraw")
      //       .withArgs(user, depositAmount, 1);

      //     const { round, amount } = await vault.depositReceipts(user);
      //     assert.equal(round, 1);
      //     assert.bnEqual(amount, BigNumber.from(0));

      //     // Should decrement the pending amounts
      //     assert.bnEqual(await vault.totalPending(), BigNumber.from(0));
      //   });
    });

    // Only apply to when assets is WETH
    if (depositAssetName === WETH_NAME) {
      describe("#depositETH", () => {
        time.revertToSnapshotAfterEach();

        it("creates pending deposit successfully", async function () {
          const startBalance = await provider.getBalance(user);

          const depositAmount = parseEther("1");
          const tx = await vault.depositETH({ value: depositAmount, gasPrice });
          const receipt = await tx.wait();
          const gasFee = receipt.gasUsed.mul(gasPrice);

          assert.bnEqual(
            await provider.getBalance(user),
            startBalance.sub(depositAmount).sub(gasFee)
          );

          // Unchanged for share balance and totalSupply
          assert.bnEqual(await vault.totalSupply(), BigNumber.from(0));
          assert.bnEqual(await vault.balanceOf(user), BigNumber.from(0));
          await expect(tx)
            .to.emit(vault, "Deposit")
            .withArgs(user, depositAmount, 1);
          await expect(tx)
            .to.emit(vault, "Deposit")
            .withArgs(user, depositAmount, 1);

          assert.bnEqual(await vault.totalPending(), depositAmount);
          const { round, amount } = await vault.depositReceipts(user);
          assert.equal(round, 1);
          assert.bnEqual(amount, depositAmount);
        });

        it("fits gas budget [ @skip-on-coverage ]", async function () {
          const tx1 = await vault
            .connect(ownerSigner)
            .depositETH({ value: parseEther("0.1") });
          const receipt1 = await tx1.wait();
          assert.isAtMost(receipt1.gasUsed.toNumber(), 130000);

          const tx2 = await vault.depositETH({ value: parseEther("0.1") });
          const receipt2 = await tx2.wait();
          assert.isAtMost(receipt2.gasUsed.toNumber(), 91500);

          // Uncomment to measure precise gas numbers
          // console.log("Worst case depositETH", receipt1.gasUsed.toNumber());
          // console.log("Best case depositETH", receipt2.gasUsed.toNumber());
        });

        it("reverts when no value passed", async function () {
          await expect(
            vault.connect(userSigner).depositETH({ value: 0 })
          ).to.be.revertedWith("!value");
        });

        it("does not inflate the share tokens on initialization", async function () {
          await mockAsset
            .connect(adminSigner)
            .deposit({ value: parseEther("10") });

          await mockAsset
            .connect(adminSigner)
            .transfer(vault.address, parseEther("10"));

          await vault
            .connect(userSigner)
            .depositETH({ value: parseEther("1") });

          assert.isTrue((await vault.balanceOf(user)).isZero());
        });

        it("reverts when minimum shares are not minted", async function () {
          await expect(
            vault.connect(userSigner).depositETH({
              value: BigNumber.from("10").pow("10").sub(BigNumber.from("1")),
            })
          ).to.be.revertedWith("Insufficient balance");
        });
      });
    } else {
      describe("#depositETH", () => {
        it("reverts when mockAsset is not WETH", async function () {
          const depositAmount = parseEther("1");
          await expect(
            vault.depositETH({ value: depositAmount })
          ).to.be.revertedWith("!WETH");
        });
      });
    }

    describe("#deposit", () => {
      time.revertToSnapshotAfterEach();

      it("creates a pending deposit", async function () {
        const startBalance = await mockAsset.balanceOf(user);

        await mockAsset
          .connect(userSigner)
          .approve(vault.address, depositAmount);

        const res = await vault.deposit(depositAmount);

        assert.bnEqual(
          await mockAsset.balanceOf(user),
          startBalance.sub(depositAmount)
        );
        assert.isTrue((await vault.totalSupply()).isZero());
        assert.isTrue((await vault.balanceOf(user)).isZero());
        await expect(res)
          .to.emit(vault, "Deposit")
          .withArgs(user, depositAmount, 1);

        assert.bnEqual(await vault.totalPending(), depositAmount);
        const { round, amount } = await vault.depositReceipts(user);
        assert.equal(round, 1);
        assert.bnEqual(amount, depositAmount);
      });

      it("tops up existing deposit", async function () {
        const startBalance = await mockAsset.balanceOf(user);
        const totalDepositAmount = depositAmount.mul(BigNumber.from(2));

        await mockAsset
          .connect(userSigner)
          .approve(vault.address, totalDepositAmount);

        await vault.deposit(depositAmount);

        const tx = await vault.deposit(depositAmount);

        assert.bnEqual(
          await mockAsset.balanceOf(user),
          startBalance.sub(totalDepositAmount)
        );
        assert.isTrue((await vault.totalSupply()).isZero());
        assert.isTrue((await vault.balanceOf(user)).isZero());
        await expect(tx)
          .to.emit(vault, "Deposit")
          .withArgs(user, depositAmount, 1);

        assert.bnEqual(await vault.totalPending(), totalDepositAmount);
        const { round, amount } = await vault.depositReceipts(user);
        assert.equal(round, 1);
        assert.bnEqual(amount, totalDepositAmount);
      });

      it("fits gas budget for deposits [ @skip-on-coverage ]", async function () {
        await mockAsset
          .connect(ownerSigner)
          .approve(vault.address, depositAmount);

        await vault.connect(ownerSigner).deposit(depositAmount);

        await mockAsset
          .connect(userSigner)
          .approve(vault.address, depositAmount.mul(2));

        const tx1 = await vault.deposit(depositAmount);

        const receipt1 = await tx1.wait();
        assert.isAtMost(
          receipt1.gasUsed.toNumber(),
          params.gasLimits.depositWorstCase
        );

        const tx2 = await vault.deposit(depositAmount);
        const receipt2 = await tx2.wait();
        assert.isAtMost(
          receipt2.gasUsed.toNumber(),
          params.gasLimits.depositBestCase
        );

        // Uncomment to log gas used
        // console.log("Worst case deposit", receipt1.gasUsed.toNumber());
        // console.log("Best case deposit", receipt2.gasUsed.toNumber());
      });

      it("does not inflate the share tokens on initialization", async function () {
        const depositAmount = BigNumber.from("100000000000");

        await mockAsset
          .connect(adminSigner)
          .transfer(vault.address, depositAmount);

        await mockAsset
          .connect(userSigner)
          .approve(vault.address, BigNumber.from("10000000000"));

        await vault.connect(userSigner).deposit(BigNumber.from("10000000000"));

        // user needs to get back exactly 1 ether
        // even though the total has been incremented
        assert.isTrue((await vault.balanceOf(user)).isZero());
      });

      it("reverts when minimum shares are not minted", async function () {
        await expect(
          vault
            .connect(userSigner)
            .deposit(BigNumber.from(minimumSupply).sub(BigNumber.from("1")))
        ).to.be.revertedWith("Insufficient balance");
      });

      it("updates the previous deposit receipt", async function () {
        await mockAsset
          .connect(userSigner)
          .approve(vault.address, params.depositAmount.mul(2));

        await vault.deposit(params.depositAmount);

        const {
          round: round1,
          amount: amount1,
          unredeemedShares: unredeemedShares1,
        } = await vault.depositReceipts(user);

        assert.equal(round1, 1);
        assert.bnEqual(amount1, params.depositAmount);
        assert.bnEqual(unredeemedShares1, BigNumber.from(0));

        await time.increaseTo(await vault.nextRoundReadyAt());
        await vault.connect(keeperSigner).rollover();

        const {
          round: round2,
          amount: amount2,
          unredeemedShares: unredeemedShares2,
        } = await vault.depositReceipts(user);

        assert.equal(round2, 1);
        assert.bnEqual(amount2, params.depositAmount);
        assert.bnEqual(unredeemedShares2, BigNumber.from(0));

        await vault.deposit(params.depositAmount);

        assert.bnEqual(
          await mockAsset.balanceOf(vault.address),
          params.depositAmount.mul(2)
        );

        // vault will still hold the vault shares
        assert.bnEqual(
          await vault.balanceOf(vault.address),
          params.depositAmount
        );

        const {
          round: round3,
          amount: amount3,
          unredeemedShares: unredeemedShares3,
        } = await vault.depositReceipts(user);

        assert.equal(round3, 2);
        assert.bnEqual(amount3, params.depositAmount);
        assert.bnEqual(unredeemedShares3, params.depositAmount);
      });
    });

    describe("#depositFor", () => {
      time.revertToSnapshotAfterEach();
      let creditor: string;

      beforeEach(async function () {
        creditor = ownerSigner.address.toString();
      });

      it("creates a pending deposit", async function () {
        const startBalance = await mockAsset.balanceOf(user);

        await mockAsset
          .connect(userSigner)
          .approve(vault.address, depositAmount);

        const res = await vault.depositFor(depositAmount, creditor);

        assert.bnEqual(
          await mockAsset.balanceOf(user),
          startBalance.sub(depositAmount)
        );

        assert.isTrue((await vault.totalSupply()).isZero());
        assert.isTrue((await vault.balanceOf(user)).isZero());

        await expect(res)
          .to.emit(vault, "Deposit")
          .withArgs(creditor, depositAmount, 1);

        assert.bnEqual(await vault.totalPending(), depositAmount);

        const { round, amount } = await vault.depositReceipts(creditor);

        assert.equal(round, 1);
        assert.bnEqual(amount, depositAmount);

        const { round2, amount2 } = await vault.depositReceipts(user);

        await expect(round2).to.be.undefined;
        await expect(amount2).to.be.undefined;
      });

      it("tops up existing deposit", async function () {
        const startBalance = await mockAsset.balanceOf(user);
        const totalDepositAmount = depositAmount.mul(BigNumber.from(2));

        await mockAsset
          .connect(userSigner)
          .approve(vault.address, totalDepositAmount);

        await vault.depositFor(depositAmount, creditor);

        const tx = await vault.depositFor(depositAmount, creditor);

        assert.bnEqual(
          await mockAsset.balanceOf(user),
          startBalance.sub(totalDepositAmount)
        );
        assert.isTrue((await vault.totalSupply()).isZero());
        assert.isTrue((await vault.balanceOf(creditor)).isZero());
        await expect(tx)
          .to.emit(vault, "Deposit")
          .withArgs(creditor, depositAmount, 1);

        assert.bnEqual(await vault.totalPending(), totalDepositAmount);
        const { round, amount } = await vault.depositReceipts(creditor);
        assert.equal(round, 1);
        assert.bnEqual(amount, totalDepositAmount);
      });

      it("fits gas budget for deposits [ @skip-on-coverage ]", async function () {
        await mockAsset
          .connect(ownerSigner)
          .approve(vault.address, depositAmount.mul(2));

        await vault.connect(ownerSigner).depositFor(depositAmount, creditor);

        await mockAsset
          .connect(userSigner)
          .approve(vault.address, depositAmount.mul(2));

        const tx1 = await vault.depositFor(depositAmount, creditor);
        const receipt1 = await tx1.wait();
        assert.isAtMost(
          receipt1.gasUsed.toNumber(),
          params.gasLimits.depositWorstCase
        );

        const tx2 = await vault.depositFor(depositAmount, creditor);
        const receipt2 = await tx2.wait();
        assert.isAtMost(
          receipt2.gasUsed.toNumber(),
          params.gasLimits.depositBestCase
        );

        // Uncomment to log gas used
        // console.log("Worst case deposit", receipt1.gasUsed.toNumber());
        // console.log("Best case deposit", receipt2.gasUsed.toNumber());
      });

      it("does not inflate the share tokens on initialization", async function () {
        const depositAmount = BigNumber.from("100000000000");

        await mockAsset
          .connect(adminSigner)
          .transfer(vault.address, depositAmount);

        await mockAsset
          .connect(userSigner)
          .approve(vault.address, BigNumber.from("10000000000"));

        await vault
          .connect(userSigner)
          .depositFor(BigNumber.from("10000000000"), creditor);

        // user needs to get back exactly 1 ether
        // even though the total has been incremented
        assert.isTrue((await vault.balanceOf(creditor)).isZero());
      });

      it("reverts when minimum shares are not minted", async function () {
        await expect(
          vault
            .connect(userSigner)
            .depositFor(
              BigNumber.from(minimumSupply).sub(BigNumber.from("1")),
              creditor
            )
        ).to.be.revertedWith("Insufficient balance");
      });

      it("updates the previous deposit receipt", async function () {
        await mockAsset
          .connect(userSigner)
          .approve(vault.address, params.depositAmount.mul(2));

        await vault.depositFor(params.depositAmount, creditor);

        const {
          round: round1,
          amount: amount1,
          unredeemedShares: unredeemedShares1,
        } = await vault.depositReceipts(creditor);

        assert.equal(round1, 1);
        assert.bnEqual(amount1, params.depositAmount);
        assert.bnEqual(unredeemedShares1, BigNumber.from(0));

        await time.increaseTo(await vault.nextRoundReadyAt());
        await vault.connect(keeperSigner).rollover();

        const {
          round: round2,
          amount: amount2,
          unredeemedShares: unredeemedShares2,
        } = await vault.depositReceipts(creditor);

        assert.equal(round2, 1);
        assert.bnEqual(amount2, params.depositAmount);
        assert.bnEqual(unredeemedShares2, BigNumber.from(0));

        await vault.depositFor(params.depositAmount, creditor);

        assert.bnEqual(
          await mockAsset.balanceOf(vault.address),
          params.depositAmount.mul(2)
        );

        // vault shares will not change until next rollover
        assert.bnEqual(
          await vault.balanceOf(vault.address),
          params.depositAmount
        );

        const {
          round: round3,
          amount: amount3,
          unredeemedShares: unredeemedShares3,
        } = await vault.depositReceipts(creditor);

        assert.equal(round3, 2);
        assert.bnEqual(amount3, params.depositAmount);
        assert.bnEqual(unredeemedShares3, params.depositAmount);
      });
    });

    describe("#initiateWithdraw", () => {
      time.revertToSnapshotAfterEach(async () => {});

      it("reverts when user initiates withdraws without any deposit", async function () {
        await expect(vault.initiateWithdraw(depositAmount)).to.be.revertedWith(
          "ERC20: transfer amount exceeds balance"
        );
      });

      it("reverts when passed 0 shares", async function () {
        await expect(vault.initiateWithdraw(0)).to.be.revertedWith(
          "!numShares"
        );
      });

      it("reverts when withdrawing more than unredeemed balance", async function () {
        await mockAsset
          .connect(userSigner)
          .approve(vault.address, depositAmount);
        await vault.deposit(depositAmount);

        await time.increaseTo(await vault.nextRoundReadyAt());
        await vault.connect(keeperSigner).rollover();

        await expect(
          vault.initiateWithdraw(depositAmount.add(1))
        ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
      });

      it("reverts when withdrawing more than vault + account balance", async function () {
        await mockAsset
          .connect(userSigner)
          .approve(vault.address, depositAmount);
        await vault.deposit(depositAmount);

        await time.increaseTo(await vault.nextRoundReadyAt());
        await vault.connect(keeperSigner).rollover();

        // Move 1 share into account
        await vault.redeem(1);

        await expect(
          vault.initiateWithdraw(depositAmount.add(1))
        ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
      });

      it("reverts when initiating with past existing withdrawal", async function () {
        await mockAsset
          .connect(userSigner)
          .approve(vault.address, depositAmount);
        await vault.deposit(depositAmount);

        await time.increaseTo(await vault.nextRoundReadyAt());
        await vault.connect(keeperSigner).rollover();

        await vault.initiateWithdraw(depositAmount.div(2));

        await time.increaseTo(await vault.nextRoundReadyAt());
        await vault.connect(keeperSigner).rollover();

        await expect(
          vault.initiateWithdraw(depositAmount.div(2))
        ).to.be.revertedWith("Existing withdraw");
      });

      it("creates withdrawal from unredeemed shares", async function () {
        await mockAsset
          .connect(userSigner)
          .approve(vault.address, depositAmount);
        await vault.deposit(depositAmount);

        await time.increaseTo(await vault.nextRoundReadyAt());
        await vault.connect(keeperSigner).rollover();

        const tx = await vault.initiateWithdraw(depositAmount);

        await expect(tx)
          .to.emit(vault, "InitiateWithdraw")
          .withArgs(user, depositAmount, 2);

        await expect(tx)
          .to.emit(vault, "Transfer")
          .withArgs(vault.address, user, depositAmount);

        const { round, shares } = await vault.withdrawals(user);
        assert.equal(round, 2);
        assert.bnEqual(shares, depositAmount);
      });

      it("creates withdrawal by debiting user shares", async function () {
        await mockAsset
          .connect(userSigner)
          .approve(vault.address, depositAmount);
        await vault.deposit(depositAmount);

        await time.increaseTo(await vault.nextRoundReadyAt());
        await vault.connect(keeperSigner).rollover();

        await vault.redeem(depositAmount.div(2));

        const tx = await vault.initiateWithdraw(depositAmount);

        await expect(tx)
          .to.emit(vault, "InitiateWithdraw")
          .withArgs(user, depositAmount, 2);

        // First we redeem the leftover amount
        await expect(tx)
          .to.emit(vault, "Transfer")
          .withArgs(vault.address, user, depositAmount.div(2));

        // Then we debit the shares from the user
        await expect(tx)
          .to.emit(vault, "Transfer")
          .withArgs(user, vault.address, depositAmount);

        assert.bnEqual(await vault.balanceOf(user), BigNumber.from(0));
        assert.bnEqual(await vault.balanceOf(vault.address), depositAmount);

        const { round, shares } = await vault.withdrawals(user);
        assert.equal(round, 2);
        assert.bnEqual(shares, depositAmount);
      });

      it("tops up existing withdrawal", async function () {
        await mockAsset
          .connect(userSigner)
          .approve(vault.address, depositAmount);
        await vault.deposit(depositAmount);

        await time.increaseTo(await vault.nextRoundReadyAt());
        await vault.connect(keeperSigner).rollover();

        const tx1 = await vault.initiateWithdraw(depositAmount.div(2));
        // We redeem the full amount on the first initiateWithdraw
        await expect(tx1)
          .to.emit(vault, "Transfer")
          .withArgs(vault.address, user, depositAmount);
        await expect(tx1)
          .to.emit(vault, "Transfer")
          .withArgs(user, vault.address, depositAmount.div(2));

        const tx2 = await vault.initiateWithdraw(depositAmount.div(2));
        await expect(tx2)
          .to.emit(vault, "Transfer")
          .withArgs(user, vault.address, depositAmount.div(2));

        const { round, shares } = await vault.withdrawals(user);
        assert.equal(round, 2);
        assert.bnEqual(shares, depositAmount);
      });

      it("reverts when there is insufficient balance over multiple calls", async function () {
        await mockAsset
          .connect(userSigner)
          .approve(vault.address, depositAmount);
        await vault.deposit(depositAmount);

        await time.increaseTo(await vault.nextRoundReadyAt());
        await vault.connect(keeperSigner).rollover();

        await vault.initiateWithdraw(depositAmount.div(2));

        await expect(
          vault.initiateWithdraw(depositAmount.div(2).add(1))
        ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
      });

      it("fits gas budget [ @skip-on-coverage ]", async function () {
        await mockAsset
          .connect(userSigner)
          .approve(vault.address, depositAmount);
        await vault.deposit(depositAmount);

        await time.increaseTo(await vault.nextRoundReadyAt());
        await vault.connect(keeperSigner).rollover();

        const tx = await vault.initiateWithdraw(depositAmount);
        const receipt = await tx.wait();
        assert.isAtMost(receipt.gasUsed.toNumber(), 105000);
        // console.log("initiateWithdraw", receipt.gasUsed.toNumber());
      });
    });

    describe("#completeWithdraw", () => {
      time.revertToSnapshotAfterEach(async () => {
        await mockAsset
          .connect(userSigner)
          .approve(vault.address, depositAmount);

        await vault.deposit(depositAmount);
        await mockAsset.connect(userSigner).transfer(owner, depositAmount);

        await mockAsset
          .connect(ownerSigner)
          .approve(vault.address, depositAmount);

        await vault.connect(ownerSigner).deposit(depositAmount);

        await time.increaseTo(await vault.nextRoundReadyAt());
        await vault.connect(keeperSigner).rollover();

        await vault.initiateWithdraw(depositAmount);
      });

      it("reverts when not initiated", async function () {
        await expect(
          vault.connect(ownerSigner).completeWithdraw()
        ).to.be.revertedWith("Not initiated");
      });

      it("reverts when round not closed", async function () {
        await expect(vault.completeWithdraw()).to.be.revertedWith(
          "Round not closed"
        );
      });

      it("reverts when calling completeWithdraw twice", async function () {
        await time.increaseTo(await vault.nextRoundReadyAt());
        await vault.connect(keeperSigner).rollover();

        await vault.completeWithdraw();
        await expect(vault.completeWithdraw()).to.be.revertedWith(
          "Not initiated"
        );
      });

      // it("completes the withdrawal", async function () {
      //   const firstStrikePrice = firstOptionStrike;
      //   const settlePriceITM = isPut
      //     ? firstStrikePrice.sub(100000000)
      //     : firstStrikePrice.add(100000000);
      //   await rollToSecondOption(settlePriceITM);
      //   const pricePerShare = await vault.roundPricePerShare(2);
      //   const withdrawAmount = depositAmount
      //     .mul(pricePerShare)
      //     .div(BigNumber.from(10).pow(await vault.decimals()));
      //   const lastQueuedWithdrawAmount = await vault.lastQueuedWithdrawAmount();
      //   let beforeBalance: BigNumber;
      //   if (underlying === WETH_ADDRESS[chainId]) {
      //     beforeBalance = await provider.getBalance(user);
      //   } else {
      //     beforeBalance = await mockAsset.balanceOf(user);
      //   }
      //   const { queuedWithdrawShares: startQueuedShares } =
      //     await vault.vaultState();
      //   const tx = await vault.completeWithdraw({ gasPrice });
      //   const receipt = await tx.wait();
      //   const gasFee = receipt.gasUsed.mul(gasPrice);
      //   await expect(tx)
      //     .to.emit(vault, "Withdraw")
      //     .withArgs(user, withdrawAmount.toString(), depositAmount);
      //   if (underlying !== WETH_ADDRESS[chainId]) {
      //     const collateralERC20 = await getContractAt(
      //       "IERC20",
      //       underlying
      //     );
      //     await expect(tx)
      //       .to.emit(collateralERC20, "Transfer")
      //       .withArgs(vault.address, user, withdrawAmount);
      //   }
      //   const { shares, round } = await vault.withdrawals(user);
      //   assert.equal(shares, 0);
      //   assert.equal(round, 2);
      //   const { queuedWithdrawShares: endQueuedShares } =
      //     await vault.vaultState();
      //   assert.bnEqual(endQueuedShares, BigNumber.from(0));
      //   assert.bnEqual(
      //     await vault.lastQueuedWithdrawAmount(),
      //     lastQueuedWithdrawAmount.sub(withdrawAmount)
      //   );
      //   assert.bnEqual(startQueuedShares.sub(endQueuedShares), depositAmount);
      //   let actualWithdrawAmount: BigNumber;
      //   if (underlying === WETH_ADDRESS[chainId]) {
      //     const afterBalance = await provider.getBalance(user);
      //     actualWithdrawAmount = afterBalance.sub(beforeBalance).add(gasFee);
      //   } else {
      //     const afterBalance = await mockAsset.balanceOf(user);
      //     actualWithdrawAmount = afterBalance.sub(beforeBalance);
      //   }
      //   // Should be less because the pps is down
      //   assert.bnLt(actualWithdrawAmount, depositAmount);
      //   assert.bnEqual(actualWithdrawAmount, withdrawAmount);
      // });

      it("fits gas budget [ @skip-on-coverage ]", async function () {
        await time.increaseTo(await vault.nextRoundReadyAt());
        await vault.connect(keeperSigner).rollover();

        const tx = await vault.completeWithdraw({ gasPrice });
        const receipt = await tx.wait();

        assert.isAtMost(receipt.gasUsed.toNumber(), 100342);
        // console.log(
        //   params.name,
        //   "completeWithdraw",
        //   receipt.gasUsed.toNumber()
        // );
      });
    });

    describe("#rollover", () => {
      const depositAmount = params.depositAmount;

      time.revertToSnapshotAfterEach(async function () {});

      it("reverts when not called with keeper", async function () {
        await expect(vault.connect(ownerSigner).rollover()).to.be.revertedWith(
          "!keeper"
        );
      });

      it("reverts when calling before round expiry", async function () {
        await expect(vault.connect(keeperSigner).rollover()).to.be.revertedWith(
          "!ready"
        );
      });

      it("fits gas budget [ @skip-on-coverage ]", async function () {
        // await vault.connect(ownerSigner).commitAndClose();
        await time.increaseTo(await vault.nextRoundReadyAt());

        const tx = await vault.connect(keeperSigner).rollover();
        const receipt = await tx.wait();

        assert.isAtMost(receipt.gasUsed.toNumber(), 967000); //963542, 1082712
        // console.log("rollover", receipt.gasUsed.toNumber());
      });
    });

    describe("#maxRedeem", () => {
      time.revertToSnapshotAfterEach(async function () {});

      it("is able to redeem deposit at new price per share", async function () {
        await mockAsset
          .connect(userSigner)
          .approve(vault.address, params.depositAmount);

        await vault.deposit(params.depositAmount);

        await time.increaseTo(await vault.nextRoundReadyAt());
        await vault.connect(keeperSigner).rollover();

        const tx = await vault.maxRedeem();

        assert.bnEqual(
          await mockAsset.balanceOf(vault.address),
          params.depositAmount
        );

        assert.bnEqual(await vault.balanceOf(user), params.depositAmount);
        assert.bnEqual(await vault.balanceOf(vault.address), BigNumber.from(0));

        await expect(tx)
          .to.emit(vault, "Redeem")
          .withArgs(user, params.depositAmount, 1);

        const { round, amount, unredeemedShares } = await vault.depositReceipts(
          user
        );

        assert.equal(round, 1);
        assert.bnEqual(amount, BigNumber.from(0));
        assert.bnEqual(unredeemedShares, BigNumber.from(0));
      });

      it("changes user and vault balances only once when redeeming twice", async function () {
        await mockAsset
          .connect(userSigner)
          .approve(vault.address, params.depositAmount);

        await vault.deposit(params.depositAmount);

        await time.increaseTo(await vault.nextRoundReadyAt());
        await vault.connect(keeperSigner).rollover();

        await vault.maxRedeem();

        assert.bnEqual(
          await mockAsset.balanceOf(vault.address),
          params.depositAmount
        );

        assert.bnEqual(await vault.balanceOf(user), params.depositAmount);
        assert.bnEqual(await vault.balanceOf(vault.address), BigNumber.from(0));

        const { round, amount, unredeemedShares } = await vault.depositReceipts(
          user
        );

        assert.equal(round, 1);
        assert.bnEqual(amount, BigNumber.from(0));
        assert.bnEqual(unredeemedShares, BigNumber.from(0));

        let res = await vault.maxRedeem();

        await expect(res).to.not.emit(vault, "Transfer");

        assert.bnEqual(
          await mockAsset.balanceOf(vault.address),
          params.depositAmount
        );
        assert.bnEqual(await vault.balanceOf(user), params.depositAmount);
        assert.bnEqual(await vault.balanceOf(vault.address), BigNumber.from(0));
      });

      it("redeems after a deposit what was unredeemed from previous rounds", async function () {
        await mockAsset
          .connect(userSigner)
          .approve(vault.address, params.depositAmount.mul(2));
        await vault.deposit(params.depositAmount);

        await time.increaseTo(await vault.nextRoundReadyAt());
        await vault.connect(keeperSigner).rollover();

        await vault.deposit(params.depositAmount);

        const tx = await vault.maxRedeem();

        await expect(tx)
          .to.emit(vault, "Redeem")
          .withArgs(user, params.depositAmount, 2);
      });

      // it("is able to redeem deposit at correct pricePerShare after closing short in the money", async function () {});
    });

    describe("#redeem", () => {
      time.revertToSnapshotAfterEach();
      it("reverts when 0 passed", async function () {
        await mockAsset
          .connect(userSigner)
          .approve(vault.address, depositAmount);
        await vault.deposit(depositAmount);

        await time.increaseTo(await vault.nextRoundReadyAt());
        await vault.connect(keeperSigner).rollover();

        await expect(vault.redeem(0)).to.be.revertedWith("!numShares");
      });

      it("reverts when redeeming more than available", async function () {
        await mockAsset
          .connect(userSigner)
          .approve(vault.address, depositAmount);

        await vault.deposit(depositAmount);

        await time.increaseTo(await vault.nextRoundReadyAt());
        await vault.connect(keeperSigner).rollover();

        await expect(vault.redeem(depositAmount.add(1))).to.be.revertedWith(
          "Exceeds available"
        );
      });

      it("decreases unredeemed shares", async function () {
        await mockAsset
          .connect(userSigner)
          .approve(vault.address, depositAmount);

        await vault.deposit(depositAmount);

        await time.increaseTo(await vault.nextRoundReadyAt());
        await vault.connect(keeperSigner).rollover();

        const redeemAmount = BigNumber.from(1);
        const tx1 = await vault.redeem(redeemAmount);

        await expect(tx1)
          .to.emit(vault, "Redeem")
          .withArgs(user, redeemAmount, 1);

        const {
          round: round1,
          amount: amount1,
          unredeemedShares: unredeemedShares1,
        } = await vault.depositReceipts(user);

        assert.equal(round1, 1);
        assert.bnEqual(amount1, BigNumber.from(0));
        assert.bnEqual(unredeemedShares1, depositAmount.sub(redeemAmount));

        const tx2 = await vault.redeem(depositAmount.sub(redeemAmount));
        await expect(tx2)
          .to.emit(vault, "Redeem")
          .withArgs(user, depositAmount.sub(redeemAmount), 1);

        const {
          round: round2,
          amount: amount2,
          unredeemedShares: unredeemedShares2,
        } = await vault.depositReceipts(user);

        assert.equal(round2, 1);
        assert.bnEqual(amount2, BigNumber.from(0));
        assert.bnEqual(unredeemedShares2, BigNumber.from(0));
      });
    });
  });
}

async function depositIntoVault(
  mockAsset: string,
  vault: Contract,
  amount: BigNumberish,
  signer?: SignerWithAddress
) {
  if (typeof signer !== "undefined") {
    vault = vault.connect(signer);
  }
  if (mockAsset === WETH_ADDRESS[chainId]) {
    await vault.depositETH({ value: amount });
  } else {
    await vault.deposit(amount);
  }
}
