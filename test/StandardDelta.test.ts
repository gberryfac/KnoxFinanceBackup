import { ethers, network } from "hardhat";
import { BigNumber, Contract } from "ethers";

const { getContractFactory, provider } = ethers;
const { parseUnits } = ethers.utils;

import { fixedFromFloat } from "@premia/utils";

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
  DAI_WHALE_ADDRESS,
  WBTC_WHALE_ADDRESS,
  LINK_WHALE_ADDRESS,
  BLOCK_NUMBER,
  WETH_ADDRESS,
  WETH_DECIMALS,
  WBTC_ADDRESS,
  WBTC_DECIMALS,
  LINK_ADDRESS,
  LINK_DECIMALS,
  DAI_ADDRESS,
  DAI_DECIMALS,
  ETH_PRICE_ORACLE,
  BTC_PRICE_ORACLE,
  LINK_PRICE_ORACLE,
  DAI_PRICE_ORACLE,
  PREMIA_VOLATILITY_SURFACE_ORACLE,
  SECONDS_PER_WEEK,
} from "../constants";

const chainId = network.config.chainId;

moment.tz.setDefault("UTC");

let block;
describe("Standard Delta Strategy Unit Tests", () => {
  behavesLikeOptionsVault({
    whale: DAI_WHALE_ADDRESS[chainId],
    name: `Knox ETH Delta Vault (Put)`,
    tokenName: `Knox ETH Delta Vault`,
    tokenSymbol: `kETH-DELTA-P`,
    tokenDecimals: 18,
    spotOracle: DAI_PRICE_ORACLE[chainId],
    asset: DAI_ADDRESS[chainId],
    depositAssetDecimals: DAI_DECIMALS,
    base: DAI_ADDRESS[chainId],
    underlying: WETH_ADDRESS[chainId],
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

  behavesLikeOptionsVault({
    whale: DAI_WHALE_ADDRESS[chainId],
    name: `Knox ETH Delta Vault (Call)`,
    tokenName: `Knox ETH Delta Vault`,
    tokenSymbol: `kETH-DELTA-C`,
    tokenDecimals: 18,
    spotOracle: ETH_PRICE_ORACLE[chainId],
    asset: WETH_ADDRESS[chainId],
    depositAssetDecimals: WETH_DECIMALS,
    base: DAI_ADDRESS[chainId],
    underlying: WETH_ADDRESS[chainId],
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
    whale: WBTC_WHALE_ADDRESS[chainId],
    name: `Knox BTC Delta Vault (Call)`,
    tokenName: `Knox BTC Delta Vault`,
    tokenSymbol: `kBTC-DELTA-C`,
    tokenDecimals: 18,
    spotOracle: BTC_PRICE_ORACLE[chainId],
    asset: WBTC_ADDRESS[chainId],
    depositAssetDecimals: WBTC_DECIMALS,
    base: DAI_ADDRESS[chainId],
    underlying: WBTC_ADDRESS[chainId],
    baseDecimals: DAI_DECIMALS,
    underlyingDecimals: WBTC_DECIMALS,
    depositAmount: parseUnits("0.1", WBTC_DECIMALS),
    cap: parseUnits("100", WBTC_DECIMALS),
    minimumSupply: BigNumber.from("10").pow("3").toString(),
    minimumContractSize: BigNumber.from("10").pow("7").toString(),
    managementFee: BigNumber.from("2000000"),
    performanceFee: BigNumber.from("20000000"),
    isCall: true,
  });

  behavesLikeOptionsVault({
    whale: LINK_WHALE_ADDRESS[chainId],
    name: `Knox LINK Delta Vault (Call)`,
    tokenName: `Knox LINK Delta Vault`,
    tokenSymbol: `kLINK-DELTA-C`,
    tokenDecimals: 18,
    spotOracle: LINK_PRICE_ORACLE[chainId],
    asset: LINK_ADDRESS[chainId],
    depositAssetDecimals: LINK_DECIMALS,
    base: DAI_ADDRESS[chainId],
    underlying: LINK_ADDRESS[chainId],
    baseDecimals: DAI_DECIMALS,
    underlyingDecimals: LINK_DECIMALS,
    depositAmount: parseUnits("100", LINK_DECIMALS),
    cap: parseUnits("100000", LINK_DECIMALS),
    minimumSupply: BigNumber.from("10").pow("10").toString(),
    minimumContractSize: BigNumber.from("10").pow("17").toString(),
    managementFee: BigNumber.from("1000000"),
    performanceFee: BigNumber.from("30000000"),
    isCall: true,
  });
});

function behavesLikeOptionsVault(params: {
  whale: string;
  name: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimals: number;
  spotOracle: string;
  asset: string;
  depositAssetDecimals: number;
  base: string;
  underlying: string;
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

  // Contracts
  let commonLogicLibrary: Contract;
  let vaultDisplayLibrary: Contract;
  let vaultLifecycleLibrary: Contract;
  let premiaPool: Contract;
  let vaultContract: Contract;
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
        params.whale,
        params.asset,
        params.depositAmount,
        signers,
        addresses
      );

      addresses.volatilityOracle = PREMIA_VOLATILITY_SURFACE_ORACLE[chainId];

      premiaPool = await getContractFactory("MockPremiaPool").then((contract) =>
        contract.deploy(
          params.underlying,
          params.base,
          ADDRESS_ONE,
          ADDRESS_ONE
        )
      );

      addresses.pool = premiaPool.address;

      commonLogicLibrary = await getContractFactory("Common").then((contract) =>
        contract.deploy()
      );

      vaultDisplayLibrary = await getContractFactory("VaultDisplay").then(
        (contract) => contract.deploy()
      );

      vaultLifecycleLibrary = await getContractFactory("VaultLifecycle").then(
        (contract) => contract.deploy()
      );

      vaultContract = await getContractFactory("MockVault").then((contract) =>
        contract.deploy(params.asset)
      );

      addresses.commonLogic = commonLogicLibrary.address;
      addresses.vaultDisplay = vaultDisplayLibrary.address;
      addresses.vaultLifecycle = vaultLifecycleLibrary.address;
      addresses.vault = vaultContract.address;

      strategyContract = await getContractFactory("StandardDelta", {
        signer: signers.owner,
        libraries: {
          Common: addresses.commonLogic,
        },
      }).then((contract) => contract.deploy());

      addresses.strategy = strategyContract.address;

      await strategyContract.initialize(
        params.isCall,
        params.baseDecimals,
        params.underlyingDecimals,
        params.minimumContractSize,
        fixedFromFloat(0.5),
        addresses.keeper,
        addresses.pool,
        addresses.vault,
        addresses.volatilityOracle
      );
      strategyContract = await strategyContract.connect(signers.whale);
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
        }).then((contract) => contract.deploy());
      });

      it("should initialize with correct values", async () => {
        // Check Addresses
        assert.equal(await strategyContract.Asset(), params.asset);
        assert.equal(await strategyContract.keeper(), addresses.keeper);
        assert.equal(await strategyContract.Pool(), addresses.pool);
        assert.equal(await strategyContract.Vault(), addresses.vault);

        const { spot, volatility } = await strategyContract.oracles();

        assert.equal(spot, ADDRESS_ONE);
        assert.equal(volatility, PREMIA_VOLATILITY_SURFACE_ORACLE[chainId]);

        // Check Option
        const { isCall, minimumContractSize, expiry, delta64x64, strike64x64 } =
          await strategyContract.option();

        assert.equal(isCall, params.isCall);
        assert.equal(minimumContractSize, params.minimumContractSize);
        assert.bnNotEqual(expiry, BigNumber.from("0"));
        assert.equal(delta64x64, 0x8000000000000000);
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
          strategyContract.initialize(
            params.isCall,
            params.baseDecimals,
            params.underlyingDecimals,
            params.minimumContractSize,
            fixedFromFloat(0.5),
            addresses.keeper,
            addresses.pool,
            addresses.vault,
            addresses.volatilityOracle
          )
        ).to.be.revertedWith("initialized");
      });

      it("should revert when not owner", async () => {
        await expect(
          testStrategy
            .connect(signers.user)
            .initialize(
              params.isCall,
              params.baseDecimals,
              params.underlyingDecimals,
              params.minimumContractSize,
              fixedFromFloat(0.5),
              addresses.keeper,
              addresses.pool,
              addresses.vault,
              addresses.volatilityOracle
            )
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });

      it("should revert if keeper address is zero", async () => {
        await expect(
          testStrategy.initialize(
            params.isCall,
            params.baseDecimals,
            params.underlyingDecimals,
            params.minimumContractSize,
            fixedFromFloat(0.5),
            ADDRESS_ZERO,
            addresses.pool,
            addresses.vault,
            addresses.volatilityOracle
          )
        ).to.be.revertedWith("0");
      });

      it("should revert if pool address is zero", async () => {
        await expect(
          testStrategy.initialize(
            params.isCall,
            params.baseDecimals,
            params.underlyingDecimals,
            params.minimumContractSize,
            fixedFromFloat(0.5),
            addresses.keeper,
            ADDRESS_ZERO,
            addresses.vault,
            addresses.volatilityOracle
          )
        ).to.be.revertedWith("0");
      });

      it("should revert if vault address is zero", async () => {
        await expect(
          testStrategy.initialize(
            params.isCall,
            params.baseDecimals,
            params.underlyingDecimals,
            params.minimumContractSize,
            fixedFromFloat(0.5),
            addresses.keeper,
            addresses.pool,
            ADDRESS_ZERO,
            addresses.volatilityOracle
          )
        ).to.be.revertedWith("0");
      });

      it("should revert if volatility oracle address is zero", async () => {
        await expect(
          testStrategy.initialize(
            params.isCall,
            params.baseDecimals,
            params.underlyingDecimals,
            params.minimumContractSize,
            fixedFromFloat(0.5),
            addresses.keeper,
            addresses.pool,
            addresses.vault,
            ADDRESS_ZERO
          )
        ).to.be.revertedWith("0");
      });

      it("should revert if delta is less than 0", async () => {
        await expect(
          testStrategy.initialize(
            params.isCall,
            params.baseDecimals,
            params.underlyingDecimals,
            params.minimumContractSize,
            fixedFromFloat(-0.1),
            addresses.keeper,
            addresses.pool,
            addresses.vault,
            addresses.volatilityOracle
          )
        ).to.be.revertedWith("Exceeds minimum allowable value");
      });

      it("should revert if delta is greater than 1", async () => {
        await expect(
          testStrategy.initialize(
            params.isCall,
            params.baseDecimals,
            params.underlyingDecimals,
            params.minimumContractSize,
            fixedFromFloat(1.1),
            addresses.keeper,
            addresses.pool,
            addresses.vault,
            addresses.volatilityOracle
          )
        ).to.be.revertedWith("Exceeds maximum allowable value");
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
          strategyContract.purchase(
            params.depositAmount,
            params.depositAmount.div(10)
          )
        ).to.be.revertedWith("Sale has not started!");
      });

      it("should revert if sale has eneded", async () => {
        const afterSale = await (await time.now()).add(14401);
        await time.increaseTo(afterSale);

        await expect(
          strategyContract.purchase(
            params.depositAmount,
            params.depositAmount.div(10)
          )
        ).to.be.revertedWith("Sale has ended!");
      });
    });

    describe("#setNextSale", () => {
      time.revertToSnapshotAfterEach(async () => {});

      it("should revert if option hasn't expired", async () => {
        await expect(
          strategyContract.connect(signers.keeper).setNextSale(false)
        ).to.be.revertedWith("Option has not expired!");
      });

      it("should revert when not keeper", async () => {
        const { expiry } = await strategyContract.option();
        await time.increaseTo(expiry);

        await expect(strategyContract.setNextSale(false)).to.be.revertedWith(
          "1"
        );
      });
    });

    describe("#processExpired", () => {
      time.revertToSnapshotAfterEach(async () => {});

      it("should revert if option hasn't expired", async () => {
        await expect(
          strategyContract.connect(signers.keeper).processExpired()
        ).to.be.revertedWith("Option has not expired!");
      });

      it("should revert when not keeper", async () => {
        const { expiry } = await strategyContract.option();
        await time.increaseTo(expiry);

        await expect(strategyContract.processExpired()).to.be.revertedWith("1");
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

    describe("#setNextOption", () => {
      time.revertToSnapshotAfterEach(async () => {});

      it("should revert if option hasn't expired", async () => {
        await expect(
          strategyContract.connect(signers.keeper).setNextOption()
        ).to.be.revertedWith("Option has not expired!");
      });

      it("should revert when not keeper", async () => {
        const { expiry } = await strategyContract.option();
        await time.increaseTo(expiry);

        await expect(strategyContract.setNextOption()).to.be.revertedWith("1");
      });

      it("should emit SaleWindowSet event when called", async () => {
        const { expiry } = await strategyContract.option();
        await time.increaseTo(expiry);

        const tx = await strategyContract
          .connect(signers.keeper)
          .setNextOption();

        await expect(tx)
          .to.emit(strategyContract, "NextOptionSet")
          .withArgs(params.isCall, expiry.add(SECONDS_PER_WEEK), 0);
      });
    });
  });
}
