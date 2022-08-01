import { ethers } from "hardhat";
import { BigNumber } from "ethers";
const { provider } = ethers;
import { Block } from "@ethersproject/abstract-provider";
import { fixedFromFloat, formatTokenId, TokenType } from "@premia/utils";

import chai, { expect } from "chai";
import chaiAlmost from "chai-almost";

chai.use(chaiAlmost());

import moment from "moment-timezone";
moment.tz.setDefault("UTC");

import {
  Auction,
  IPremiaPool,
  IVault,
  MockERC20,
  IVault__factory,
  VaultAdmin__factory,
  VaultDiamond__factory,
} from "../types";

import { assert, time, types, KnoxUtil, PoolUtil } from "../test/utils";

import { diamondCut } from "../scripts/diamond";
import { parseUnits } from "ethers/lib/utils";

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
    let auction: Auction;
    let vault: IVault;
    let pool: IPremiaPool;

    // Contract Utilities
    let knoxUtil: KnoxUtil;
    let poolUtil: PoolUtil;

    // Test Suite Globals
    let block: Block;
    let epoch = 1;

    const params = getParams();

    before(async () => {
      knoxUtil = await getKnoxUtil();

      signers = knoxUtil.signers;
      addresses = knoxUtil.addresses;

      asset = knoxUtil.asset;
      vault = knoxUtil.vaultUtil.vault;
      pool = knoxUtil.poolUtil.pool;
      auction = knoxUtil.auction;

      poolUtil = knoxUtil.poolUtil;

      asset.connect(signers.deployer).mint(addresses.vault, params.mint);

      block = await provider.getBlock(await provider.getBlockNumber());
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
        const epoch = (await vault.getEpoch()).add(1);
        const option = await vault.getOption(epoch);

        const nextWeek = block.timestamp + 604800;
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

    describe("#setAuctionWindow()", () => {
      time.revertToSnapshotAfterEach(async () => {});

      it("should revert if !keeper", async () => {
        await expect(vault.setAuctionWindow()).to.be.revertedWith("!keeper");
      });
    });

    describe("#initializeAuction()", () => {
      time.revertToSnapshotAfterEach(async () => {});

      it("should revert if !keeper", async () => {
        await expect(vault.initializeAuction()).to.be.revertedWith("!keeper");
      });
    });

    describe.skip("#processEpoch(bool)", () => {
      time.revertToSnapshotAfterEach(async () => {});
    });

    describe.skip("#collectPerformanceFee()", () => {
      let epoch = 1;

      time.revertToSnapshotAfterEach(async () => {
        const [startTime, endTime] = await knoxUtil.initializeAuction(epoch);
        await time.increaseTo(startTime);
      });

      it("should revert if !keeper", async () => {
        await expect(vault.collectPerformanceFee()).to.be.revertedWith(
          "!keeper"
        );
      });

      it("should not collect performance fees if vault books neutral net income", async () => {});

      it("should collect performance fees if vault books positive net income", async () => {});
    });

    describe("#depositQueuedToVault()", () => {
      time.revertToSnapshotAfterEach(async () => {
        await asset
          .connect(signers.deployer)
          .transfer(addresses.queue, params.deposit);
      });

      it("should revert if !keeper", async () => {
        await expect(vault.depositQueuedToVault()).to.be.revertedWith(
          "!keeper"
        );
      });

      it("should transfer balance of queue to vault", async () => {
        const vaultBalanceBefore = await asset.balanceOf(addresses.vault);
        await vault.connect(signers.keeper).depositQueuedToVault();
        const vaultBalanceAfter = await asset.balanceOf(addresses.vault);

        assert.bnEqual(
          vaultBalanceAfter.sub(vaultBalanceBefore),
          params.deposit
        );
      });
    });

    describe("#setNextEpoch()", () => {
      time.revertToSnapshotAfterEach(async () => {});

      it("should revert if !keeper", async () => {
        await expect(vault.setNextEpoch()).to.be.revertedWith("!keeper");
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
        const epoch = (await vault.getEpoch()).add(1);

        const size = parseUnits("1", params.collateral.decimals);

        const exerciseAmount = await vault.getExerciseAmount(epoch, size);

        assert.isTrue(exerciseAmount[1].isZero());
      });

      it("should return amount == 0 if option has expired ATM", async () => {
        const epoch = (await vault.getEpoch()).add(1);
        const option = await vault.getOption(epoch);

        await time.increaseTo(option.expiry.add(1));

        const size = parseUnits("1", params.collateral.decimals);
        const exerciseAmount = await vault.getExerciseAmount(epoch, size);

        assert.isTrue(exerciseAmount[1].isZero());
      });

      it("should return amount > 0 if option has expired ITM", async () => {
        const epoch = (await vault.getEpoch()).add(1);
        const option = await vault.getOption(epoch);

        const underlyingPrice = params.underlying.oracle.price;
        const intrinsicValue = underlyingPrice / 2;

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
