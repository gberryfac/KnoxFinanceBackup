import { ethers, network } from "hardhat";
import { BigNumber, constants, Contract } from "ethers";

const { getContractFactory, getContractAt, provider } = ethers;
const { parseUnits, parseEther } = ethers.utils;

import { expect } from "chai";
import moment from "moment-timezone";

import * as time from "./helpers/time";
import * as fixtures from "./helpers/fixtures";
import * as types from "./helpers/types";

import { assert } from "./helpers/assertions";

import {
  WHALE_ADDRESS,
  LP_TOKEN_ID,
  TEST_URI,
  FEE_SCALING,
  WEEKS_PER_YEAR,
  BLOCK_NUMBER,
  WETH_ADDRESS,
  WETH_DECIMALS,
  DAI_DECIMALS,
  DAI_ADDRESS,
} from "../constants";

import { MockRegistry__factory } from "../types";

const gasPrice = parseUnits("100", "gwei");
const chainId = network.config.chainId;

moment.tz.setDefault("UTC");

let block;
describe("BaseVault", () => {
  behavesLikeRibbonOptionsVault({
    whale: WHALE_ADDRESS[chainId],
    name: `Ribbon ETH Theta Vault (Call)`,
    tokenName: "Ribbon ETH Theta Vault",
    tokenSymbol: "rETH-THETA",
    tokenDecimals: 18,
    depositAsset: WETH_ADDRESS[chainId],
    depositAssetDecimals: WETH_DECIMALS,
    baseAssetDecimals: DAI_DECIMALS,
    underlyingAssetDecimals: WETH_DECIMALS,
    underlyingAsset: WETH_ADDRESS[chainId],
    depositAmount: parseEther("10"),
    minimumSupply: BigNumber.from("10").pow("10").toString(),
    minimumContractSize: BigNumber.from("10").pow("17").toString(),
    managementFee: BigNumber.from("2000000"),
    performanceFee: BigNumber.from("20000000"),
    isCall: true,
    gasLimits: {
      depositWorstCase: 101000,
      depositBestCase: 90000,
    },
  });

  behavesLikeRibbonOptionsVault({
    whale: WHALE_ADDRESS[chainId],
    name: `Ribbon ETH Theta Vault (Put)`,
    tokenName: "Ribbon ETH Theta Vault",
    tokenSymbol: "rETH-THETA-P",
    tokenDecimals: 18,
    depositAsset: DAI_ADDRESS[chainId],
    depositAssetDecimals: DAI_DECIMALS,
    baseAssetDecimals: DAI_DECIMALS,
    underlyingAssetDecimals: WETH_DECIMALS,
    underlyingAsset: WETH_ADDRESS[chainId],
    depositAmount: parseEther("10"),
    minimumSupply: BigNumber.from("10").pow("3").toString(),
    minimumContractSize: BigNumber.from("10").pow("17").toString(),
    managementFee: BigNumber.from("2000000"),
    performanceFee: BigNumber.from("20000000"),
    isCall: false,
    gasLimits: {
      depositWorstCase: 115000,
      depositBestCase: 98000,
    },
  });
});

// /**
//  *
//  * @param {Object} params - Parameter of option vaultContract
//  * @param {string} params.name - Name of test
//  * @param {string} params.tokenName - Name of Option Vault
//  * @param {string} params.tokenSymbol - Symbol of Option Vault
//  * @param {number} params.tokenDecimals - Decimals of the vaultContract shares
//  * @param {string} params.assetContract - Address of assets
//  * @param {string} params.depositAssetName - Name of collateral assetContract contract
//  * @param {string} params.strikeAsset - Address of strike assets
//  * @param {string} params.underlyingAsset - Address of assetContract used for collateral
//  * @param {string} params.chainlinkPricer - Address of chainlink pricer
//  * @param {BigNumber} params.deltaFirstOption - Delta of first option
//  * @param {BigNumber} params.deltaSecondOption - Delta of second option
//  * @param {BigNumber} params.deltaStep - Step to use for iterating over strike prices and corresponding deltas
//  * @param {Object=} params.mintConfig - Optional: For minting assetContract, if assetContract can be minted
//  * @param {string} params.mintConfig.contractOwnerAddress - Impersonate address of mintable assetContract contract addresses.owner
//  * @param {BigNumber} params.depositAmount - Deposit amount
//  * @param {string} params.minimumSupply - Minimum supply to maintain for share and assetContract balance
//  * @param {BigNumber} params.expectedMintAmount - Expected oToken amount to be minted with our deposit
//  * @param {number} params.auctionDuration - Duration of gnosis auction in seconds
//  * @param {BigNumber} params.premiumDiscount - Premium discount of the sold options to incentivize arbitraguers (thousandths place: 000 - 999)
//  * @param {BigNumber} params.managementFee - Management fee (6 decimals)
//  * @param {BigNumber} params.performanceFee - PerformanceFee fee (6 decimals)
//  * @param {boolean} params.isCall - Boolean flag for if the vaultContract sells call or put options
//  * @param {boolean} params.isUsdcAuction - Boolean flag whether auction is denominated in USDC
//  * @param {Object=} params.swapPath - Swap path for DEX swaps
//  * @param {string[]} params.swapPath.tokens - List of tokens e.g. USDC, WETH
//  * @param {number[]} params.swapPath.fees - List of fees for each pools .e.g 10000 (1%)
//  * @param {number[]} params.availableChains - ChainIds where the tests for the vaultContract will be executed
//  */
function behavesLikeRibbonOptionsVault(params: {
  whale: string;
  name: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimals: number;
  depositAsset: string;
  depositAssetDecimals: number;
  baseAssetDecimals: number;
  underlyingAssetDecimals: number;
  underlyingAsset: string;
  depositAmount: BigNumber;
  minimumSupply: string;
  minimumContractSize: string;
  managementFee: BigNumber;
  performanceFee: BigNumber;
  isCall: boolean;
  gasLimits: {
    depositWorstCase: number;
    depositBestCase: number;
  };
}) {
  let signers: types.Signers;
  let addresses: types.Addresses;
  let knoxTokenAddress: string;

  let whale = params.whale;

  // Parameters
  let tokenName = params.tokenName;
  let tokenDecimals = params.tokenDecimals;
  let minimumSupply = params.minimumSupply;
  let minimumContractSize = params.minimumContractSize;
  let depositAsset = params.depositAsset;
  let depositAssetDecimals = params.depositAssetDecimals;
  let baseAssetDecimals = params.baseAssetDecimals;
  let underlyingAssetDecimals = params.underlyingAssetDecimals;
  let underlyingAsset = params.underlyingAsset;
  let depositAmount = params.depositAmount;
  let managementFee = params.managementFee;
  let performanceFee = params.performanceFee;
  let isCall = params.isCall;

  // Contracts
  let vaultLifecycleLibrary: Contract;
  let vaultLogicLibrary: Contract;
  let vaultDisplayLib: Contract;
  let vaultContract: Contract;
  let mockRegistry: Contract;
  let assetContract: Contract;
  let mockPremiaPool: Contract;
  let knoxTokenContract: Contract;

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
      block = await provider.getBlock(await provider.getBlockNumber());

      signers = await fixtures.getSigners();
      addresses = await fixtures.getAddresses(signers);

      let mockPremiaPoolFactory = await getContractFactory("MockPremiaPool");

      mockPremiaPool = await mockPremiaPoolFactory.deploy(
        depositAssetDecimals,
        baseAssetDecimals,
        depositAsset
      );

      const VaultDisplay = await ethers.getContractFactory("VaultDisplay");
      vaultDisplayLib = await VaultDisplay.deploy();

      const VaultLifecycle = await ethers.getContractFactory("VaultLifecycle");
      vaultLifecycleLibrary = await VaultLifecycle.deploy();

      const VaultLogic = await ethers.getContractFactory("VaultLogic");
      vaultLogicLibrary = await VaultLogic.deploy();

      mockRegistry = await new MockRegistry__factory(signers.admin).deploy(
        true
      );

      assetContract = await getContractAt("IAsset", depositAsset);

      [signers, addresses, assetContract] = await fixtures.impersonateWhale(
        whale,
        depositAsset,
        depositAssetDecimals,
        signers,
        addresses
      );

      [vaultContract, knoxTokenContract] = await fixtures.getThetaVaultFixture(
        mockPremiaPool,
        vaultLifecycleLibrary,
        vaultLogicLibrary,
        mockRegistry,
        tokenName,
        tokenDecimals,
        depositAsset,
        depositAssetDecimals,
        underlyingAssetDecimals,
        underlyingAsset,
        minimumSupply,
        minimumContractSize,
        managementFee,
        performanceFee,
        isCall,
        signers,
        addresses
      );

      knoxTokenAddress = knoxTokenContract.address;
    });

    after(async () => {
      await time.revertToSnapShot(initSnapshotId);
    });

    let testVault: Contract;
    describe("#initialize", () => {
      time.revertToSnapshotAfterEach(async function () {
        const BaseVault = await ethers.getContractFactory("BaseVault", {
          libraries: {
            VaultLifecycle: vaultLifecycleLibrary.address,
            VaultLogic: vaultLogicLibrary.address,
          },
        });

        const wethAddress =
          depositAsset === WETH_ADDRESS[chainId]
            ? assetContract.address
            : WETH_ADDRESS[chainId];

        testVault = await BaseVault.deploy(wethAddress, mockRegistry.address);
      });

      it("initializes with correct values", async function () {
        const vaultParams = await vaultContract.vaultParams();

        assert.equal(
          vaultParams.cap.toString(),
          parseUnits("500", tokenDecimals > 18 ? tokenDecimals : 18)
        );
        assert.equal(await vaultContract.owner(), addresses.owner);
        assert.equal(await vaultContract.keeper(), addresses.keeper);
        assert.equal(
          await vaultContract.feeRecipient(),
          addresses.feeRecipient
        );
        assert.equal(
          (await vaultContract.managementFee()).toString(),
          managementFee.mul(FEE_SCALING).div(WEEKS_PER_YEAR).toString()
        );
        assert.equal(
          (await vaultContract.performanceFee()).toString(),
          performanceFee.toString()
        );

        // TODO: VERIFY assetDecimals, underlyingDecimals, minimumContractSize

        const [
          isCall,
          decimals,
          assetDecimals,
          assetAddress,
          underlyingDecimals,
          underlyingAddress,
          minimumSupply,
          minimumContractSize,
          cap,
        ] = await vaultContract.vaultParams();

        const vaultState = await vaultContract.vaultState();
        const queuedDeposits = vaultState.queuedDeposits;

        assert.equal(decimals, tokenDecimals);
        assert.equal(assetAddress, assetContract.address);
        assert.equal(underlyingAddress, underlyingAsset);
        assert.equal(
          await vaultContract.WETH(),
          depositAsset === WETH_ADDRESS[chainId]
            ? assetContract.address
            : WETH_ADDRESS[chainId]
        );
        assert.bnEqual(queuedDeposits, BigNumber.from(0));
        assert.equal(minimumSupply, params.minimumSupply);
        assert.equal(isCall, params.isCall);
        assert.bnEqual(
          cap,
          parseUnits("500", tokenDecimals > 18 ? tokenDecimals : 18)
        );
      });

      it("cannot be initialized twice", async function () {
        await expect(
          vaultContract.initialize(
            [
              addresses.owner,
              addresses.keeper,
              addresses.feeRecipient,
              managementFee,
              performanceFee,
              tokenName,
            ],
            [
              isCall,
              tokenDecimals,
              depositAssetDecimals,
              assetContract.address,
              underlyingAssetDecimals,
              underlyingAsset,
              minimumSupply,
              minimumContractSize,
              parseEther("500"),
            ]
          )
        ).to.be.revertedWith("Initializable: contract is already initialized");
      });

      it("reverts when initializing with 0 addresses.owner", async function () {
        await expect(
          testVault.initialize(
            [
              constants.AddressZero,
              addresses.keeper,
              addresses.feeRecipient,
              managementFee,
              performanceFee,
              tokenName,
            ],
            [
              isCall,
              tokenDecimals,
              depositAssetDecimals,
              assetContract.address,
              underlyingAssetDecimals,
              underlyingAsset,
              minimumSupply,
              minimumContractSize,
              parseEther("500"),
            ]
          )
        ).to.be.revertedWith("0");
      });

      it("reverts when initializing with 0 addresses.keeper", async function () {
        await expect(
          testVault.initialize(
            [
              addresses.owner,
              constants.AddressZero,
              addresses.feeRecipient,
              managementFee,
              performanceFee,
              tokenName,
            ],
            [
              isCall,
              tokenDecimals,
              depositAssetDecimals,
              assetContract.address,
              underlyingAssetDecimals,
              underlyingAsset,
              minimumSupply,
              minimumContractSize,
              parseEther("500"),
            ]
          )
        ).to.be.revertedWith("0");
      });

      it("reverts when initializing with 0 addresses.feeRecipient", async function () {
        await expect(
          testVault.initialize(
            [
              addresses.owner,
              addresses.keeper,
              constants.AddressZero,
              managementFee,
              performanceFee,
              tokenName,
            ],
            [
              isCall,
              tokenDecimals,
              depositAssetDecimals,
              assetContract.address,
              underlyingAssetDecimals,
              underlyingAsset,
              minimumSupply,
              minimumContractSize,
              parseEther("500"),
            ]
          )
        ).to.be.revertedWith("0");
      });

      it("reverts when initializing with 0 initCap", async function () {
        await expect(
          testVault.initialize(
            [
              addresses.owner,
              addresses.keeper,
              addresses.feeRecipient,
              managementFee,
              performanceFee,
              tokenName,
            ],
            [
              isCall,
              tokenDecimals,
              depositAssetDecimals,
              assetContract.address,
              underlyingAssetDecimals,
              underlyingAsset,
              minimumSupply,
              minimumContractSize,
              0,
            ]
          )
        ).to.be.revertedWith("15");
      });

      it("reverts when assetContract is 0x", async function () {
        await expect(
          testVault.initialize(
            [
              addresses.owner,
              addresses.keeper,
              addresses.feeRecipient,
              managementFee,
              performanceFee,
              tokenName,
            ],
            [
              isCall,
              tokenDecimals,
              depositAssetDecimals,
              constants.AddressZero,
              underlyingAssetDecimals,
              underlyingAsset,
              minimumSupply,
              minimumContractSize,
              parseEther("500"),
            ]
          )
        ).to.be.revertedWith("0");
      });
    });

    describe("#setCap", () => {
      time.revertToSnapshotAfterEach();

      it("should revert if not owner", async function () {
        await expect(
          vaultContract.connect(signers.user).setCap(parseEther("10"))
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });

      it("should set the new cap", async function () {
        const tx = await vaultContract
          .connect(signers.owner)
          .setCap(parseEther("10"));
        const vaultParams = await vaultContract.vaultParams();

        assert.equal(vaultParams.cap.toString(), parseEther("10"));
        await expect(tx)
          .to.emit(vaultContract, "CapSet")
          .withArgs(
            parseUnits("500", tokenDecimals > 18 ? tokenDecimals : 18),
            parseEther("10")
          );
      });

      it("should revert when depositing over the cap", async function () {
        const capAmount = BigNumber.from("100000000");
        const depositAmount = BigNumber.from("10000000000");

        await vaultContract.connect(signers.owner).setCap(capAmount);

        await expect(vaultContract.deposit(depositAmount)).to.be.revertedWith(
          "16"
        );
      });
    });

    describe("#decimals", () => {
      it("should return 18 for decimals", async function () {
        const vaultParams = await vaultContract.vaultParams();
        const decimals = vaultParams.decimals;

        assert.equal(decimals.toString(), tokenDecimals.toString());
      });
    });

    describe("#uri", () => {
      it("returns the name", async function () {
        assert.equal(await knoxTokenContract.uri(LP_TOKEN_ID), tokenName);
      });
    });

    describe("#owner", () => {
      it("returns the addresses.owner", async function () {
        assert.equal(await vaultContract.owner(), addresses.owner);
      });
    });

    describe("#managementFee", () => {
      it("returns the management fee", async function () {
        assert.equal(
          (await vaultContract.managementFee()).toString(),
          managementFee.mul(FEE_SCALING).div(WEEKS_PER_YEAR).toString()
        );
      });
    });

    describe("#performanceFee", () => {
      it("returns the performance fee", async function () {
        assert.equal(
          (await vaultContract.performanceFee()).toString(),
          performanceFee.toString()
        );
      });
    });

    describe("#setNewKeeper", () => {
      time.revertToSnapshotAfterTest();

      it("set new addresses.keeper to addresses.owner", async function () {
        assert.equal(await vaultContract.keeper(), addresses.keeper);
        await vaultContract
          .connect(signers.owner)
          .setNewKeeper(addresses.owner);
        assert.equal(await vaultContract.keeper(), addresses.owner);
      });

      it("reverts when not owner call", async function () {
        await expect(
          vaultContract.setNewKeeper(addresses.owner)
        ).to.be.revertedWith("caller is not the owner");
      });
    });

    describe("#setFeeRecipient", () => {
      time.revertToSnapshotAfterTest();

      it("reverts when setting 0x0 as addresses.feeRecipient", async function () {
        await expect(
          vaultContract
            .connect(signers.owner)
            .setFeeRecipient(constants.AddressZero)
        ).to.be.revertedWith("0");
      });

      it("reverts when not owner call", async function () {
        await expect(
          vaultContract.setFeeRecipient(addresses.owner)
        ).to.be.revertedWith("caller is not the owner");
      });

      it("changes the fee recipient", async function () {
        await vaultContract
          .connect(signers.owner)
          .setFeeRecipient(addresses.owner);
        assert.equal(await vaultContract.feeRecipient(), addresses.owner);
      });
    });

    describe("#setManagementFee", () => {
      time.revertToSnapshotAfterTest();

      it("setManagementFee to 0", async function () {
        await vaultContract.connect(signers.owner).setManagementFee(0);
        assert.bnEqual(await vaultContract.managementFee(), BigNumber.from(0));
      });

      it("reverts when not owner call", async function () {
        await expect(
          vaultContract.setManagementFee(BigNumber.from("1000000").toString())
        ).to.be.revertedWith("caller is not the owner");
      });

      it("changes the management fee", async function () {
        await vaultContract
          .connect(signers.owner)
          .setManagementFee(BigNumber.from("1000000").toString());
        assert.equal(
          (await vaultContract.managementFee()).toString(),
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
        await vaultContract.connect(signers.owner).setPerformanceFee(0);
        assert.bnEqual(await vaultContract.performanceFee(), BigNumber.from(0));
      });

      it("reverts when not owner call", async function () {
        await expect(
          vaultContract.setPerformanceFee(BigNumber.from("1000000").toString())
        ).to.be.revertedWith("caller is not the owner");
      });

      it("changes the performance fee", async function () {
        await vaultContract
          .connect(signers.owner)
          .setPerformanceFee(BigNumber.from("1000000").toString());
        assert.equal(
          (await vaultContract.performanceFee()).toString(),
          BigNumber.from("1000000").toString()
        );
      });
    });

    describe("#shares", () => {
      time.revertToSnapshotAfterEach();

      it("shows correct share balance after redemptions", async function () {
        await assetContract
          .connect(signers.user)
          .approve(vaultContract.address, depositAmount);

        await vaultContract.deposit(depositAmount);

        let vaultState = await vaultContract.vaultState();
        let expiry = vaultState.expiry;

        const vaultParams = await vaultContract.vaultParams();
        const decimals = await vaultParams.decimals;

        await time.increaseTo(expiry);
        await vaultContract.connect(signers.keeper).harvest();

        vaultState = await vaultContract.vaultState();
        expiry = vaultState.expiry;
        let round = vaultState.round;

        let userDepositReceipt = await vaultContract.depositReceipts(
          addresses.user
        );
        let ownerDepositReceipt = await vaultContract.depositReceipts(
          addresses.owner
        );

        assert.bnEqual(
          await vaultDisplayLib.lpShares(
            decimals,
            round,
            vaultContract.address,
            addresses.user,
            knoxTokenAddress,
            userDepositReceipt
          ),
          depositAmount
        );

        const redeemAmount = BigNumber.from(1);
        await vaultContract.redeem(redeemAmount);

        userDepositReceipt = await vaultContract.depositReceipts(
          addresses.user
        );
        ownerDepositReceipt = await vaultContract.depositReceipts(
          addresses.owner
        );

        // Share balance should remain the same because the 1 share
        // is transferred to the user
        assert.bnEqual(
          await vaultDisplayLib.lpShares(
            decimals,
            round,
            vaultContract.address,
            addresses.user,
            knoxTokenAddress,
            userDepositReceipt
          ),
          depositAmount
        );

        await knoxTokenContract.safeTransferFrom(
          addresses.user,
          addresses.owner,
          LP_TOKEN_ID,
          redeemAmount,
          0
        );

        userDepositReceipt = await vaultContract.depositReceipts(
          addresses.user
        );
        ownerDepositReceipt = await vaultContract.depositReceipts(
          addresses.owner
        );

        assert.bnEqual(
          await vaultDisplayLib.lpShares(
            decimals,
            round,
            vaultContract.address,
            addresses.user,
            knoxTokenAddress,
            userDepositReceipt
          ),
          depositAmount.sub(redeemAmount)
        );

        assert.bnEqual(
          await vaultDisplayLib.lpShares(
            decimals,
            round,
            vaultContract.address,
            addresses.owner,
            knoxTokenAddress,
            ownerDepositReceipt
          ),
          redeemAmount
        );
      });

      it("returns the total number of shares", async function () {
        await assetContract
          .connect(signers.user)
          .approve(vaultContract.address, depositAmount);
        await vaultContract.deposit(depositAmount);

        let vaultState = await vaultContract.vaultState();
        let expiry = vaultState.expiry;

        const vaultParams = await vaultContract.vaultParams();
        const decimals = await vaultParams.decimals;

        await time.increaseTo(expiry);
        await vaultContract.connect(signers.keeper).harvest();

        vaultState = await vaultContract.vaultState();
        expiry = vaultState.expiry;
        let round = vaultState.round;

        let userDepositReceipt = await vaultContract.depositReceipts(
          addresses.user
        );

        assert.bnEqual(
          await vaultDisplayLib.lpShares(
            decimals,
            round,
            vaultContract.address,
            addresses.user,
            knoxTokenAddress,
            userDepositReceipt
          ),
          depositAmount
        );

        // Should remain the same after redemption because it's held on balanceOf
        await vaultContract.redeem(1);

        userDepositReceipt = await vaultContract.depositReceipts(
          addresses.user
        );

        assert.bnEqual(
          await vaultDisplayLib.lpShares(
            decimals,
            round,
            vaultContract.address,
            addresses.user,
            knoxTokenAddress,
            userDepositReceipt
          ),
          depositAmount
        );
      });
    });

    describe("#shareBalances", () => {
      time.revertToSnapshotAfterEach();

      it("returns the share balances split", async function () {
        await assetContract
          .connect(signers.user)
          .approve(vaultContract.address, depositAmount);
        await vaultContract.deposit(depositAmount);

        let vaultState = await vaultContract.vaultState();
        let expiry = vaultState.expiry;

        const vaultParams = await vaultContract.vaultParams();
        const decimals = await vaultParams.decimals;

        await time.increaseTo(expiry);
        await vaultContract.connect(signers.keeper).harvest();

        vaultState = await vaultContract.vaultState();
        expiry = vaultState.expiry;
        let round = vaultState.round;

        let userDepositReceipt = await vaultContract.depositReceipts(
          addresses.user
        );

        const [heldByAccount1, heldByVault1] =
          await vaultDisplayLib.lpShareBalances(
            decimals,
            round,
            vaultContract.address,
            addresses.user,
            knoxTokenAddress,
            userDepositReceipt
          );

        assert.bnEqual(heldByAccount1, BigNumber.from(0));
        assert.bnEqual(heldByVault1, depositAmount);

        await vaultContract.redeem(1);

        userDepositReceipt = await vaultContract.depositReceipts(
          addresses.user
        );

        const [heldByAccount2, heldByVault2] =
          await vaultDisplayLib.lpShareBalances(
            decimals,
            round,
            vaultContract.address,
            addresses.user,
            knoxTokenAddress,
            userDepositReceipt
          );

        assert.bnEqual(heldByAccount2, BigNumber.from(1));
        assert.bnEqual(heldByVault2, depositAmount.sub(1));
      });
    });

    describe("#accountVaultBalance", () => {
      time.revertToSnapshotAfterEach();

      // TODO: Finish test
      // it("returns a lesser underlyingAsset amount for user", async function () {
      //   assert.isFalse(true);
      // });
    });

    describe("#withdrawInstantly", () => {
      time.revertToSnapshotAfterEach();

      it("reverts with 0 amount", async function () {
        await assetContract
          .connect(signers.user)
          .approve(vaultContract.address, depositAmount);
        await vaultContract.deposit(depositAmount);

        await expect(vaultContract.withdrawInstantly(0)).to.be.revertedWith(
          "15"
        );
      });

      it("reverts when withdrawing more than available", async function () {
        await assetContract
          .connect(signers.user)
          .approve(vaultContract.address, depositAmount);
        await vaultContract.deposit(depositAmount);

        await expect(
          vaultContract.withdrawInstantly(depositAmount.add(1))
        ).to.be.revertedWith("20");
      });

      it("reverts when deposit receipt is processed", async function () {
        await assetContract
          .connect(signers.user)
          .approve(vaultContract.address, depositAmount);
        await vaultContract.deposit(depositAmount);

        const vaultState = await vaultContract.vaultState();
        const expiry = vaultState.expiry;

        await time.increaseTo(expiry);
        await vaultContract.connect(signers.keeper).harvest();

        await vaultContract.maxRedeem();

        await expect(
          vaultContract.withdrawInstantly(depositAmount.add(1))
        ).to.be.revertedWith("7");
      });

      it("reverts when withdrawing next round", async function () {
        await assetContract
          .connect(signers.user)
          .approve(vaultContract.address, depositAmount);
        await vaultContract.deposit(depositAmount);

        const vaultState = await vaultContract.vaultState();
        const expiry = vaultState.expiry;

        await time.increaseTo(expiry);
        await vaultContract.connect(signers.keeper).harvest();

        await expect(
          vaultContract.withdrawInstantly(depositAmount.add(1))
        ).to.be.revertedWith("7");
      });

      // TODO: finish test
      // it("withdraws the amount in deposit receipt", async function () {
      //   assert.isFalse(true);

      // await assetContract
      //   .connect(signers.user)
      //   .approve(vaultContract.address, depositAmount);
      // await vaultContract.deposit(depositAmount);

      // let startBalance: BigNumber;
      // let withdrawAmount: BigNumber;
      // if (underlyingAsset === WETH_ADDRESS[chainId]) {
      //   startBalance = await provider.getBalance(addresses.user);
      // } else {
      //   startBalance = await assetContract.balanceOf(addresses.user);
      // }

      // const tx = await vaultContract.withdrawInstantly(depositAmount, { gasPrice });
      // const receipt = await tx.wait();

      // if (underlyingAsset === WETH_ADDRESS[chainId]) {
      //   const endBalance = await provider.getBalance(addresses.user);
      //   withdrawAmount = endBalance
      //     .sub(startBalance)
      //     .add(receipt.gasUsed.mul(gasPrice));
      // } else {
      //   const endBalance = await assetContract.balanceOf(addresses.user);
      //   withdrawAmount = endBalance.sub(startBalance);
      // }
      // assert.bnEqual(withdrawAmount, depositAmount);

      // await expect(tx)
      //   .to.emit(vaultContract, "InstantWithdraw")
      //   .withArgs(addresses.user, depositAmount, 1);

      // const { round, amount } = await vaultContract.depositReceipts(addresses.user);
      // assert.equal(round, 1);
      // assert.bnEqual(amount, BigNumber.from(0));

      // // Should decrement the pending amounts
      // assert.bnEqual(
      //   await vaultDisplayLib.queuedDeposits(vaultContract.address),
      //   BigNumber.from(0)
      // );
      // });
    });

    // Only apply to when assets is WETH
    if (depositAsset === WETH_ADDRESS[chainId]) {
      describe("#depositETH", () => {
        time.revertToSnapshotAfterEach();

        it("creates pending deposit successfully", async function () {
          const startBalance = await provider.getBalance(addresses.user);

          const depositAmount = parseEther("1");
          const tx = await vaultContract.depositETH({
            value: depositAmount,
            gasPrice,
          });
          const receipt = await tx.wait();
          const gasFee = receipt.gasUsed.mul(gasPrice);

          const vaultState = await vaultContract.vaultState();
          const queuedDeposits = vaultState.queuedDeposits;

          assert.bnEqual(
            await provider.getBalance(addresses.user),
            startBalance.sub(depositAmount).sub(gasFee)
          );

          // Unchanged for share balance and totalSupply
          assert.bnEqual(
            await knoxTokenContract.totalSupply(LP_TOKEN_ID),
            BigNumber.from(0)
          );
          assert.bnEqual(
            await knoxTokenContract.balanceOf(addresses.user, LP_TOKEN_ID),
            BigNumber.from(0)
          );
          await expect(tx)
            .to.emit(vaultContract, "Deposit")
            .withArgs(addresses.user, depositAmount, 1);
          await expect(tx)
            .to.emit(vaultContract, "Deposit")
            .withArgs(addresses.user, depositAmount, 1);

          assert.bnEqual(queuedDeposits, depositAmount);

          const { round, amount } = await vaultContract.depositReceipts(
            addresses.user
          );
          assert.equal(round, 1);
          assert.bnEqual(amount, depositAmount);
        });

        // it("fits gas budget [ @skip-on-coverage ]", async function () {
        //   const tx1 = await vaultContract
        //     .connect(signers.owner)
        //     .depositETH({ value: parseEther("0.1") });
        //   const receipt1 = await tx1.wait();
        //   assert.isAtMost(receipt1.gasUsed.toNumber(), 130000);

        //   const tx2 = await vaultContract.depositETH({ value: parseEther("0.1") });
        //   const receipt2 = await tx2.wait();
        //   assert.isAtMost(receipt2.gasUsed.toNumber(), 91500);

        //   // Uncomment to measure precise gas numbers
        //   // console.log("Worst case depositETH", receipt1.gasUsed.toNumber());
        //   // console.log("Best case depositETH", receipt2.gasUsed.toNumber());
        // });

        it("reverts when no value passed", async function () {
          await expect(
            vaultContract.connect(signers.user).depositETH({ value: 0 })
          ).to.be.revertedWith("15");
        });

        it("does not inflate the share tokens on initialization", async function () {
          await assetContract
            .connect(signers.admin)
            .deposit({ value: parseEther("10") });

          await assetContract
            .connect(signers.admin)
            .transfer(vaultContract.address, parseEther("10"));

          await vaultContract
            .connect(signers.user)
            .depositETH({ value: parseEther("1") });

          assert.isTrue(
            (
              await knoxTokenContract.balanceOf(addresses.user, LP_TOKEN_ID)
            ).isZero()
          );
        });

        it("reverts when minimum shares are not minted", async function () {
          await expect(
            vaultContract.connect(signers.user).depositETH({
              value: BigNumber.from("10").pow("10").sub(BigNumber.from("1")),
            })
          ).to.be.revertedWith("4");
        });
      });
    } else {
      describe("#depositETH", () => {
        it("reverts when assetContract is not WETH", async function () {
          const depositAmount = parseEther("1");
          await expect(
            vaultContract.depositETH({ value: depositAmount })
          ).to.be.revertedWith("8");
        });
      });
    }

    describe("#deposit", () => {
      time.revertToSnapshotAfterEach();

      it("creates a pending deposit", async function () {
        const startBalance = await assetContract.balanceOf(addresses.user);

        await assetContract
          .connect(signers.user)
          .approve(vaultContract.address, depositAmount);

        const res = await vaultContract.deposit(depositAmount);

        assert.bnEqual(
          await assetContract.balanceOf(addresses.user),
          startBalance.sub(depositAmount)
        );
        assert.isTrue(
          (await knoxTokenContract.totalSupply(LP_TOKEN_ID)).isZero()
        );
        assert.isTrue(
          (
            await knoxTokenContract.balanceOf(addresses.user, LP_TOKEN_ID)
          ).isZero()
        );
        await expect(res)
          .to.emit(vaultContract, "Deposit")
          .withArgs(addresses.user, depositAmount, 1);

        const vaultState = await vaultContract.vaultState();
        const queuedDeposits = vaultState.queuedDeposits;

        assert.bnEqual(queuedDeposits, depositAmount);
        const { round, amount } = await vaultContract.depositReceipts(
          addresses.user
        );
        assert.equal(round, 1);
        assert.bnEqual(amount, depositAmount);
      });

      it("tops up existing deposit", async function () {
        const startBalance = await assetContract.balanceOf(addresses.user);
        const totalDepositAmount = depositAmount.mul(BigNumber.from(2));

        await assetContract
          .connect(signers.user)
          .approve(vaultContract.address, totalDepositAmount);

        await vaultContract.deposit(depositAmount);

        const tx = await vaultContract.deposit(depositAmount);

        assert.bnEqual(
          await assetContract.balanceOf(addresses.user),
          startBalance.sub(totalDepositAmount)
        );
        assert.isTrue(
          (await knoxTokenContract.totalSupply(LP_TOKEN_ID)).isZero()
        );
        assert.isTrue(
          (
            await knoxTokenContract.balanceOf(addresses.user, LP_TOKEN_ID)
          ).isZero()
        );
        await expect(tx)
          .to.emit(vaultContract, "Deposit")
          .withArgs(addresses.user, depositAmount, 1);

        const vaultState = await vaultContract.vaultState();
        const queuedDeposits = vaultState.queuedDeposits;

        assert.bnEqual(queuedDeposits, totalDepositAmount);

        const { round, amount } = await vaultContract.depositReceipts(
          addresses.user
        );

        assert.equal(round, 1);
        assert.bnEqual(amount, totalDepositAmount);
      });

      // it("fits gas budget for deposits [ @skip-on-coverage ]", async function () {
      //   await assetContract
      //     .connect(signers.owner)
      //     .approve(vaultContract.address, depositAmount);

      //   await vaultContract.connect(signers.owner).deposit(depositAmount);

      //   await assetContract
      //     .connect(signers.user)
      //     .approve(vaultContract.address, depositAmount.mul(2));

      //   const tx1 = await vaultContract.deposit(depositAmount);

      //   const receipt1 = await tx1.wait();
      //   assert.isAtMost(
      //     receipt1.gasUsed.toNumber(),
      //     params.gasLimits.depositWorstCase
      //   );

      //   const tx2 = await vaultContract.deposit(depositAmount);
      //   const receipt2 = await tx2.wait();
      //   assert.isAtMost(
      //     receipt2.gasUsed.toNumber(),
      //     params.gasLimits.depositBestCase
      //   );

      //   // Uncomment to log gas used
      //   // console.log("Worst case deposit", receipt1.gasUsed.toNumber());
      //   // console.log("Best case deposit", receipt2.gasUsed.toNumber());
      // });

      it("does not inflate the share tokens on initialization", async function () {
        const depositAmount = BigNumber.from("100000000000");

        await assetContract
          .connect(signers.admin)
          .transfer(vaultContract.address, depositAmount);

        await assetContract
          .connect(signers.user)
          .approve(vaultContract.address, BigNumber.from("10000000000"));

        await vaultContract
          .connect(signers.user)
          .deposit(BigNumber.from("10000000000"));

        // user needs to get back exactly 1 ether
        // even though the total has been incremented
        assert.isTrue(
          (
            await knoxTokenContract.balanceOf(addresses.user, LP_TOKEN_ID)
          ).isZero()
        );
      });

      it("reverts when minimum shares are not minted", async function () {
        await expect(
          vaultContract
            .connect(signers.user)
            .deposit(BigNumber.from(minimumSupply).sub(BigNumber.from("1")))
        ).to.be.revertedWith("4");
      });

      it("updates the previous deposit receipt", async function () {
        await assetContract
          .connect(signers.user)
          .approve(vaultContract.address, params.depositAmount.mul(2));

        await vaultContract.deposit(params.depositAmount);

        const {
          round: round1,
          amount: amount1,
          unredeemedShares: unredeemedShares1,
        } = await vaultContract.depositReceipts(addresses.user);

        assert.equal(round1, 1);
        assert.bnEqual(amount1, params.depositAmount);
        assert.bnEqual(unredeemedShares1, BigNumber.from(0));

        const vaultState = await vaultContract.vaultState();
        const expiry = vaultState.expiry;

        await time.increaseTo(expiry);
        await vaultContract.connect(signers.keeper).harvest();

        const {
          round: round2,
          amount: amount2,
          unredeemedShares: unredeemedShares2,
        } = await vaultContract.depositReceipts(addresses.user);

        assert.equal(round2, 1);
        assert.bnEqual(amount2, params.depositAmount);
        assert.bnEqual(unredeemedShares2, BigNumber.from(0));

        await vaultContract.deposit(params.depositAmount);

        assert.bnEqual(
          await assetContract.balanceOf(vaultContract.address),
          params.depositAmount.mul(2)
        );

        // vaultContract will still hold the vaultContract shares
        assert.bnEqual(
          await knoxTokenContract.balanceOf(vaultContract.address, LP_TOKEN_ID),
          params.depositAmount
        );

        const {
          round: round3,
          amount: amount3,
          unredeemedShares: unredeemedShares3,
        } = await vaultContract.depositReceipts(addresses.user);

        assert.equal(round3, 2);
        assert.bnEqual(amount3, params.depositAmount);
        assert.bnEqual(unredeemedShares3, params.depositAmount);
      });
    });

    describe("#depositFor", () => {
      time.revertToSnapshotAfterEach();
      let creditor: string;

      beforeEach(async function () {
        creditor = addresses.owner.toString();
      });

      it("creates a pending deposit", async function () {
        const startBalance = await assetContract.balanceOf(addresses.user);

        await assetContract
          .connect(signers.user)
          .approve(vaultContract.address, depositAmount);

        const res = await vaultContract.depositFor(depositAmount, creditor);

        assert.bnEqual(
          await assetContract.balanceOf(addresses.user),
          startBalance.sub(depositAmount)
        );

        assert.isTrue(
          (await knoxTokenContract.totalSupply(LP_TOKEN_ID)).isZero()
        );
        assert.isTrue(
          (
            await knoxTokenContract.balanceOf(addresses.user, LP_TOKEN_ID)
          ).isZero()
        );

        await expect(res)
          .to.emit(vaultContract, "Deposit")
          .withArgs(creditor, depositAmount, 1);

        const vaultState = await vaultContract.vaultState();
        const queuedDeposits = vaultState.queuedDeposits;

        assert.bnEqual(queuedDeposits, depositAmount);

        const { round, amount } = await vaultContract.depositReceipts(creditor);

        assert.equal(round, 1);
        assert.bnEqual(amount, depositAmount);

        const { round2, amount2 } = await vaultContract.depositReceipts(
          addresses.user
        );

        await expect(round2).to.be.undefined;
        await expect(amount2).to.be.undefined;
      });

      it("tops up existing deposit", async function () {
        const startBalance = await assetContract.balanceOf(addresses.user);
        const totalDepositAmount = depositAmount.mul(BigNumber.from(2));

        await assetContract
          .connect(signers.user)
          .approve(vaultContract.address, totalDepositAmount);

        await vaultContract.depositFor(depositAmount, creditor);

        const tx = await vaultContract.depositFor(depositAmount, creditor);

        assert.bnEqual(
          await assetContract.balanceOf(addresses.user),
          startBalance.sub(totalDepositAmount)
        );
        assert.isTrue(
          (await knoxTokenContract.totalSupply(LP_TOKEN_ID)).isZero()
        );
        assert.isTrue(
          (await knoxTokenContract.balanceOf(creditor, LP_TOKEN_ID)).isZero()
        );
        await expect(tx)
          .to.emit(vaultContract, "Deposit")
          .withArgs(creditor, depositAmount, 1);

        const vaultState = await vaultContract.vaultState();
        const queuedDeposits = vaultState.queuedDeposits;

        assert.bnEqual(queuedDeposits, totalDepositAmount);
        const { round, amount } = await vaultContract.depositReceipts(creditor);
        assert.equal(round, 1);
        assert.bnEqual(amount, totalDepositAmount);
      });

      // it("fits gas budget for deposits [ @skip-on-coverage ]", async function () {
      //   await assetContract
      //     .connect(signers.owner)
      //     .approve(vaultContract.address, depositAmount.mul(2));

      //   await vaultContract.connect(signers.owner).depositFor(depositAmount, creditor);

      //   await assetContract
      //     .connect(signers.user)
      //     .approve(vaultContract.address, depositAmount.mul(2));

      //   const tx1 = await vaultContract.depositFor(depositAmount, creditor);
      //   const receipt1 = await tx1.wait();
      //   assert.isAtMost(
      //     receipt1.gasUsed.toNumber(),
      //     params.gasLimits.depositWorstCase
      //   );

      //   const tx2 = await vaultContract.depositFor(depositAmount, creditor);
      //   const receipt2 = await tx2.wait();
      //   assert.isAtMost(
      //     receipt2.gasUsed.toNumber(),
      //     params.gasLimits.depositBestCase
      //   );

      //   // Uncomment to log gas used
      //   // console.log("Worst case deposit", receipt1.gasUsed.toNumber());
      //   // console.log("Best case deposit", receipt2.gasUsed.toNumber());
      // });

      it("does not inflate the share tokens on initialization", async function () {
        const depositAmount = BigNumber.from("100000000000");

        await assetContract
          .connect(signers.admin)
          .transfer(vaultContract.address, depositAmount);

        await assetContract
          .connect(signers.user)
          .approve(vaultContract.address, BigNumber.from("10000000000"));

        await vaultContract
          .connect(signers.user)
          .depositFor(BigNumber.from("10000000000"), creditor);

        // user needs to get back exactly 1 ether
        // even though the total has been incremented
        assert.isTrue(
          (await knoxTokenContract.balanceOf(creditor, LP_TOKEN_ID)).isZero()
        );
      });

      it("reverts when minimum shares are not minted", async function () {
        await expect(
          vaultContract
            .connect(signers.user)
            .depositFor(
              BigNumber.from(minimumSupply).sub(BigNumber.from("1")),
              creditor
            )
        ).to.be.revertedWith("4");
      });

      it("updates the previous deposit receipt", async function () {
        await assetContract
          .connect(signers.user)
          .approve(vaultContract.address, params.depositAmount.mul(2));

        await vaultContract.depositFor(params.depositAmount, creditor);

        const {
          round: round1,
          amount: amount1,
          unredeemedShares: unredeemedShares1,
        } = await vaultContract.depositReceipts(creditor);

        assert.equal(round1, 1);
        assert.bnEqual(amount1, params.depositAmount);
        assert.bnEqual(unredeemedShares1, BigNumber.from(0));

        const vaultState = await vaultContract.vaultState();
        const expiry = vaultState.expiry;

        await time.increaseTo(expiry);
        await vaultContract.connect(signers.keeper).harvest();

        const {
          round: round2,
          amount: amount2,
          unredeemedShares: unredeemedShares2,
        } = await vaultContract.depositReceipts(creditor);

        assert.equal(round2, 1);
        assert.bnEqual(amount2, params.depositAmount);
        assert.bnEqual(unredeemedShares2, BigNumber.from(0));

        await vaultContract.depositFor(params.depositAmount, creditor);

        assert.bnEqual(
          await assetContract.balanceOf(vaultContract.address),
          params.depositAmount.mul(2)
        );

        // vaultContract shares will not change until next rollover
        assert.bnEqual(
          await knoxTokenContract.balanceOf(vaultContract.address, LP_TOKEN_ID),
          params.depositAmount
        );

        const {
          round: round3,
          amount: amount3,
          unredeemedShares: unredeemedShares3,
        } = await vaultContract.depositReceipts(creditor);

        assert.equal(round3, 2);
        assert.bnEqual(amount3, params.depositAmount);
        assert.bnEqual(unredeemedShares3, params.depositAmount);
      });
    });

    describe("#initiateWithdraw", () => {
      time.revertToSnapshotAfterEach(async () => {});

      it("reverts when user initiates withdraws without any deposit", async function () {
        await knoxTokenContract.setApprovalForAll(vaultContract.address, true);
        await expect(
          vaultContract.initiateWithdraw(depositAmount)
        ).to.be.revertedWith("ERC1155: insufficient balance for transfer");
      });

      it("reverts when passed 0 shares", async function () {
        await knoxTokenContract.setApprovalForAll(vaultContract.address, true);
        await expect(vaultContract.initiateWithdraw(0)).to.be.revertedWith(
          "15"
        );
      });

      it("reverts when withdrawing more than unredeemed balance", async function () {
        await assetContract
          .connect(signers.user)
          .approve(vaultContract.address, depositAmount);
        await vaultContract.deposit(depositAmount);

        const vaultState = await vaultContract.vaultState();
        const expiry = vaultState.expiry;

        await time.increaseTo(expiry);
        await vaultContract.connect(signers.keeper).harvest();

        await knoxTokenContract.setApprovalForAll(vaultContract.address, true);

        await expect(
          vaultContract.initiateWithdraw(depositAmount.add(1))
        ).to.be.revertedWith("ERC1155: insufficient balance for transfer");
      });

      it("reverts when withdrawing more than vaultContract + account balance", async function () {
        await assetContract
          .connect(signers.user)
          .approve(vaultContract.address, depositAmount);
        await vaultContract.deposit(depositAmount);

        const vaultState = await vaultContract.vaultState();
        const expiry = vaultState.expiry;

        await time.increaseTo(expiry);
        await vaultContract.connect(signers.keeper).harvest();

        // Move 1 share into account
        await vaultContract.redeem(1);

        await knoxTokenContract.setApprovalForAll(vaultContract.address, true);

        await expect(
          vaultContract.initiateWithdraw(depositAmount.add(1))
        ).to.be.revertedWith("ERC1155: insufficient balance for transfer");
      });

      it("reverts when initiating with past existing withdrawal", async function () {
        await assetContract
          .connect(signers.user)
          .approve(vaultContract.address, depositAmount);
        await vaultContract.deposit(depositAmount);

        let vaultState = await vaultContract.vaultState();
        let expiry = vaultState.expiry;

        await time.increaseTo(expiry);
        await vaultContract.connect(signers.keeper).harvest();

        await knoxTokenContract.setApprovalForAll(vaultContract.address, true);
        await vaultContract.initiateWithdraw(depositAmount.div(2));

        vaultState = await vaultContract.vaultState();
        expiry = vaultState.expiry;

        await time.increaseTo(expiry);
        await vaultContract.connect(signers.keeper).harvest();

        await expect(
          vaultContract.initiateWithdraw(depositAmount.div(2))
        ).to.be.revertedWith("6");
      });

      it("creates withdrawal from unredeemed shares", async function () {
        await assetContract
          .connect(signers.user)
          .approve(vaultContract.address, depositAmount);
        await vaultContract.deposit(depositAmount);

        const vaultState = await vaultContract.vaultState();
        const expiry = vaultState.expiry;

        await time.increaseTo(expiry);
        await vaultContract.connect(signers.keeper).harvest();

        await knoxTokenContract.setApprovalForAll(vaultContract.address, true);
        const tx = await vaultContract.initiateWithdraw(depositAmount);

        await expect(tx)
          .to.emit(vaultContract, "InitiateWithdraw")
          .withArgs(addresses.user, depositAmount, 2);

        await expect(tx)
          .to.emit(knoxTokenContract, "TransferSingle")
          .withArgs(
            vaultContract.address,
            vaultContract.address,
            addresses.user,
            LP_TOKEN_ID,
            depositAmount
          );

        const { round, shares } = await vaultContract.withdrawals(
          addresses.user
        );
        assert.equal(round, 2);
        assert.bnEqual(shares, depositAmount);
      });

      it("creates withdrawal by debiting user shares", async function () {
        await assetContract
          .connect(signers.user)
          .approve(vaultContract.address, depositAmount);
        await vaultContract.deposit(depositAmount);

        const vaultState = await vaultContract.vaultState();
        const expiry = vaultState.expiry;

        await time.increaseTo(expiry);
        await vaultContract.connect(signers.keeper).harvest();

        await vaultContract.redeem(depositAmount.div(2));

        await knoxTokenContract.setApprovalForAll(vaultContract.address, true);
        const tx = await vaultContract.initiateWithdraw(depositAmount);

        // First we redeem the leftover amount
        await expect(tx)
          .to.emit(knoxTokenContract, "TransferSingle")
          .withArgs(
            vaultContract.address,
            vaultContract.address,
            addresses.user,
            LP_TOKEN_ID,
            depositAmount.div(2)
          );

        await expect(tx)
          .to.emit(vaultContract, "InitiateWithdraw")
          .withArgs(addresses.user, depositAmount, 2);

        // Then we debit the shares from the user
        await expect(tx)
          .to.emit(knoxTokenContract, "TransferSingle")
          .withArgs(
            vaultContract.address,
            addresses.user,
            vaultContract.address,
            LP_TOKEN_ID,
            depositAmount
          );

        assert.bnEqual(
          await knoxTokenContract.balanceOf(addresses.user, LP_TOKEN_ID),
          BigNumber.from(0)
        );
        assert.bnEqual(
          await knoxTokenContract.balanceOf(vaultContract.address, LP_TOKEN_ID),
          depositAmount
        );

        const { round, shares } = await vaultContract.withdrawals(
          addresses.user
        );
        assert.equal(round, 2);
        assert.bnEqual(shares, depositAmount);
      });

      it("tops up existing withdrawal", async function () {
        await assetContract
          .connect(signers.user)
          .approve(vaultContract.address, depositAmount);
        await vaultContract.deposit(depositAmount);

        const vaultState = await vaultContract.vaultState();
        const expiry = vaultState.expiry;

        await time.increaseTo(expiry);
        await vaultContract.connect(signers.keeper).harvest();

        await knoxTokenContract.setApprovalForAll(vaultContract.address, true);
        const tx1 = await vaultContract.initiateWithdraw(depositAmount.div(2));
        // We redeem the full amount on the first initiateWithdraw
        await expect(tx1)
          .to.emit(knoxTokenContract, "TransferSingle")
          .withArgs(
            vaultContract.address,
            vaultContract.address,
            addresses.user,
            LP_TOKEN_ID,
            depositAmount
          );
        await expect(tx1)
          .to.emit(knoxTokenContract, "TransferSingle")
          .withArgs(
            vaultContract.address,
            addresses.user,
            vaultContract.address,
            LP_TOKEN_ID,
            depositAmount.div(2)
          );

        const tx2 = await vaultContract.initiateWithdraw(depositAmount.div(2));
        await expect(tx2)
          .to.emit(knoxTokenContract, "TransferSingle")
          .withArgs(
            vaultContract.address,
            addresses.user,
            vaultContract.address,
            LP_TOKEN_ID,
            depositAmount.div(2)
          );

        const { round, shares } = await vaultContract.withdrawals(
          addresses.user
        );
        assert.equal(round, 2);
        assert.bnEqual(shares, depositAmount);
      });

      it("reverts when there is insufficient balance over multiple calls", async function () {
        await assetContract
          .connect(signers.user)
          .approve(vaultContract.address, depositAmount);
        await vaultContract.deposit(depositAmount);

        const vaultState = await vaultContract.vaultState();
        const expiry = vaultState.expiry;

        await time.increaseTo(expiry);
        await vaultContract.connect(signers.keeper).harvest();

        await knoxTokenContract.setApprovalForAll(vaultContract.address, true);
        await vaultContract.initiateWithdraw(depositAmount.div(2));

        await expect(
          vaultContract.initiateWithdraw(depositAmount.div(2).add(1))
        ).to.be.revertedWith("ERC1155: insufficient balance for transfer");
      });

      //   it("fits gas budget [ @skip-on-coverage ]", async function () {
      //     await assetContract
      //       .connect(signers.user)
      //       .approve(vaultContract.address, depositAmount);
      //     await vaultContract.deposit(depositAmount);

      // const vaultParams = await vaultContract.vaultParams();
      // const expiry = vaultParams.expiry;

      // await time.increaseTo(expiry);
      //     await vaultContract.connect(signers.keeper).harvest();

      //     const tx = await vaultContract.initiateWithdraw(depositAmount);
      //     const receipt = await tx.wait();
      //     assert.isAtMost(receipt.gasUsed.toNumber(), 105000);
      //     // console.log("initiateWithdraw", receipt.gasUsed.toNumber());
      //   });
    });

    describe("#completeWithdraw", () => {
      time.revertToSnapshotAfterEach(async () => {
        await assetContract
          .connect(signers.user)
          .approve(vaultContract.address, depositAmount);

        await vaultContract.deposit(depositAmount);
        await assetContract
          .connect(signers.user)
          .transfer(addresses.owner, depositAmount);

        await assetContract
          .connect(signers.owner)
          .approve(vaultContract.address, depositAmount);

        await vaultContract.connect(signers.owner).deposit(depositAmount);

        const vaultState = await vaultContract.vaultState();
        const expiry = vaultState.expiry;

        await time.increaseTo(expiry);
        await vaultContract.connect(signers.keeper).harvest();

        await knoxTokenContract.setApprovalForAll(vaultContract.address, true);
        await vaultContract.initiateWithdraw(depositAmount);
      });

      it("reverts when not initiated", async function () {
        await expect(
          vaultContract.connect(signers.owner).completeWithdraw()
        ).to.be.revertedWith("22");
      });

      it("reverts when round not closed", async function () {
        await expect(vaultContract.completeWithdraw()).to.be.revertedWith("19");
      });

      it("reverts when calling completeWithdraw twice", async function () {
        const vaultState = await vaultContract.vaultState();
        const expiry = vaultState.expiry;

        await time.increaseTo(expiry);
        await vaultContract.connect(signers.keeper).harvest();

        await vaultContract.completeWithdraw();
        await expect(vaultContract.completeWithdraw()).to.be.revertedWith("22");
      });

      // TODO: Write Test
      // it("completes the withdrawal", async function () {
      //   assert.isTrue(false);
      //   const firstStrikePrice = firstOptionStrike;
      //   const settlePriceITM = isCall
      //     ? firstStrikePrice.sub(100000000)
      //     : firstStrikePrice.add(100000000);
      //   await rollToSecondOption(settlePriceITM);
      //   const pricePerShare = await vaultContract.roundPricePerShare(2);
      //   const withdrawAmount = depositAmount
      //     .mul(pricePerShare)
      //     .div(
      //       BigNumber.from(10).pow(
      //         await vaultDisplayLib.decimals(vaultContract.address)
      //       )
      //     );
      //   const lastQueuedWithdrawAmount = await vaultContract.lastQueuedWithdrawAmount();
      //   let beforeBalance: BigNumber;
      //   if (underlyingAsset === WETH_ADDRESS[chainId]) {
      //     beforeBalance = await provider.getBalance(addresses.user);
      //   } else {
      //     beforeBalance = await assetContract.balanceOf(addresses.user);
      //   }
      //   const { queuedWithdrawShares: startQueuedShares } =
      //     await vaultContract.vaultState();
      //   const tx = await vaultContract.completeWithdraw({ gasPrice });
      //   const receipt = await tx.wait();

      //   const gasFee = receipt.gasUsed.mul(gasPrice);
      //   await expect(tx)
      //     .to.emit(vaultContract, "Withdraw")
      //     .withArgs(addresses.user, withdrawAmount.toString(), depositAmount);
      //   if (underlyingAsset !== WETH_ADDRESS[chainId]) {
      //     const collateralERC20 = await getContractAt("IERC20", underlyingAsset);
      //     await expect(tx)
      //       .to.emit(collateralERC20, "Transfer")
      //       .withArgs(vaultContract.address, addresses.user, withdrawAmount);
      //   }
      //   const { shares, round } = await vaultContract.withdrawals(addresses.user);
      //   assert.equal(shares, 0);
      // assert.equal(round, 2);
      // const { queuedWithdrawShares: endQueuedShares } =
      //   await vaultContract.vaultState();
      // assert.bnEqual(endQueuedShares, BigNumber.from(0));
      // assert.bnEqual(
      //   await vaultContract.lastQueuedWithdrawAmount(),
      //   lastQueuedWithdrawAmount.sub(withdrawAmount)
      // );
      // assert.bnEqual(startQueuedShares.sub(endQueuedShares), depositAmount);
      // let actualWithdrawAmount: BigNumber;
      // if (underlyingAsset === WETH_ADDRESS[chainId]) {
      //   const afterBalance = await provider.getBalance(addresses.user);
      //   actualWithdrawAmount = afterBalance.sub(beforeBalance).add(gasFee);
      // } else {
      //   const afterBalance = await assetContract.balanceOf(addresses.user);
      //   actualWithdrawAmount = afterBalance.sub(beforeBalance);
      // }
      // // Should be less because the pps is down
      // assert.bnLt(actualWithdrawAmount, depositAmount);
      // assert.bnEqual(actualWithdrawAmount, withdrawAmount);
      // });

      // it("fits gas budget [ @skip-on-coverage ]", async function () {
      //   const vaultParams = await vaultContract.vaultParams();
      //   const expiry = vaultParams.expiry;

      //   await time.increaseTo(expiry);
      //   await vaultContract.connect(signers.keeper).harvest();

      //   const tx = await vaultContract.completeWithdraw({ gasPrice });
      //   const receipt = await tx.wait();

      //   assert.isAtMost(receipt.gasUsed.toNumber(), 100342);
      //   // console.log(
      //   //   params.name,
      //   //   "completeWithdraw",
      //   //   receipt.gasUsed.toNumber()
      //   // );
      // });
    });

    describe("#maxRedeem", () => {
      time.revertToSnapshotAfterEach(async function () {});

      it("is able to redeem deposit at new price per share", async function () {
        await assetContract
          .connect(signers.user)
          .approve(vaultContract.address, depositAmount);

        await vaultContract.deposit(depositAmount);

        const vaultState = await vaultContract.vaultState();
        const expiry = vaultState.expiry;

        await time.increaseTo(expiry);
        await vaultContract.connect(signers.keeper).harvest();

        const tx = await vaultContract.maxRedeem();

        assert.bnEqual(
          await assetContract.balanceOf(vaultContract.address),
          depositAmount
        );

        assert.bnEqual(
          await knoxTokenContract.balanceOf(addresses.user, LP_TOKEN_ID),
          depositAmount
        );
        assert.bnEqual(
          await knoxTokenContract.balanceOf(vaultContract.address, LP_TOKEN_ID),
          BigNumber.from(0)
        );

        await expect(tx)
          .to.emit(vaultContract, "Redeem")
          .withArgs(addresses.user, depositAmount, 1);

        const { round, amount, unredeemedShares } =
          await vaultContract.depositReceipts(addresses.user);

        assert.equal(round, 1);
        assert.bnEqual(amount, BigNumber.from(0));
        assert.bnEqual(unredeemedShares, BigNumber.from(0));
      });

      it("changes user and vaultContract balances only once when redeeming twice", async function () {
        await assetContract
          .connect(signers.user)
          .approve(vaultContract.address, depositAmount);

        await vaultContract.deposit(depositAmount);

        const vaultState = await vaultContract.vaultState();
        const expiry = vaultState.expiry;

        await time.increaseTo(expiry);
        await vaultContract.connect(signers.keeper).harvest();

        await vaultContract.maxRedeem();

        assert.bnEqual(
          await assetContract.balanceOf(vaultContract.address),
          depositAmount
        );

        assert.bnEqual(
          await knoxTokenContract.balanceOf(addresses.user, LP_TOKEN_ID),
          depositAmount
        );
        assert.bnEqual(
          await knoxTokenContract.balanceOf(vaultContract.address, LP_TOKEN_ID),
          BigNumber.from(0)
        );

        const { round, amount, unredeemedShares } =
          await vaultContract.depositReceipts(addresses.user);

        assert.equal(round, 1);
        assert.bnEqual(amount, BigNumber.from(0));
        assert.bnEqual(unredeemedShares, BigNumber.from(0));

        let res = await vaultContract.maxRedeem();

        await expect(res).to.not.emit(knoxTokenContract, "TransferSingle");

        assert.bnEqual(
          await assetContract.balanceOf(vaultContract.address),
          depositAmount
        );
        assert.bnEqual(
          await knoxTokenContract.balanceOf(addresses.user, LP_TOKEN_ID),
          depositAmount
        );
        assert.bnEqual(
          await knoxTokenContract.balanceOf(vaultContract.address, LP_TOKEN_ID),
          BigNumber.from(0)
        );
      });

      it("redeems after a deposit what was unredeemed from previous rounds", async function () {
        await assetContract
          .connect(signers.user)
          .approve(vaultContract.address, depositAmount.mul(2));
        await vaultContract.deposit(depositAmount);

        const vaultState = await vaultContract.vaultState();
        const expiry = vaultState.expiry;

        await time.increaseTo(expiry);
        await vaultContract.connect(signers.keeper).harvest();

        await vaultContract.deposit(depositAmount);

        const tx = await vaultContract.maxRedeem();

        await expect(tx)
          .to.emit(vaultContract, "Redeem")
          .withArgs(addresses.user, depositAmount, 2);
      });

      // it("is able to redeem deposit at correct pricePerShare after closing short in the money", async function () {});
    });

    describe("#redeem", () => {
      time.revertToSnapshotAfterEach();
      it("reverts when 0 passed", async function () {
        await assetContract
          .connect(signers.user)
          .approve(vaultContract.address, depositAmount);
        await vaultContract.deposit(depositAmount);

        const vaultState = await vaultContract.vaultState();
        const expiry = vaultState.expiry;

        await time.increaseTo(expiry);
        await vaultContract.connect(signers.keeper).harvest();

        await expect(vaultContract.redeem(0)).to.be.revertedWith("13");
      });

      it("reverts when redeeming more than available", async function () {
        await assetContract
          .connect(signers.user)
          .approve(vaultContract.address, depositAmount);

        await vaultContract.deposit(depositAmount);

        const vaultState = await vaultContract.vaultState();
        const expiry = vaultState.expiry;

        await time.increaseTo(expiry);
        await vaultContract.connect(signers.keeper).harvest();

        await expect(
          vaultContract.redeem(depositAmount.add(1))
        ).to.be.revertedWith("12");
      });

      it("decreases unredeemed shares", async function () {
        await assetContract
          .connect(signers.user)
          .approve(vaultContract.address, depositAmount);

        await vaultContract.deposit(depositAmount);

        const vaultState = await vaultContract.vaultState();
        const expiry = vaultState.expiry;

        await time.increaseTo(expiry);
        await vaultContract.connect(signers.keeper).harvest();

        const redeemAmount = BigNumber.from(1);
        const tx1 = await vaultContract.redeem(redeemAmount);

        await expect(tx1)
          .to.emit(vaultContract, "Redeem")
          .withArgs(addresses.user, redeemAmount, 1);

        const {
          round: round1,
          amount: amount1,
          unredeemedShares: unredeemedShares1,
        } = await vaultContract.depositReceipts(addresses.user);

        assert.equal(round1, 1);
        assert.bnEqual(amount1, BigNumber.from(0));
        assert.bnEqual(unredeemedShares1, depositAmount.sub(redeemAmount));

        const tx2 = await vaultContract.redeem(depositAmount.sub(redeemAmount));
        await expect(tx2)
          .to.emit(vaultContract, "Redeem")
          .withArgs(addresses.user, depositAmount.sub(redeemAmount), 1);

        const {
          round: round2,
          amount: amount2,
          unredeemedShares: unredeemedShares2,
        } = await vaultContract.depositReceipts(addresses.user);

        assert.equal(round2, 1);
        assert.bnEqual(amount2, BigNumber.from(0));
        assert.bnEqual(unredeemedShares2, BigNumber.from(0));
      });
    });

    // describe("#purchase", () => {
    //   let isCall: boolean;

    //   time.revertToSnapshotAfterEach(async () => {
    //     const vaultParams = await vaultContract.vaultParams();
    //     isCall = vaultParams.isCall;

    //     const depositAmount = parseUnits("50", depositAssetDecimals);

    //     await assetContract
    //       .connect(signers.user)
    //       .approve(vaultContract.address, depositAmount);

    //     await vaultContract.deposit(depositAmount);

    //             const vaultParams = await vaultContract.vaultParams();
    // const expiry = vaultParams.expiry;

    // await time.increaseTo(expiry);
    //     await vaultContract.connect(signers.keeper).harvest();
    //   });

    //   it("reverts if position is too small", async function () {
    //     await mockRegistry.connect(signers.admin).setIsTrue(false);

    //     await expect(
    //       vaultContract.purchase(BYTES_ZERO, 0, 0, 0, 0, 0, 0, isCall)
    //     ).to.be.revertedWith("vaultContract/size-below-minimum");
    //   });

    //   it("reverts if available capital is exceeded", async function () {
    //     let size: BigNumber;

    //     if (isCall) {
    //       size = parseUnits("51", depositAssetDecimals);

    //       await expect(
    //         vaultContract.purchase(BYTES_ZERO, 0, 0, 0, 0, 0, size, isCall)
    //       ).to.be.revertedWith("vaultContract/exceeds-available-capital");
    //     } else {
    //       size = parseUnits("1", depositAssetDecimals);
    //       let strike = fixedFromFloat(2500);

    //       await expect(
    //         vaultContract.purchase(BYTES_ZERO, 0, 0, strike, 0, 0, size, isCall)
    //       ).to.be.revertedWith("vaultContract/exceeds-available-capital");
    //     }
    //   });

    //   it("reverts if signature is invalid", async function () {
    //     let size = parseUnits("1", depositAssetDecimals);
    //     let strike = fixedFromFloat(50);

    //     await mockRegistry.connect(signers.admin).setIsTrue(false);
    //     await expect(
    //       vaultContract.purchase(BYTES_ZERO, 0, 0, strike, 0, 0, size, isCall)
    //     ).to.be.revertedWith("vaultContract/invalid-signature");
    //   });

    //   it("vaultContract balance decreases by the correct amount", async function () {
    //     let totalBalanceBefore = await vaultContract.totalBalance();
    //     let vaultBalanceBefore = await assetContract.balanceOf(vaultContract.address);

    //     let size: BigNumber;
    //     if (isCall) {
    //       size = parseUnits("50", depositAssetDecimals);
    //     } else {
    //       size = parseUnits("1", depositAssetDecimals);
    //     }

    //     let strike = fixedFromFloat(50);
    //     await vaultContract.purchase(BYTES_ZERO, 0, 0, strike, 0, 0, size, isCall);

    //     let totalBalanceAfter = await vaultContract.totalBalance();
    //     let vaultBalanceAfter = await assetContract.balanceOf(vaultContract.address);

    //     // totalBalance() should not change since premium is 0.
    //     expect(totalBalanceBefore.toString()).to.be.equal(
    //       totalBalanceAfter.toString()
    //     );

    //     // TODO: totalBalance is incorrect because the lockedAmount is not accounting for Payoff amount.

    //     expect(vaultBalanceBefore.toString()).to.be.equal(
    //       vaultBalanceAfter
    //         .add(parseUnits("50", depositAssetDecimals))
    //         .toString()
    //     );
    //   });

    //   it("buyers balance decreases by the correct amount", async function () {
    //     let buyerBalanceBefore = await assetContract.balanceOf(addresses.user);
    //     let totalBalanceBefore = await vaultContract.totalBalance();

    //     await assetContract
    //       .connect(signers.user)
    //       .approve(vaultContract.address, buyerBalanceBefore);

    //     let size = parseUnits("50", depositAssetDecimals);
    //     let strike = fixedFromFloat(1);
    //     let premium = fixedFromFloat(1);

    //     await vaultContract.purchase(
    //       BYTES_ZERO,
    //       0,
    //       0,
    //       strike,
    //       0,
    //       premium,
    //       size,
    //       isCall
    //     );

    //     let buyerBalanceAfter = await assetContract.balanceOf(addresses.user);
    //     let totalBalanceAfter = await vaultContract.totalBalance();

    //     expect(totalBalanceBefore.toString()).to.be.equal(
    //       totalBalanceAfter
    //         .sub(parseUnits("50", depositAssetDecimals))
    //         .toString()
    //     );

    //     expect(buyerBalanceBefore.toString()).to.be.equal(
    //       buyerBalanceAfter
    //         .add(parseUnits("50", depositAssetDecimals))
    //         .toString()
    //     );
    //   });
    // });
  });
}
