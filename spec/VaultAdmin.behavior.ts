import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import { parseUnits } from "ethers/lib/utils";
import { fixedFromFloat, formatTokenId, TokenType } from "@premia/utils";

import chai, { expect } from "chai";
import chaiAlmost from "chai-almost";

chai.use(chaiAlmost());

import moment from "moment-timezone";
moment.tz.setDefault("UTC");

import {
  UNDERLYING_RESERVED_LIQ_TOKEN_ID,
  BASE_RESERVED_LIQ_TOKEN_ID,
} from "../constants";

import {
  Auction,
  IPremiaPool,
  IVault,
  MockERC20,
  Queue,
  IVault__factory,
  VaultAdmin__factory,
  VaultDiamond__factory,
} from "../types";

import { assert, math, time, types, KnoxUtil, PoolUtil } from "../test/utils";

import { diamondCut } from "../scripts/diamond";

interface VaultAdminBehaviorArgs {
  getKnoxUtil: () => Promise<KnoxUtil>;
  getParams: () => types.VaultParams;
}

export function describeBehaviorOfVaultAdmin(
  { getKnoxUtil, getParams }: VaultAdminBehaviorArgs,
  skips?: string[]
) {
  describe("::VaultAdmin", () => {
    // Signers and Addresses
    let addresses: types.Addresses;
    let signers: types.Signers;

    // Contract Instances and Proxies
    let asset: MockERC20;
    let queue: Queue;
    let auction: Auction;
    let vault: IVault;
    let pool: IPremiaPool;

    // Contract Utilities
    let knoxUtil: KnoxUtil;
    let poolUtil: PoolUtil;

    const params = getParams();

    before(async () => {
      knoxUtil = await getKnoxUtil();

      signers = knoxUtil.signers;
      addresses = knoxUtil.addresses;

      asset = knoxUtil.asset;
      vault = knoxUtil.vaultUtil.vault;
      pool = knoxUtil.poolUtil.pool;
      queue = knoxUtil.queue;
      auction = knoxUtil.auction;

      poolUtil = knoxUtil.poolUtil;

      await asset
        .connect(signers.deployer)
        .mint(addresses.deployer, params.mint);
      await asset.connect(signers.buyer1).mint(addresses.buyer1, params.mint);
      await asset.connect(signers.lp1).mint(addresses.lp1, params.mint);
    });

    describe("#constructor()", () => {
      time.revertToSnapshotAfterEach(async () => {});

      it("should deploy with correct state", async () => {
        assert.equal(await vault.ERC20(), asset.address);
        assert.equal(await vault.Pool(), addresses.pool);
      });
    });

    describe("#initialize(VaultStorage.InitImpl memory)", () => {
      describe("if uninitialized", () => {
        let vault: IVault;

        time.revertToSnapshotAfterEach(async () => {
          const initProxy = {
            isCall: params.isCall,
            minSize: params.minSize,
            delta64x64: BigNumber.from(0),
            deltaOffset64x64: BigNumber.from(0),
            reserveRate64x64: BigNumber.from(0),
            performanceFee64x64: BigNumber.from(0),
            withdrawalFee64x64: BigNumber.from(0),
            name: params.tokenName,
            symbol: params.tokenSymbol,
            keeper: addresses.keeper,
            feeRecipient: addresses.feeRecipient,
            pool: addresses.pool,
          };

          const vaultDiamond = await new VaultDiamond__factory(
            signers.deployer
          ).deploy(initProxy);

          let registeredSelectors = [
            vaultDiamond.interface.getSighash("supportsInterface(bytes4)"),
          ];

          const vaultAdminFactory = new VaultAdmin__factory(signers.deployer);

          const vaultAdminContract = await vaultAdminFactory
            .connect(signers.deployer)
            .deploy(params.isCall, addresses.pool);

          await vaultAdminContract.deployed();

          registeredSelectors = registeredSelectors.concat(
            await diamondCut(
              vaultDiamond,
              vaultAdminContract.address,
              vaultAdminFactory,
              registeredSelectors
            )
          );

          vault = IVault__factory.connect(addresses.vault, signers.deployer);
        });

        it("should initialize contract", async () => {
          await vault.initialize({
            auction: addresses.auction,
            queue: addresses.queue,
            pricer: addresses.pricer,
          });
        });
      });

      describe("else", () => {
        time.revertToSnapshotAfterEach(async () => {});

        it("should revert if !owner", async () => {
          await expect(
            vault.initialize({
              auction: addresses.auction,
              queue: addresses.queue,
              pricer: addresses.pricer,
            })
          ).to.be.revertedWith("Ownable: sender must be owner");
        });

        it.skip("should revert if already intialized", async () => {});

        it.skip("should revert if address is invalid", async () => {});
      });
    });

    describe("#setAuctionWindowOffsets(uint16,uint16)", () => {
      time.revertToSnapshotAfterEach(async () => {});

      it("should revert if !owner", async () => {
        await expect(
          vault.setAuctionWindowOffsets(14400, 21600)
        ).to.be.revertedWith("Ownable: sender must be owner");
      });
    });

    describe("#setFeeRecipient(address)", () => {
      time.revertToSnapshotAfterEach(async () => {});

      it("should revert if !owner", async () => {
        await expect(vault.setFeeRecipient(addresses.lp1)).to.be.revertedWith(
          "Ownable: sender must be owner"
        );
      });
    });

    describe("#setKeeper(address)", () => {
      time.revertToSnapshotAfterEach(async () => {});

      it("should revert if !owner", async () => {
        await expect(vault.setKeeper(addresses.lp1)).to.be.revertedWith(
          "Ownable: sender must be owner"
        );
      });
    });

    describe("#setPricer(address)", () => {
      time.revertToSnapshotAfterEach(async () => {});

      it("should revert if !owner", async () => {
        await expect(vault.setPricer(addresses.lp1)).to.be.revertedWith(
          "Ownable: sender must be owner"
        );
      });
    });

    describe("#setPerformanceFee64x64(int128)", () => {
      time.revertToSnapshotAfterEach(async () => {});

      it("should revert if !owner", async () => {
        await expect(
          vault.setPerformanceFee64x64(fixedFromFloat(0.5))
        ).to.be.revertedWith("Ownable: sender must be owner");
      });
    });

    describe("#setWithdrawalFee64x64(int128)", () => {
      time.revertToSnapshotAfterEach(async () => {});

      it("should revert if !owner", async () => {
        await expect(
          vault.setWithdrawalFee64x64(fixedFromFloat(0.05))
        ).to.be.revertedWith("Ownable: sender must be owner");
      });
    });

    describe("#setAndInitializeAuction()", () => {
      time.revertToSnapshotAfterEach(async () => {});
    });

    describe("#setOptionParameters()", () => {
      time.revertToSnapshotAfterEach(async () => {});

      it("should revert if !keeper", async () => {
        await expect(vault.setOptionParameters()).to.be.revertedWith("!keeper");
      });

      it("should set parameters for next option", async () => {
        await vault.connect(signers.keeper).setOptionParameters();

        const epoch = await vault.getEpoch();
        const option = await vault.getOption(epoch);

        const nextWeek = (await time.now()) + 604800;
        const expectedExpiry = BigNumber.from(
          await time.getFriday8AM(nextWeek)
        );

        assert.bnEqual(option.expiry, expectedExpiry);

        const expectedStrike = fixedFromFloat(
          params.underlying.oracle.price / params.base.oracle.price
        );

        assert.bnEqual(option.strike64x64, expectedStrike);

        let longTokenType: TokenType;
        let shortTokenType: TokenType;

        longTokenType = params.isCall ? TokenType.LongCall : TokenType.LongPut;
        shortTokenType = params.isCall
          ? TokenType.ShortCall
          : TokenType.ShortPut;

        const expectedLongTokenId = BigNumber.from(
          formatTokenId({
            tokenType: longTokenType,
            maturity: expectedExpiry,
            strike64x64: expectedStrike,
          })
        );

        assert.bnEqual(option.longTokenId, expectedLongTokenId);

        shortTokenType = params.isCall
          ? TokenType.ShortCall
          : TokenType.ShortPut;

        const expectedShortTokenId = BigNumber.from(
          formatTokenId({
            tokenType: shortTokenType,
            maturity: expectedExpiry,
            strike64x64: expectedStrike,
          })
        );

        assert.bnEqual(option.shortTokenId, expectedShortTokenId);
      });
    });

    describe("#initializeAuction()", () => {
      let epoch;
      let option;

      time.revertToSnapshotAfterEach(async () => {
        // init auction 0
        await time.fastForwardToThursday8AM();
        await vault.connect(signers.keeper).setOptionParameters();
        await vault.connect(signers.keeper).initializeAuction();

        epoch = await vault.getEpoch();
        option = await vault.getOption(epoch);
      });

      it("should revert if !keeper", async () => {
        await expect(vault.initializeAuction()).to.be.revertedWith("!keeper");
      });

      it("should set auction start to friday of current week if epoch == 0", async () => {
        const friday = await time.getFriday8AM(await time.now());

        // two hours after friday 8am
        const expectedStartTime = BigNumber.from(friday + 7200);
        // four hours after friday 8am
        const expectedEndTime = BigNumber.from(friday + 14400);

        const data = await auction.getAuction(epoch);

        assert.bnEqual(epoch, BigNumber.from(0));
        assert.bnEqual(data.strike64x64, option.strike64x64);
        assert.bnEqual(data.longTokenId, option.longTokenId);
        assert.bnEqual(data.startTime, expectedStartTime);
        assert.bnEqual(data.endTime, expectedEndTime);
      });

      it("should set auction start to option expiry if epoch > 0", async () => {
        // init epoch 1
        await time.fastForwardToFriday8AM();
        await knoxUtil.initializeNextEpoch();

        // init auction 1
        await time.fastForwardToThursday8AM();
        await vault.connect(signers.keeper).setOptionParameters();
        await vault.connect(signers.keeper).initializeAuction();

        epoch = await vault.getEpoch();
        option = await vault.getOption(epoch);

        const friday = await time.getFriday8AM(await time.now());

        // two hours after friday 8am
        const expectedStartTime = BigNumber.from(friday + 7200);
        // four hours after friday 8am
        const expectedEndTime = BigNumber.from(friday + 14400);

        const data = await auction.getAuction(epoch);

        assert.bnEqual(epoch, BigNumber.from(1));
        assert.bnEqual(data.strike64x64, option.strike64x64);
        assert.bnEqual(data.longTokenId, option.longTokenId);
        assert.bnEqual(data.startTime, expectedStartTime);
        assert.bnEqual(data.endTime, expectedEndTime);
      });
    });

    describe.skip("#processLastEpoch(bool)", () => {
      time.revertToSnapshotAfterEach(async () => {});
    });

    describe("#withdrawReservedLiquidity()", () => {
      time.revertToSnapshotAfterEach(async () => {
        await vault
          .connect(signers.deployer)
          .setPerformanceFee64x64(fixedFromFloat(0.2));

        // lp1 deposits into queue
        await asset
          .connect(signers.lp1)
          .approve(addresses.queue, params.deposit);

        await queue.connect(signers.lp1)["deposit(uint256)"](params.deposit);

        // init epoch 0 auction
        let [startTime, , epoch] = await knoxUtil.setAndInitializeAuction();

        // init epoch 1
        await time.fastForwardToFriday8AM();
        await knoxUtil.initializeNextEpoch();

        // auction 0 starts
        await time.increaseTo(startTime);

        // buyer1 purchases all available options
        await asset
          .connect(signers.buyer1)
          .approve(addresses.auction, ethers.constants.MaxUint256);

        await auction
          .connect(signers.buyer1)
          .addMarketOrder(epoch, await auction.getTotalContracts(epoch));

        // process auction 0
        await vault.connect(signers.keeper).processAuction();

        // init auction 1
        await knoxUtil.setAndInitializeAuction();

        await time.fastForwardToFriday8AM();
        await time.increase(100);
      });

      it("should revert if !keeper", async () => {
        await expect(vault.withdrawReservedLiquidity()).to.be.revertedWith(
          "!keeper"
        );
      });

      it("should withdraw reserved liquidity from pool", async () => {
        // process epoch 0
        await knoxUtil.processExpiredOptions();

        const reservedLiquidityTokenId = params.isCall
          ? UNDERLYING_RESERVED_LIQ_TOKEN_ID
          : BASE_RESERVED_LIQ_TOKEN_ID;

        const reservedLiquidityBefore = await pool.balanceOf(
          addresses.vault,
          reservedLiquidityTokenId
        );

        const totalCollateralInShortPosition =
          await vault.totalShortAsCollateral();

        assert.bnEqual(reservedLiquidityBefore, totalCollateralInShortPosition);

        const vaultCollateralBalanceBefore = await asset.balanceOf(
          addresses.vault
        );

        await vault.connect(signers.keeper).withdrawReservedLiquidity();

        const reservedLiquidityAfter = await pool.balanceOf(
          addresses.vault,
          reservedLiquidityTokenId
        );

        const vaultCollateralBalanceAfter = await asset.balanceOf(
          addresses.vault
        );

        assert.bnEqual(reservedLiquidityAfter, BigNumber.from(0));

        assert.bnEqual(
          reservedLiquidityBefore.add(vaultCollateralBalanceBefore),
          vaultCollateralBalanceAfter
        );
      });
    });

    describe("#collectPerformanceFee()", () => {
      let totalPremiums: BigNumber;

      time.revertToSnapshotAfterEach(async () => {
        await vault
          .connect(signers.deployer)
          .setPerformanceFee64x64(fixedFromFloat(0.2));

        // lp1 deposits into queue
        await asset
          .connect(signers.lp1)
          .approve(addresses.queue, params.deposit);

        await queue.connect(signers.lp1)["deposit(uint256)"](params.deposit);

        // init epoch 0 auction
        let [startTime, , epoch] = await knoxUtil.setAndInitializeAuction();

        // init epoch 1
        await time.fastForwardToFriday8AM();
        await knoxUtil.initializeNextEpoch();

        // auction 0 starts
        await time.increaseTo(startTime);

        // buyer1 purchases all available options
        await asset
          .connect(signers.buyer1)
          .approve(addresses.auction, ethers.constants.MaxUint256);

        await auction
          .connect(signers.buyer1)
          .addMarketOrder(epoch, await auction.getTotalContracts(epoch));

        // process auction 0
        await vault.connect(signers.keeper).processAuction();

        totalPremiums = await vault.totalPremiums();

        // init auction 1
        await knoxUtil.setAndInitializeAuction();

        await time.fastForwardToFriday8AM();
        await time.increase(100);
      });

      it("should revert if !keeper", async () => {
        await expect(vault.collectPerformanceFee()).to.be.revertedWith(
          "!keeper"
        );
      });

      it("should set totalPremiums to 0", async () => {
        // process epoch 0
        await knoxUtil.processExpiredOptions();
        await vault.connect(signers.keeper).withdrawReservedLiquidity();
        await vault.connect(signers.keeper).collectPerformanceFee();
        assert.bnEqual(await vault.totalPremiums(), BigNumber.from(0));
      });

      it("should not collect performance fees if option expires far-ITM", async () => {
        let underlyingPrice = params.underlying.oracle.price;
        let intrinsicValue = underlyingPrice * 0.5;

        // Make sure options expire ITM
        let spot = params.isCall
          ? underlyingPrice + intrinsicValue
          : underlyingPrice - intrinsicValue;

        await poolUtil.underlyingSpotPriceOracle.mock.latestAnswer.returns(
          spot
        );

        // process epoch 0
        await knoxUtil.processExpiredOptions();
        await vault.connect(signers.keeper).withdrawReservedLiquidity();

        const feeRecipientBalanceBefore = await asset.balanceOf(
          addresses.feeRecipient
        );

        await vault.connect(signers.keeper).collectPerformanceFee();

        const feeRecipientBalanceAfter = await asset.balanceOf(
          addresses.feeRecipient
        );

        assert.equal(
          math.bnToNumber(
            feeRecipientBalanceAfter.sub(feeRecipientBalanceBefore)
          ),
          0
        );
      });

      it("should collect performance fees if option expires ATM", async () => {
        // process epoch 0
        await knoxUtil.processExpiredOptions();
        await vault.connect(signers.keeper).withdrawReservedLiquidity();

        const feeRecipientBalanceBefore = await asset.balanceOf(
          addresses.feeRecipient
        );

        await vault.connect(signers.keeper).collectPerformanceFee();

        const feeRecipientBalanceAfter = await asset.balanceOf(
          addresses.feeRecipient
        );

        assert.equal(
          math.bnToNumber(
            feeRecipientBalanceAfter.sub(feeRecipientBalanceBefore)
          ),
          math.bnToNumber(totalPremiums.div(5))
        );
      });
    });

    describe("#initializeNextEpoch()", () => {
      let epoch: BigNumber;
      let startTime: BigNumber;

      time.revertToSnapshotAfterEach(async () => {
        await vault
          .connect(signers.deployer)
          .setPerformanceFee64x64(fixedFromFloat(0.2));

        // lp1 deposits into queue
        await asset
          .connect(signers.lp1)
          .approve(addresses.queue, params.deposit);

        await queue.connect(signers.lp1)["deposit(uint256)"](params.deposit);

        // init epoch 0 auction
        [startTime, , epoch] = await knoxUtil.setAndInitializeAuction();

        // init epoch 1
        await time.fastForwardToFriday8AM();
        await knoxUtil.initializeNextEpoch();

        // auction 0 starts
        await time.increaseTo(startTime);

        // buyer1 purchases all available options
        await asset
          .connect(signers.buyer1)
          .approve(addresses.auction, ethers.constants.MaxUint256);

        await auction
          .connect(signers.buyer1)
          .addMarketOrder(epoch, await auction.getTotalContracts(epoch));

        // process auction 0
        await vault.connect(signers.keeper).processAuction();

        // init auction 1
        [, , epoch] = await knoxUtil.setAndInitializeAuction();

        await time.fastForwardToFriday8AM();
        await time.increase(100);
      });

      it("should revert if !keeper", async () => {
        await expect(vault.initializeNextEpoch()).to.be.revertedWith("!keeper");
      });

      it("should set state parameters and increment epoch", async () => {
        const queueEpochBefore = await queue.getEpoch();
        const vaultEpochBefore = await vault.getEpoch();
        const totalShortContractsBefore = await vault.totalShortAsContracts();

        assert.bnEqual(queueEpochBefore, BigNumber.from(epoch));
        assert.bnEqual(vaultEpochBefore, BigNumber.from(epoch));
        assert.bnGt(totalShortContractsBefore, BigNumber.from(0));

        await vault.connect(signers.keeper).initializeNextEpoch();

        const queueEpochAfter = await queue.getEpoch();
        const vaultEpochAfter = await vault.getEpoch();
        const totalShortContractsAfter = await vault.totalShortAsContracts();

        epoch = epoch.add(1);

        assert.bnEqual(queueEpochAfter, BigNumber.from(epoch));
        assert.bnEqual(vaultEpochAfter, BigNumber.from(epoch));
        assert.bnEqual(totalShortContractsAfter, BigNumber.from(0));
      });
    });

    describe("#setAuctionPrices()", () => {
      time.revertToSnapshotAfterEach(async () => {});

      it("should revert if !keeper", async () => {
        await expect(vault.setAuctionPrices()).to.be.revertedWith("!keeper");
      });
    });

    describe.skip("#processAuction()", () => {
      time.revertToSnapshotAfterEach(async () => {});
    });

    describe("#getExerciseAmount(uint64,uint256)", () => {
      time.revertToSnapshotAfterEach(async () => {
        await vault.connect(signers.keeper).setOptionParameters();
      });

      it("should return 0 if option has not expired", async () => {
        const epoch = await vault.getEpoch();
        const size = parseUnits("1", params.collateral.decimals);
        const exerciseAmount = await vault.getExerciseAmount(epoch, size);
        assert.isTrue(exerciseAmount[1].isZero());
      });

      it("should return amount == 0 if option has expired ATM", async () => {
        const epoch = await vault.getEpoch();
        const option = await vault.getOption(epoch);

        await time.increaseTo(option.expiry.add(1));

        const size = parseUnits("1", params.collateral.decimals);
        const exerciseAmount = await vault.getExerciseAmount(epoch, size);

        assert.isTrue(exerciseAmount[1].isZero());
      });

      it("should return amount > 0 if option has expired ITM", async () => {
        const epoch = await vault.getEpoch();
        const option = await vault.getOption(epoch);

        const underlyingPrice = params.underlying.oracle.price;
        const intrinsicValue = underlyingPrice * 0.5;

        let spot = params.isCall
          ? underlyingPrice + intrinsicValue
          : underlyingPrice - intrinsicValue;

        await poolUtil.underlyingSpotPriceOracle.mock.latestAnswer.returns(
          spot
        );

        spot = spot / params.base.oracle.price;

        await time.increaseTo(option.expiry.add(1));
        await pool.update();

        const size = parseUnits("1", params.collateral.decimals);
        const exerciseAmount = await vault.getExerciseAmount(epoch, size);

        const bnIntrinsicValue = BigNumber.from(intrinsicValue.toString());
        const bnSpot = BigNumber.from(spot.toString());

        let expectedExerciseAmount = params.isCall
          ? bnIntrinsicValue.mul(size).div(bnSpot)
          : bnIntrinsicValue.mul(size);

        expectedExerciseAmount = expectedExerciseAmount.div(10 ** 8);
        assert.bnEqual(exerciseAmount[1], expectedExerciseAmount);
      });
    });
  });
}