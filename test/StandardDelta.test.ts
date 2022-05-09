import { ethers, network } from "hardhat";
import { BigNumber, Contract } from "ethers";

const { getContractFactory, provider } = ethers;
const { parseUnits } = ethers.utils;

import { expect } from "chai";
import moment from "moment-timezone";

import * as time from "./helpers/time";
import * as fixtures from "./helpers/fixtures";
import * as types from "./helpers/types";

import { assert } from "./helpers/assertions";

import {
  ADDRESS_ZERO,
  ADDRESS_ONE,
  TEST_URI,
  WHALE_ADDRESS,
  BLOCK_NUMBER,
  WETH_ADDRESS,
  WETH_DECIMALS,
  DAI_ADDRESS,
  DAI_DECIMALS,
} from "../constants";

const chainId = network.config.chainId;

moment.tz.setDefault("UTC");

let block;
describe("Standard Delta Strategy Unit Tests", () => {
  behavesLikeOptionsVault({
    whale: WHALE_ADDRESS[chainId],
    name: `Knox ETH Delta Vault (Call)`,
    tokenName: `Knox ETH Delta Vault`,
    tokenSymbol: `kETH-DELTA-C`,
    tokenDecimals: 18,
    asset: WETH_ADDRESS[chainId],
    depositAssetDecimals: WETH_DECIMALS,
    baseDecimals: DAI_DECIMALS,
    underlyingDecimals: WETH_DECIMALS,
    depositAmount: parseUnits("1", WETH_DECIMALS),
    cap: parseUnits("1000", WETH_DECIMALS),
    minimumSupply: BigNumber.from("10").pow("10").toString(),
    minimumContractSize: BigNumber.from("10").pow("17").toString(),
    managementFee: BigNumber.from("2000000"),
    performanceFee: BigNumber.from("20000000"),
    isCall: true,
  });

  behavesLikeOptionsVault({
    whale: WHALE_ADDRESS[chainId],
    name: `Knox ETH Delta Vault (Put)`,
    tokenName: `Knox ETH Delta Vault`,
    tokenSymbol: `kETH-DELTA-P`,
    tokenDecimals: 18,
    asset: DAI_ADDRESS[chainId],
    depositAssetDecimals: DAI_DECIMALS,
    baseDecimals: DAI_DECIMALS,
    underlyingDecimals: WETH_DECIMALS,
    depositAmount: parseUnits("1000", DAI_DECIMALS),
    cap: parseUnits("5000000", DAI_DECIMALS),
    minimumSupply: BigNumber.from("10").pow("3").toString(),
    minimumContractSize: BigNumber.from("10").pow("17").toString(),
    managementFee: BigNumber.from("2000000"),
    performanceFee: BigNumber.from("20000000"),
    isCall: false,
  });
});

function behavesLikeOptionsVault(params: {
  whale: string;
  name: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimals: number;
  asset: string;
  depositAssetDecimals: number;
  baseDecimals: number;
  underlyingDecimals: number;
  depositAmount: BigNumber;
  cap: BigNumber;
  minimumSupply: string;
  minimumContractSize: string;
  managementFee: BigNumber;
  performanceFee: BigNumber;
  isCall: boolean;
}) {
  let signers: types.Signers;
  let addresses: types.Addresses;

  let whale = params.whale;

  // Parameters
  let asset = params.asset;
  let depositAssetDecimals = params.depositAssetDecimals;
  let baseDecimals = params.baseDecimals;
  let underlyingDecimals = params.underlyingDecimals;
  let depositAmount = params.depositAmount;
  let minimumContractSize = params.minimumContractSize;
  let isCall = params.isCall;

  // Contracts
  let commonLogicLibrary: Contract;
  let vaultDisplayLibrary: Contract;
  let vaultLifecycleLibrary: Contract;
  let premiaPool: Contract;
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

      [signers, addresses] = await fixtures.impersonateWhale(
        whale,
        asset,
        depositAssetDecimals,
        signers,
        addresses
      );

      premiaPool = await getContractFactory("MockPremiaPool").then((contract) =>
        contract.deploy()
      );

      addresses["pool"] = premiaPool.address;

      commonLogicLibrary = await getContractFactory("Common").then((contract) =>
        contract.deploy()
      );

      vaultDisplayLibrary = await getContractFactory("VaultDisplay").then(
        (contract) => contract.deploy()
      );

      vaultLifecycleLibrary = await getContractFactory("VaultLifecycle").then(
        (contract) => contract.deploy()
      );

      addresses["commonLogic"] = commonLogicLibrary.address;
      addresses["vaultDisplay"] = vaultDisplayLibrary.address;
      addresses["vaultLifecycle"] = vaultLifecycleLibrary.address;

      strategyContract = await getContractFactory("StandardDelta", {
        signer: signers.owner,
        libraries: {
          Common: addresses.commonLogic,
        },
      }).then((contract) =>
        contract.deploy(
          isCall,
          baseDecimals,
          underlyingDecimals,
          minimumContractSize,
          asset,
          addresses.pool
        )
      );

      addresses["strategy"] = strategyContract.address;
      addresses["vault"] = ADDRESS_ONE;

      await strategyContract.initialize(addresses.keeper, addresses.vault);
      strategyContract = await strategyContract.connect(signers.user);
    });

    after(async () => {
      await time.revertToSnapShot(initSnapshotId);
    });

    let testStrategy: Contract;
    describe("#initialize", () => {
      time.revertToSnapshotAfterEach(async () => {
        testStrategy = await getContractFactory("StandardDelta", {
          signer: signers.owner,
          libraries: {
            Common: addresses.commonLogic,
          },
        }).then((contract) =>
          contract.deploy(
            isCall,
            baseDecimals,
            underlyingDecimals,
            minimumContractSize,
            asset,
            addresses.pool
          )
        );
      });

      it("should initialize with correct values", async () => {
        // Check Addresses
        assert.equal(await strategyContract.Asset(), params.asset);
        assert.equal(await strategyContract.keeper(), addresses.keeper);
        assert.equal(await strategyContract.Pool(), addresses.pool);
        assert.equal(await strategyContract.Vault(), addresses.vault);

        // Check Option
        const { isCall, minimumContractSize, expiry, strike64x64 } =
          await strategyContract.option();

        assert.equal(isCall, params.isCall);
        assert.equal(minimumContractSize, params.minimumContractSize);
        assert.bnNotEqual(expiry, BigNumber.from("0"));
        assert.bnNotEqual(strike64x64, BigNumber.from("0"));

        // Check Asset Properties
        const { baseDecimals, underlyingDecimals } =
          await strategyContract.assetProperties();

        assert.equal(baseDecimals, params.baseDecimals);
        assert.equal(underlyingDecimals, params.underlyingDecimals);

        // Check Strategy Properties
        assert.equal(await strategyContract.startOffset(), 7200);
        assert.equal(await strategyContract.endOffset(), 14400);

        const saleWindowStart = await strategyContract.saleWindow(0);
        const saleWindowEnd = await strategyContract.saleWindow(1);

        assert.equal(saleWindowEnd.sub(saleWindowStart), 7200);
      });

      it("should revert if already initialized", async () => {
        await expect(
          strategyContract.initialize(addresses.keeper, addresses.vault)
        ).to.be.revertedWith("initialized");
      });

      it("should revert when not owner", async () => {
        await expect(
          testStrategy
            .connect(signers.user)
            .initialize(addresses.keeper, addresses.vault)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });

      it("should revert if keeper address is zero", async () => {
        await expect(
          testStrategy.initialize(ADDRESS_ZERO, addresses.vault)
        ).to.be.revertedWith("0");
      });

      it("should revert if vault address is zero", async () => {
        await expect(
          testStrategy.initialize(addresses.keeper, ADDRESS_ZERO)
        ).to.be.revertedWith("0");
      });
    });

    describe("#setNewKeeper", () => {
      time.revertToSnapshotAfterEach(async () => {});

      it("should revert when not owner", async () => {
        await expect(
          strategyContract.setNewKeeper(addresses.owner)
        ).to.be.revertedWith("caller is not the owner");
      });

      it("should set new keeper to owner when owner calls setNewKeeper", async () => {
        assert.equal(await strategyContract.keeper(), addresses.keeper);

        await strategyContract
          .connect(signers.owner)
          .setNewKeeper(addresses.owner);

        assert.equal(await strategyContract.keeper(), addresses.owner);
      });
    });

    describe("#purchase", () => {
      time.revertToSnapshotAfterEach(async () => {});

      it("should revert if sale has't started", async () => {
        await expect(
          strategyContract.purchase(depositAmount)
        ).to.be.revertedWith("Sale has not started!");
      });

      it("should revert if sale has eneded", async () => {
        const afterSale = await (await time.now()).add(14401);
        await time.increaseTo(afterSale);

        await expect(
          strategyContract.purchase(depositAmount)
        ).to.be.revertedWith("Sale has ended!");
      });
    });

    describe("#setNextSale", () => {
      time.revertToSnapshotAfterEach(async () => {});

      it("should revert if option hasn't expired", async () => {
        await expect(
          strategyContract.connect(signers.keeper).setNextSale()
        ).to.be.revertedWith("Option has not expired!");
      });

      it("should revert when not keeper", async () => {
        const { expiry } = await strategyContract.option();
        await time.increaseTo(expiry);

        await expect(strategyContract.setNextSale()).to.be.revertedWith("1");
      });
    });

    describe("#withdrawAndRepay", () => {
      time.revertToSnapshotAfterEach(async () => {});

      it("should revert if option hasn't expired", async () => {
        await expect(
          strategyContract.connect(signers.keeper).withdrawAndRepay()
        ).to.be.revertedWith("Option has not expired!");
      });

      it("should revert when not keeper", async () => {
        const { expiry } = await strategyContract.option();
        await time.increaseTo(expiry);

        await expect(strategyContract.withdrawAndRepay()).to.be.revertedWith(
          "1"
        );
      });

      it("should emit Repaid event when called", async () => {
        const { expiry } = await strategyContract.option();
        await time.increaseTo(expiry);

        const tx = await strategyContract
          .connect(signers.keeper)
          .withdrawAndRepay();

        await expect(tx)
          .to.emit(strategyContract, "Repaid")
          .withArgs(addresses.vault, 0);
      });
    });

    describe("#setSaleWindow", () => {
      time.revertToSnapshotAfterEach(async () => {});

      it("should revert if option hasn't expired", async () => {
        await expect(
          strategyContract.connect(signers.keeper).setSaleWindow(0, 7200)
        ).to.be.revertedWith("Option has not expired!");
      });

      it("should revert when not keeper", async () => {
        const { expiry } = await strategyContract.option();
        await time.increaseTo(expiry);

        await expect(
          strategyContract.setSaleWindow(0, 7200)
        ).to.be.revertedWith("1");
      });

      it("should emit SaleWindowSet event when called", async () => {
        const { expiry } = await strategyContract.option();
        await time.increaseTo(expiry);

        const startOffset = 0;
        const endOffset = 7200;

        const tx = await strategyContract
          .connect(signers.keeper)
          .setSaleWindow(startOffset, endOffset);

        const receipt = await tx.wait();
        const { blockTimestamp } = receipt.events[0].args;

        await expect(tx)
          .to.emit(strategyContract, "SaleWindowSet")
          .withArgs(
            blockTimestamp,
            blockTimestamp.add(startOffset),
            blockTimestamp.add(endOffset)
          );
      });
    });
  });
}
