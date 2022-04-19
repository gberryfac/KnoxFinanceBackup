import { ethers, network } from "hardhat";
import { BigNumber, Contract } from "ethers";

const { getContractFactory, getContractAt, provider } = ethers;
const { parseUnits, parseEther } = ethers.utils;

import { expect } from "chai";
import moment from "moment-timezone";
import { fixedFromFloat } from "@premia/utils";

import * as time from "./helpers/time";
import * as fixtures from "./helpers/fixtures";
import * as types from "./helpers/types";

import { assert } from "./helpers/assertions";

import {
  ADDRESS_ZERO,
  BYTES_ZERO,
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

const gasPrice = parseUnits("100", "gwei");
const chainId = network.config.chainId;

moment.tz.setDefault("UTC");

let block;
describe("Vault", () => {
  behavesLikeRibbonOptionsVault({
    whale: WHALE_ADDRESS[chainId],
    name: `Knox ETH Theta Vault (Call)`,
    tokenName: "Knox ETH Theta Vault",
    tokenSymbol: "kETH-THETA-C",
    tokenDecimals: 18,
    depositAsset: WETH_ADDRESS[chainId],
    depositAssetDecimals: WETH_DECIMALS,
    baseAssetDecimals: DAI_DECIMALS,
    underlyingAssetDecimals: WETH_DECIMALS,
    underlyingAsset: WETH_ADDRESS[chainId],
    depositAmount: parseEther("10"),
    cap: parseUnits("1000", WETH_DECIMALS),
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
    name: `Knox ETH Theta Vault (Put)`,
    tokenName: "Knox ETH Theta Vault",
    tokenSymbol: "kETH-THETA-P",
    tokenDecimals: 18,
    depositAsset: DAI_ADDRESS[chainId],
    depositAssetDecimals: DAI_DECIMALS,
    baseAssetDecimals: DAI_DECIMALS,
    underlyingAssetDecimals: WETH_DECIMALS,
    underlyingAsset: WETH_ADDRESS[chainId],
    depositAmount: parseEther("10"),
    cap: parseUnits("5000000", DAI_DECIMALS),
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
  cap: BigNumber;
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
  let cap = params.cap;
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
  let commonLogicLibrary: Contract;
  let vaultDisplayLibrary: Contract;
  let vaultLifecycleLibrary: Contract;
  let vaultLogicLibrary: Contract;
  let vaultContract: Contract;
  let mockRegistry: Contract;
  let assetContract: Contract;
  let mockPremiaPool: Contract;
  let knoxTokenContract: Contract;
  let strategyContract: Contract;

  describe.only(`${params.name}`, () => {
    let initSnapshotId: string;

    before(async () => {
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

      const CommonLogic = await getContractFactory("CommonLogic");
      commonLogicLibrary = await CommonLogic.deploy();

      const VaultDisplay = await getContractFactory("VaultDisplay");
      vaultDisplayLibrary = await VaultDisplay.deploy();

      const VaultLifecycle = await getContractFactory("VaultLifecycle");
      vaultLifecycleLibrary = await VaultLifecycle.deploy();

      const VaultLogic = await getContractFactory("VaultLogic");
      vaultLogicLibrary = await VaultLogic.deploy();

      const Registry = await getContractFactory("MockRegistry", signers.admin);
      mockRegistry = await Registry.deploy(true);

      assetContract = await getContractAt("IAsset", depositAsset);

      [signers, addresses, assetContract] = await fixtures.impersonateWhale(
        whale,
        depositAsset,
        depositAssetDecimals,
        signers,
        addresses
      );

      [vaultContract, knoxTokenContract] = await fixtures.getVaultFixture(
        commonLogicLibrary,
        vaultDisplayLibrary,
        vaultLifecycleLibrary,
        vaultLogicLibrary,
        mockRegistry,
        tokenName,
        tokenDecimals,
        depositAsset,
        depositAssetDecimals,
        underlyingAssetDecimals,
        underlyingAsset,
        cap,
        minimumSupply,
        minimumContractSize,
        managementFee,
        performanceFee,
        isCall,
        signers,
        addresses
      );

      // TODO: REMOVE MOCKSTRATEGY FROM TESTS, CAll FUNCTIONS DIRECTLY

      const strategyContractFactory = await getContractFactory("MockStrategy");

      strategyContract = await strategyContractFactory.deploy(
        knoxTokenContract.address,
        addresses.keeper,
        mockPremiaPool.address,
        WETH_ADDRESS[chainId]
      );

      await strategyContract.setVault(vaultContract.address);

      await vaultContract
        .connect(signers.owner)
        .setTokenAddress(knoxTokenContract.address);

      knoxTokenAddress = knoxTokenContract.address;
    });

    after(async () => {
      await time.revertToSnapShot(initSnapshotId);
    });

    let testVault: Contract;
    describe("#initialize", () => {
      time.revertToSnapshotAfterEach(async () => {
        const Vault = await getContractFactory("Vault", {
          libraries: {
            CommonLogic: commonLogicLibrary.address,
            VaultDisplay: vaultDisplayLibrary.address,
            VaultLifecycle: vaultLifecycleLibrary.address,
            VaultLogic: vaultLogicLibrary.address,
          },
        });

        const wethAddress =
          depositAsset === WETH_ADDRESS[chainId]
            ? assetContract.address
            : WETH_ADDRESS[chainId];

        testVault = await Vault.deploy(wethAddress, mockRegistry.address);
      });

      it("initializes with correct values", async () => {
        const vaultParams = await vaultContract.vaultParams();

        assert.equal(vaultParams.cap.toString(), params.cap);
        assert.equal(await vaultContract.owner(), addresses.owner);
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
          await vaultContract.weth(),
          depositAsset === WETH_ADDRESS[chainId]
            ? assetContract.address
            : WETH_ADDRESS[chainId]
        );
        assert.bnEqual(queuedDeposits, BigNumber.from(0));
        assert.equal(minimumSupply, params.minimumSupply);
        assert.equal(isCall, params.isCall);
        assert.bnEqual(cap, params.cap);
      });

      it("cannot be initialized twice", async () => {
        await expect(
          vaultContract.initialize(
            [
              addresses.owner,
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

      it("should revert when initializing with 0 addresses.owner", async () => {
        await expect(
          testVault.initialize(
            [
              ADDRESS_ZERO,
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

      it("should revert when initializing with 0 addresses.feeRecipient", async () => {
        await expect(
          testVault.initialize(
            [
              addresses.owner,
              ADDRESS_ZERO,
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

      it("should revert when initializing with 0 initCap", async () => {
        await expect(
          testVault.initialize(
            [
              addresses.owner,
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

      it("should revert when assetContract is 0x", async () => {
        await expect(
          testVault.initialize(
            [
              addresses.owner,
              addresses.feeRecipient,
              managementFee,
              performanceFee,
              tokenName,
            ],
            [
              isCall,
              tokenDecimals,
              depositAssetDecimals,
              ADDRESS_ZERO,
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
      time.revertToSnapshotAfterEach(async () => {});

      it("should revert if not owner", async () => {
        await expect(
          vaultContract.connect(signers.user).setCap(parseEther("10"))
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });

      it("should set the new cap", async () => {
        const tx = await vaultContract
          .connect(signers.owner)
          .setCap(parseEther("10"));
        const vaultParams = await vaultContract.vaultParams();

        assert.equal(vaultParams.cap.toString(), parseEther("10"));
        await expect(tx)
          .to.emit(vaultContract, "CapSet")
          .withArgs(cap, parseEther("10"));
      });

      it("should revert when depositing over the cap", async () => {
        const capAmount = BigNumber.from("100000000");
        const depositAmount = BigNumber.from("10000000000");

        await vaultContract.connect(signers.owner).setCap(capAmount);

        await expect(vaultContract.deposit(depositAmount)).to.be.revertedWith(
          "16"
        );
      });
    });

    describe("#decimals", () => {
      it("should return 18 for decimals", async () => {
        const vaultParams = await vaultContract.vaultParams();
        const decimals = vaultParams.decimals;

        assert.equal(decimals.toString(), tokenDecimals.toString());
      });
    });

    describe("#uri", () => {
      it("returns the name", async () => {
        assert.equal(await knoxTokenContract.uri(LP_TOKEN_ID), tokenName);
      });
    });

    describe("#owner", () => {
      it("returns the addresses.owner", async () => {
        assert.equal(await vaultContract.owner(), addresses.owner);
      });
    });

    describe("#managementFee", () => {
      it("returns the management fee", async () => {
        assert.equal(
          (await vaultContract.managementFee()).toString(),
          managementFee.mul(FEE_SCALING).div(WEEKS_PER_YEAR).toString()
        );
      });
    });

    describe("#performanceFee", () => {
      it("returns the performance fee", async () => {
        assert.equal(
          (await vaultContract.performanceFee()).toString(),
          performanceFee.toString()
        );
      });
    });

    describe("#setFeeRecipient", () => {
      time.revertToSnapshotAfterTest();

      it("should revert when setting 0x0 as addresses.feeRecipient", async () => {
        await expect(
          vaultContract.connect(signers.owner).setFeeRecipient(ADDRESS_ZERO)
        ).to.be.revertedWith("0");
      });

      it("should revert when not owner call", async () => {
        await expect(
          vaultContract.setFeeRecipient(addresses.owner)
        ).to.be.revertedWith("caller is not the owner");
      });

      it("changes the fee recipient", async () => {
        await vaultContract
          .connect(signers.owner)
          .setFeeRecipient(addresses.owner);
        assert.equal(await vaultContract.feeRecipient(), addresses.owner);
      });
    });

    describe("#setManagementFee", () => {
      time.revertToSnapshotAfterTest();

      it("setManagementFee to 0", async () => {
        await vaultContract.connect(signers.owner).setManagementFee(0);
        assert.bnEqual(await vaultContract.managementFee(), BigNumber.from(0));
      });

      it("should revert when not owner call", async () => {
        await expect(
          vaultContract.setManagementFee(BigNumber.from("1000000").toString())
        ).to.be.revertedWith("caller is not the owner");
      });

      it("changes the management fee", async () => {
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

      it("setPerformanceFee to 0", async () => {
        await vaultContract.connect(signers.owner).setPerformanceFee(0);
        assert.bnEqual(await vaultContract.performanceFee(), BigNumber.from(0));
      });

      it("should revert when not owner call", async () => {
        await expect(
          vaultContract.setPerformanceFee(BigNumber.from("1000000").toString())
        ).to.be.revertedWith("caller is not the owner");
      });

      it("changes the performance fee", async () => {
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
      time.revertToSnapshotAfterEach(async () => {});

      it("shows correct share balance after redemptions", async () => {
        await assetContract
          .connect(signers.user)
          .approve(vaultContract.address, depositAmount);

        await vaultContract.deposit(depositAmount);

        let vaultState = await vaultContract.vaultState();
        let expiry = vaultState.expiry;

        const vaultParams = await vaultContract.vaultParams();
        const decimals = await vaultParams.decimals;

        await time.increaseTo(expiry);
        await strategyContract.connect(signers.keeper).harvest();

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
          await vaultContract.lpShares(addresses.user),
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
          await vaultContract.lpShares(addresses.user),
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
          await vaultContract.lpShares(addresses.user),
          depositAmount.sub(redeemAmount)
        );

        assert.bnEqual(
          await vaultContract.lpShares(addresses.owner),
          redeemAmount
        );
      });

      it("returns the total number of shares", async () => {
        await assetContract
          .connect(signers.user)
          .approve(vaultContract.address, depositAmount);
        await vaultContract.deposit(depositAmount);

        let vaultState = await vaultContract.vaultState();
        let expiry = vaultState.expiry;

        const vaultParams = await vaultContract.vaultParams();
        const decimals = await vaultParams.decimals;

        await time.increaseTo(expiry);
        await strategyContract.connect(signers.keeper).harvest();

        vaultState = await vaultContract.vaultState();
        expiry = vaultState.expiry;
        let round = vaultState.round;

        let userDepositReceipt = await vaultContract.depositReceipts(
          addresses.user
        );

        assert.bnEqual(
          await vaultContract.lpShares(addresses.user),
          depositAmount
        );

        // Should remain the same after redemption because it's held on balanceOf
        await vaultContract.redeem(1);

        userDepositReceipt = await vaultContract.depositReceipts(
          addresses.user
        );

        assert.bnEqual(
          await vaultContract.lpShares(addresses.user),
          depositAmount
        );
      });
    });

    describe("#shareBalances", () => {
      time.revertToSnapshotAfterEach(async () => {});

      it("returns the share balances split", async () => {
        await assetContract
          .connect(signers.user)
          .approve(vaultContract.address, depositAmount);
        await vaultContract.deposit(depositAmount);

        let vaultState = await vaultContract.vaultState();
        let expiry = vaultState.expiry;

        const vaultParams = await vaultContract.vaultParams();
        const decimals = await vaultParams.decimals;

        await time.increaseTo(expiry);
        await strategyContract.connect(signers.keeper).harvest();

        vaultState = await vaultContract.vaultState();
        expiry = vaultState.expiry;
        let round = vaultState.round;

        let userDepositReceipt = await vaultContract.depositReceipts(
          addresses.user
        );

        const [heldByAccount1, heldByVault1] =
          await vaultContract.lpShareBalances(addresses.user);

        assert.bnEqual(heldByAccount1, BigNumber.from(0));
        assert.bnEqual(heldByVault1, depositAmount);

        await vaultContract.redeem(1);

        userDepositReceipt = await vaultContract.depositReceipts(
          addresses.user
        );

        const [heldByAccount2, heldByVault2] =
          await vaultContract.lpShareBalances(addresses.user);

        assert.bnEqual(heldByAccount2, BigNumber.from(1));
        assert.bnEqual(heldByVault2, depositAmount.sub(1));
      });
    });

    describe("#accountVaultBalance", () => {
      time.revertToSnapshotAfterEach(async () => {});

      it("returns a lesser underlyingAsset amount for user", async () => {
        assert.isFalse(true);
      });
    });

    describe("#withdrawInstantly", () => {
      time.revertToSnapshotAfterEach(async () => {});

      it("should revert with 0 amount", async () => {
        await assetContract
          .connect(signers.user)
          .approve(vaultContract.address, depositAmount);
        await vaultContract.deposit(depositAmount);

        await expect(vaultContract.withdrawInstantly(0)).to.be.revertedWith(
          "15"
        );
      });

      it("should revert when withdrawing more than available", async () => {
        await assetContract
          .connect(signers.user)
          .approve(vaultContract.address, depositAmount);
        await vaultContract.deposit(depositAmount);

        await expect(
          vaultContract.withdrawInstantly(depositAmount.add(1))
        ).to.be.revertedWith("20");
      });

      it("should revert when deposit receipt is processed", async () => {
        await assetContract
          .connect(signers.user)
          .approve(vaultContract.address, depositAmount);
        await vaultContract.deposit(depositAmount);

        const vaultState = await vaultContract.vaultState();
        const expiry = vaultState.expiry;

        await time.increaseTo(expiry);
        await strategyContract.connect(signers.keeper).harvest();

        await vaultContract.maxRedeem();

        await expect(
          vaultContract.withdrawInstantly(depositAmount.add(1))
        ).to.be.revertedWith("7");
      });

      it("should revert when withdrawing next round", async () => {
        await assetContract
          .connect(signers.user)
          .approve(vaultContract.address, depositAmount);
        await vaultContract.deposit(depositAmount);

        const vaultState = await vaultContract.vaultState();
        const expiry = vaultState.expiry;

        await time.increaseTo(expiry);
        await strategyContract.connect(signers.keeper).harvest();

        await expect(
          vaultContract.withdrawInstantly(depositAmount.add(1))
        ).to.be.revertedWith("7");
      });

      it("withdraws the amount in deposit receipt", async () => {
        await assetContract
          .connect(signers.user)
          .approve(vaultContract.address, depositAmount);

        await vaultContract.deposit(depositAmount);

        let startBalance: BigNumber;
        let withdrawAmount: BigNumber;

        if (depositAsset === WETH_ADDRESS[chainId]) {
          startBalance = await provider.getBalance(addresses.user);
        } else {
          startBalance = await assetContract.balanceOf(addresses.user);
        }

        const tx = await vaultContract.withdrawInstantly(depositAmount, {
          gasPrice,
        });
        const receipt = await tx.wait();

        if (depositAsset === WETH_ADDRESS[chainId]) {
          const endBalance = await provider.getBalance(addresses.user);
          withdrawAmount = endBalance
            .sub(startBalance)
            .add(receipt.gasUsed.mul(gasPrice));
        } else {
          const endBalance = await assetContract.balanceOf(addresses.user);
          withdrawAmount = endBalance.sub(startBalance);
        }

        assert.bnEqual(withdrawAmount, depositAmount);

        await expect(tx)
          .to.emit(vaultContract, "InstantWithdraw")
          .withArgs(addresses.user, depositAmount, 1);

        const { round, amount } = await vaultContract.depositReceipts(
          addresses.user
        );

        assert.equal(round, 1);
        assert.bnEqual(amount, BigNumber.from(0));

        // Should decrement the pending amounts
        assert.bnEqual(
          await (
            await vaultContract.vaultState()
          ).queuedDeposits,
          BigNumber.from(0)
        );
      });
    });

    // Only apply to when assets is WETH
    if (depositAsset === WETH_ADDRESS[chainId]) {
      describe("#depositETH", () => {
        time.revertToSnapshotAfterEach(async () => {});

        it("creates pending deposit successfully", async () => {
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

        // it("fits gas budget [ @skip-on-coverage ]",async () => {
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

        it("should revert when no value passed", async () => {
          await expect(
            vaultContract.connect(signers.user).depositETH({ value: 0 })
          ).to.be.revertedWith("15");
        });

        it("does not inflate the share tokens on initialization", async () => {
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

        it("should revert when minimum shares are not minted", async () => {
          await expect(
            vaultContract.connect(signers.user).depositETH({
              value: BigNumber.from("10").pow("10").sub(BigNumber.from("1")),
            })
          ).to.be.revertedWith("4");
        });
      });
    } else {
      describe("#depositETH", () => {
        it("should revert when assetContract is not WETH", async () => {
          const depositAmount = parseEther("1");
          await expect(
            vaultContract.depositETH({ value: depositAmount })
          ).to.be.revertedWith("8");
        });
      });
    }

    describe("#deposit", () => {
      time.revertToSnapshotAfterEach(async () => {});

      it("creates a pending deposit", async () => {
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

      it("tops up existing deposit", async () => {
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

      // it("fits gas budget for deposits [ @skip-on-coverage ]",async () => {
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

      it("does not inflate the share tokens on initialization", async () => {
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

      it("should revert when minimum shares are not minted", async () => {
        await expect(
          vaultContract
            .connect(signers.user)
            .deposit(BigNumber.from(minimumSupply).sub(BigNumber.from("1")))
        ).to.be.revertedWith("4");
      });

      it("should update the previous deposit receipt when multiple deposits are made", async () => {
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
        await strategyContract.connect(signers.keeper).harvest();

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
      time.revertToSnapshotAfterEach(async () => {});
      let creditor: string;

      beforeEach(async () => {
        creditor = addresses.owner.toString();
      });

      it("creates a pending deposit", async () => {
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

      it("tops up existing deposit", async () => {
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

      // it("fits gas budget for deposits [ @skip-on-coverage ]",async () => {
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

      it("does not inflate the share tokens on initialization", async () => {
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

      it("should revert when minimum shares are not minted", async () => {
        await expect(
          vaultContract
            .connect(signers.user)
            .depositFor(
              BigNumber.from(minimumSupply).sub(BigNumber.from("1")),
              creditor
            )
        ).to.be.revertedWith("4");
      });

      it("updates the previous deposit receipt", async () => {
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
        await strategyContract.connect(signers.keeper).harvest();

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

      it("should revert when user initiates withdraws without any deposit", async () => {
        await knoxTokenContract.setApprovalForAll(vaultContract.address, true);
        await expect(
          vaultContract.initiateWithdraw(depositAmount)
        ).to.be.revertedWith("ERC1155: insufficient balance for transfer");
      });

      it("should revert when passed 0 shares", async () => {
        await knoxTokenContract.setApprovalForAll(vaultContract.address, true);
        await expect(vaultContract.initiateWithdraw(0)).to.be.revertedWith(
          "15"
        );
      });

      it("should revert when withdrawing more than unredeemed balance", async () => {
        await assetContract
          .connect(signers.user)
          .approve(vaultContract.address, depositAmount);
        await vaultContract.deposit(depositAmount);

        const vaultState = await vaultContract.vaultState();
        const expiry = vaultState.expiry;

        await time.increaseTo(expiry);
        await strategyContract.connect(signers.keeper).harvest();

        await knoxTokenContract.setApprovalForAll(vaultContract.address, true);

        await expect(
          vaultContract.initiateWithdraw(depositAmount.add(1))
        ).to.be.revertedWith("ERC1155: insufficient balance for transfer");
      });

      it("should revert when withdrawing more than vaultContract + account balance", async () => {
        await assetContract
          .connect(signers.user)
          .approve(vaultContract.address, depositAmount);
        await vaultContract.deposit(depositAmount);

        const vaultState = await vaultContract.vaultState();
        const expiry = vaultState.expiry;

        await time.increaseTo(expiry);
        await strategyContract.connect(signers.keeper).harvest();

        // Move 1 share into account
        await vaultContract.redeem(1);

        await knoxTokenContract.setApprovalForAll(vaultContract.address, true);

        await expect(
          vaultContract.initiateWithdraw(depositAmount.add(1))
        ).to.be.revertedWith("ERC1155: insufficient balance for transfer");
      });

      it("should revert when initiating with past existing withdrawal", async () => {
        await assetContract
          .connect(signers.user)
          .approve(vaultContract.address, depositAmount);
        await vaultContract.deposit(depositAmount);

        let vaultState = await vaultContract.vaultState();
        let expiry = vaultState.expiry;

        await time.increaseTo(expiry);
        await strategyContract.connect(signers.keeper).harvest();

        await knoxTokenContract.setApprovalForAll(vaultContract.address, true);
        await vaultContract.initiateWithdraw(depositAmount.div(2));

        vaultState = await vaultContract.vaultState();
        expiry = vaultState.expiry;

        await time.increaseTo(expiry);
        await strategyContract.connect(signers.keeper).harvest();

        await expect(
          vaultContract.initiateWithdraw(depositAmount.div(2))
        ).to.be.revertedWith("6");
      });

      it("should create withdrawal with unredeemed shares when a deposit has already been made", async () => {
        await assetContract
          .connect(signers.user)
          .approve(vaultContract.address, depositAmount);
        await vaultContract.deposit(depositAmount);

        const vaultState = await vaultContract.vaultState();
        const expiry = vaultState.expiry;

        await time.increaseTo(expiry);
        await strategyContract.connect(signers.keeper).harvest();

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

      it("should create withdrawal by debiting user shares when a deposit has already been made", async () => {
        await assetContract
          .connect(signers.user)
          .approve(vaultContract.address, depositAmount);
        await vaultContract.deposit(depositAmount);

        const vaultState = await vaultContract.vaultState();
        const expiry = vaultState.expiry;

        await time.increaseTo(expiry);
        await strategyContract.connect(signers.keeper).harvest();

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

      it("tops up existing withdrawal", async () => {
        await assetContract
          .connect(signers.user)
          .approve(vaultContract.address, depositAmount);
        await vaultContract.deposit(depositAmount);

        const vaultState = await vaultContract.vaultState();
        const expiry = vaultState.expiry;

        await time.increaseTo(expiry);
        await strategyContract.connect(signers.keeper).harvest();

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

      it("should revert when there is insufficient balance over multiple calls", async () => {
        await assetContract
          .connect(signers.user)
          .approve(vaultContract.address, depositAmount);
        await vaultContract.deposit(depositAmount);

        const vaultState = await vaultContract.vaultState();
        const expiry = vaultState.expiry;

        await time.increaseTo(expiry);
        await strategyContract.connect(signers.keeper).harvest();

        await knoxTokenContract.setApprovalForAll(vaultContract.address, true);
        await vaultContract.initiateWithdraw(depositAmount.div(2));

        await expect(
          vaultContract.initiateWithdraw(depositAmount.div(2).add(1))
        ).to.be.revertedWith("ERC1155: insufficient balance for transfer");
      });

      //   it("fits gas budget [ @skip-on-coverage ]",async () => {
      //     await assetContract
      //       .connect(signers.user)
      //       .approve(vaultContract.address, depositAmount);
      //     await vaultContract.deposit(depositAmount);

      // const vaultParams = await vaultContract.vaultParams();
      // const expiry = vaultParams.expiry;

      // await time.increaseTo(expiry);
      //     await strategyContract.connect(signers.keeper).harvest();

      //     const tx = await vaultContract.initiateWithdraw(depositAmount);
      //     const receipt = await tx.wait();
      //     assert.isAtMost(receipt.gasUsed.toNumber(), 105000);
      //     // console.log("initiateWithdraw", receipt.gasUsed.toNumber());
      //   });
    });

    describe("#completeWithdraw", () => {
      let userDepositSize = parseUnits("5", depositAssetDecimals);
      let userDepositAmount = isCall
        ? userDepositSize
        : userDepositSize.mul(3000);

      let ownerDepositSize = parseUnits("7", depositAssetDecimals);
      let ownerDepositAmount = isCall
        ? ownerDepositSize
        : ownerDepositSize.mul(3000);

      time.revertToSnapshotAfterEach(async () => {
        await assetContract
          .connect(signers.user)
          .approve(vaultContract.address, userDepositAmount);

        await vaultContract.deposit(userDepositAmount);

        await assetContract
          .connect(signers.user)
          .transfer(addresses.owner, ownerDepositAmount);

        await assetContract
          .connect(signers.owner)
          .approve(vaultContract.address, ownerDepositAmount);

        await vaultContract.connect(signers.owner).deposit(ownerDepositAmount);

        const vaultState = await vaultContract.vaultState();
        const expiry = vaultState.expiry;

        await time.increaseTo(expiry);
        await strategyContract.connect(signers.keeper).harvest();

        await knoxTokenContract.setApprovalForAll(vaultContract.address, true);
        await vaultContract.initiateWithdraw(userDepositAmount);
      });

      it("should revert when not initiated", async () => {
        await expect(
          vaultContract.connect(signers.owner).completeWithdraw()
        ).to.be.revertedWith("22");
      });

      it("should revert when round not closed", async () => {
        await expect(vaultContract.completeWithdraw()).to.be.revertedWith("19");
      });

      it("should revert when called twice", async () => {
        const vaultState = await vaultContract.vaultState();
        const expiry = vaultState.expiry;

        await time.increaseTo(expiry);
        await strategyContract.connect(signers.keeper).harvest();

        await vaultContract.completeWithdraw();
        await expect(vaultContract.completeWithdraw()).to.be.revertedWith("22");
      });

      it("should return deposit amount when total capital has remained neutral", async () => {
        await time.increaseTo(await (await vaultContract.vaultState()).expiry);
        await strategyContract.connect(signers.keeper).harvest();

        const pricePerShare = await vaultContract.lpTokenPricePerShare(2);

        const withdrawAmount = userDepositAmount
          .mul(pricePerShare)
          .div(
            BigNumber.from(10).pow(
              await (
                await vaultContract.vaultParams()
              ).decimals
            )
          );

        let beforeBalance: BigNumber;

        if (depositAsset === WETH_ADDRESS[chainId]) {
          beforeBalance = await provider.getBalance(addresses.user);
        } else {
          beforeBalance = await assetContract.balanceOf(addresses.user);
        }

        const { queuedWithdrawShares: startQueuedShares } =
          await vaultContract.vaultState();

        const tx = await vaultContract.completeWithdraw({ gasPrice });
        const receipt = await tx.wait();

        const gasFee = receipt.gasUsed.mul(gasPrice);

        await expect(tx)
          .to.emit(vaultContract, "Withdraw")
          .withArgs(
            addresses.user,
            userDepositAmount.toString(),
            userDepositAmount
          );

        const { shares, round } = await vaultContract.withdrawals(
          addresses.user
        );

        assert.equal(shares, 0);
        assert.equal(round, 2);

        const { queuedWithdrawShares: endQueuedShares } =
          await vaultContract.vaultState();

        assert.bnEqual(endQueuedShares, BigNumber.from(0));
        assert.bnEqual(
          startQueuedShares.sub(endQueuedShares),
          userDepositAmount
        );

        let actualWithdrawAmount: BigNumber;

        if (depositAsset === WETH_ADDRESS[chainId]) {
          const afterBalance = await provider.getBalance(addresses.user);
          actualWithdrawAmount = afterBalance.sub(beforeBalance).add(gasFee);
        } else {
          const afterBalance = await assetContract.balanceOf(addresses.user);
          actualWithdrawAmount = afterBalance.sub(beforeBalance);
        }

        assert.bnEqual(actualWithdrawAmount, withdrawAmount);
      });

      it("should return less than deposit amount when vault total capital decreases", async () => {
        let strike = 2500;
        let strike64x64 = fixedFromFloat(strike);
        let bnSpot = BigNumber.from(isCall ? 3000 : 2000);
        let bnStrike = BigNumber.from(strike);

        let user2PurchaseSize = parseUnits("10", depositAssetDecimals);

        let user2PurchaseAmount = isCall
          ? user2PurchaseSize
          : user2PurchaseSize.mul(strike);

        // this is the amount of funds sent back to the vault as "free liquidity"
        let longHolderBalance = isCall
          ? bnSpot.sub(bnStrike).mul(user2PurchaseSize).div(bnSpot)
          : bnStrike.sub(bnSpot).mul(user2PurchaseSize);

        let premium = user2PurchaseAmount.div(10);

        await assetContract
          .connect(signers.user2)
          .approve(strategyContract.address, premium);

        let vaultState = await vaultContract.vaultState();
        let expiry = vaultState.expiry;

        await strategyContract
          .connect(signers.user2)
          .purchase(
            BYTES_ZERO,
            0,
            expiry,
            strike64x64,
            premium,
            user2PurchaseSize,
            isCall
          );

        await strategyContract.transferFundsFromVault(
          ADDRESS_ZERO,
          longHolderBalance
        );

        await time.increaseTo(await (await vaultContract.vaultState()).expiry);
        await strategyContract.connect(signers.keeper).harvest();

        const pricePerShare = await vaultContract.lpTokenPricePerShare(2);

        const withdrawAmount = userDepositAmount
          .mul(pricePerShare)
          .div(
            BigNumber.from(10).pow(
              await (
                await vaultContract.vaultParams()
              ).decimals
            )
          );

        let beforeBalance: BigNumber;

        if (depositAsset === WETH_ADDRESS[chainId]) {
          beforeBalance = await provider.getBalance(addresses.user);
        } else {
          beforeBalance = await assetContract.balanceOf(addresses.user);
        }

        const { queuedWithdrawShares: startQueuedShares } =
          await vaultContract.vaultState();

        const tx = await vaultContract.completeWithdraw({ gasPrice });
        const receipt = await tx.wait();

        const gasFee = receipt.gasUsed.mul(gasPrice);

        await expect(tx)
          .to.emit(vaultContract, "Withdraw")
          .withArgs(
            addresses.user,
            withdrawAmount.toString(),
            userDepositAmount
          );

        const { shares, round } = await vaultContract.withdrawals(
          addresses.user
        );

        assert.equal(shares, 0);
        assert.equal(round, 2);

        const { queuedWithdrawShares: endQueuedShares } =
          await vaultContract.vaultState();

        assert.bnEqual(endQueuedShares, BigNumber.from(0));
        assert.bnEqual(
          startQueuedShares.sub(endQueuedShares),
          userDepositAmount
        );

        let actualWithdrawAmount: BigNumber;

        if (depositAsset === WETH_ADDRESS[chainId]) {
          const afterBalance = await provider.getBalance(addresses.user);
          actualWithdrawAmount = afterBalance.sub(beforeBalance).add(gasFee);
        } else {
          const afterBalance = await assetContract.balanceOf(addresses.user);
          actualWithdrawAmount = afterBalance.sub(beforeBalance);
        }

        // amount withdrawn by user is less than deposit
        assert.bnLt(actualWithdrawAmount, userDepositAmount);
        assert.bnEqual(actualWithdrawAmount, withdrawAmount);
      });

      it("should return more than deposit amount when total capital increases", async () => {
        let strike = 2500;
        let strike64x64 = fixedFromFloat(strike);

        let user2PurchaseSize = parseUnits("10", depositAssetDecimals);

        let user2PurchaseAmount = isCall
          ? user2PurchaseSize
          : user2PurchaseSize.mul(strike);

        let vaultState = await vaultContract.vaultState();
        let expiry = vaultState.expiry;

        let premium = user2PurchaseAmount.div(10);

        await assetContract
          .connect(signers.user2)
          .approve(strategyContract.address, premium);

        await strategyContract
          .connect(signers.user2)
          .purchase(
            BYTES_ZERO,
            0,
            expiry,
            strike64x64,
            premium,
            user2PurchaseSize,
            isCall
          );

        await assetContract
          .connect(signers.whale)
          .transfer(vaultContract.address, user2PurchaseAmount);

        await time.increaseTo(await (await vaultContract.vaultState()).expiry);
        await strategyContract.connect(signers.keeper).harvest();

        const pricePerShare = await vaultContract.lpTokenPricePerShare(2);

        const withdrawAmount = userDepositAmount
          .mul(pricePerShare)
          .div(
            BigNumber.from(10).pow(
              await (
                await vaultContract.vaultParams()
              ).decimals
            )
          );

        let beforeBalance: BigNumber;

        if (depositAsset === WETH_ADDRESS[chainId]) {
          beforeBalance = await provider.getBalance(addresses.user);
        } else {
          beforeBalance = await assetContract.balanceOf(addresses.user);
        }

        const { queuedWithdrawShares: startQueuedShares } =
          await vaultContract.vaultState();

        const tx = await vaultContract.completeWithdraw({ gasPrice });
        const receipt = await tx.wait();

        const gasFee = receipt.gasUsed.mul(gasPrice);

        await expect(tx)
          .to.emit(vaultContract, "Withdraw")
          .withArgs(
            addresses.user,
            withdrawAmount.toString(),
            userDepositAmount
          );

        const { shares, round } = await vaultContract.withdrawals(
          addresses.user
        );

        assert.equal(shares, 0);
        assert.equal(round, 2);

        const { queuedWithdrawShares: endQueuedShares } =
          await vaultContract.vaultState();

        assert.bnEqual(endQueuedShares, BigNumber.from(0));
        assert.bnEqual(
          startQueuedShares.sub(endQueuedShares),
          userDepositAmount
        );

        let actualWithdrawAmount: BigNumber;

        if (depositAsset === WETH_ADDRESS[chainId]) {
          const afterBalance = await provider.getBalance(addresses.user);
          actualWithdrawAmount = afterBalance.sub(beforeBalance).add(gasFee);
        } else {
          const afterBalance = await assetContract.balanceOf(addresses.user);
          actualWithdrawAmount = afterBalance.sub(beforeBalance);
        }

        // amount withdrawn by user is greater than deposit
        assert.bnGt(actualWithdrawAmount, userDepositAmount);
        assert.bnEqual(actualWithdrawAmount, withdrawAmount);
      });

      // it("fits gas budget [ @skip-on-coverage ]",async () => {
      //   const vaultParams = await vaultContract.vaultParams();
      //   const expiry = vaultParams.expiry;

      //   await time.increaseTo(expiry);
      //   await strategyContract.connect(signers.keeper).harvest();

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
      time.revertToSnapshotAfterEach(async () => {});

      it("should remove all unredeemed shares from vault and transfer to user when called", async () => {
        await assetContract
          .connect(signers.user)
          .approve(vaultContract.address, depositAmount);

        await vaultContract.deposit(depositAmount);

        const vaultState = await vaultContract.vaultState();
        const expiry = vaultState.expiry;

        await time.increaseTo(expiry);
        await strategyContract.connect(signers.keeper).harvest();

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

      it("should change user and vault balances only once when called twice", async () => {
        await assetContract
          .connect(signers.user)
          .approve(vaultContract.address, depositAmount);

        await vaultContract.deposit(depositAmount);

        const vaultState = await vaultContract.vaultState();
        const expiry = vaultState.expiry;

        await time.increaseTo(expiry);
        await strategyContract.connect(signers.keeper).harvest();

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

      it("should redeem amount from previous amount when a deposit is made in the current round", async () => {
        await assetContract
          .connect(signers.user)
          .approve(vaultContract.address, depositAmount.mul(2));

        await vaultContract.deposit(depositAmount);

        const vaultState = await vaultContract.vaultState();
        const expiry = vaultState.expiry;

        await time.increaseTo(expiry);
        await strategyContract.connect(signers.keeper).harvest();

        await vaultContract.deposit(depositAmount);

        const tx = await vaultContract.maxRedeem();

        await expect(tx)
          .to.emit(vaultContract, "Redeem")
          .withArgs(addresses.user, depositAmount, 2);
      });
    });

    describe("#redeem", () => {
      time.revertToSnapshotAfterEach(async () => {
        await assetContract
          .connect(signers.user)
          .approve(vaultContract.address, depositAmount);
        await vaultContract.deposit(depositAmount);

        const vaultState = await vaultContract.vaultState();
        const expiry = vaultState.expiry;

        await time.increaseTo(expiry);
        await strategyContract.connect(signers.keeper).harvest();
      });

      it("should revert when 0 passed", async () => {
        await expect(vaultContract.redeem(0)).to.be.revertedWith("13");
      });

      it("should revert when redeeming more than available", async () => {
        await expect(
          vaultContract.redeem(depositAmount.add(1))
        ).to.be.revertedWith("12");
      });

      it("should decrease unredeemed shares when called", async () => {
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

      it("should decrease LP tokens held by vault when shares are redeemed", async () => {
        const userLPTokenBalanceBefore = await knoxTokenContract.balanceOf(
          addresses.user,
          LP_TOKEN_ID
        );
        const vaultLPTokenBalanceBefore = await knoxTokenContract.balanceOf(
          vaultContract.address,
          LP_TOKEN_ID
        );

        const redeemAmount = BigNumber.from(100);
        await vaultContract.redeem(redeemAmount);

        const userLPTokenBalanceAfter = await knoxTokenContract.balanceOf(
          addresses.user,
          LP_TOKEN_ID
        );

        const vaultLPTokenBalanceAfter = await knoxTokenContract.balanceOf(
          vaultContract.address,
          LP_TOKEN_ID
        );

        assert.bnEqual(
          userLPTokenBalanceBefore,
          userLPTokenBalanceAfter.sub(redeemAmount)
        );

        assert.bnEqual(
          vaultLPTokenBalanceBefore,
          vaultLPTokenBalanceAfter.add(redeemAmount)
        );
      });
    });

    describe("#rollover", () => {
      time.revertToSnapshotAfterEach(async () => {
        await assetContract
          .connect(signers.user)
          .approve(vaultContract.address, depositAmount);
        await vaultContract.deposit(depositAmount);
      });

      it("should send fee to recipient when vault total capital increases", async () => {
        const { expiry: expiry1 } = await vaultContract.vaultState();

        await time.increaseTo(expiry1);
        let tx = await strategyContract.connect(signers.keeper).harvest();

        await expect(tx)
          .to.emit(vaultContract, "CollectVaultFees")
          .withArgs(
            BigNumber.from(0),
            BigNumber.from(0),
            1,
            addresses.feeRecipient
          );

        let vaultIncome = parseEther("1");

        await assetContract
          .connect(signers.whale)
          .transfer(vaultContract.address, vaultIncome);

        const vaultBalance = await assetContract.balanceOf(
          vaultContract.address
        );

        const { expiry: expiry2 } = await vaultContract.vaultState();

        await time.increaseTo(expiry2);
        tx = await strategyContract.connect(signers.keeper).harvest();

        const performanceFee = vaultIncome
          .mul(params.performanceFee)
          .div(BigNumber.from(100000000));

        const managementFeePercent = params.managementFee
          .mul(BigNumber.from(1000000))
          .div(52142857);

        const managementFee = vaultBalance
          .mul(managementFeePercent)
          .div(BigNumber.from(100000000));

        await expect(tx)
          .to.emit(vaultContract, "CollectVaultFees")
          .withArgs(
            performanceFee,
            performanceFee.add(managementFee),
            2,
            addresses.feeRecipient
          );
      });

      it("should not send fee to recipient when vault total capital stays the same", async () => {
        const { expiry: expiry1 } = await vaultContract.vaultState();

        await time.increaseTo(expiry1);
        let tx = await strategyContract.connect(signers.keeper).harvest();

        await expect(tx)
          .to.emit(vaultContract, "CollectVaultFees")
          .withArgs(
            BigNumber.from(0),
            BigNumber.from(0),
            1,
            addresses.feeRecipient
          );

        const { expiry: expiry2 } = await vaultContract.vaultState();

        await time.increaseTo(expiry2);
        tx = await strategyContract.connect(signers.keeper).harvest();

        await expect(tx)
          .to.emit(vaultContract, "CollectVaultFees")
          .withArgs(
            BigNumber.from(0),
            BigNumber.from(0),
            2,
            addresses.feeRecipient
          );
      });

      it("should not send fee to recipient when vault total capital decreases", async () => {
        const { expiry: expiry1 } = await vaultContract.vaultState();

        await time.increaseTo(expiry1);
        let tx = await strategyContract.connect(signers.keeper).harvest();

        await expect(tx)
          .to.emit(vaultContract, "CollectVaultFees")
          .withArgs(
            BigNumber.from(0),
            BigNumber.from(0),
            1,
            addresses.feeRecipient
          );

        await strategyContract.transferFundsFromVault(
          ADDRESS_ZERO,
          BigNumber.from(100)
        );

        const { expiry: expiry2 } = await vaultContract.vaultState();

        await time.increaseTo(expiry2);
        tx = await strategyContract.connect(signers.keeper).harvest();

        await expect(tx)
          .to.emit(vaultContract, "CollectVaultFees")
          .withArgs(
            BigNumber.from(0),
            BigNumber.from(0),
            2,
            addresses.feeRecipient
          );
      });
    });
  });
}
