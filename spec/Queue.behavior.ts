import { BigNumber, ContractTransaction } from "ethers";
import {
  describeBehaviorOfERC165,
  describeBehaviorOfERC1155Enumerable,
} from "@solidstate/spec";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import * as time from "../test/utils/time";
import * as types from "../test/utils/types";
import { assert } from "../test/utils/assertions";
import { expect } from "chai";

import { VaultUtil } from "../test/utils/VaultUtil";

import { IAsset, IVault } from "../types";

interface QueueBehaviorArgs {
  deploy: () => Promise<IVault>;
  getVaultUtil: () => Promise<VaultUtil>;
  interfaceIds: string[];
  transfer: (
    from: SignerWithAddress,
    to: SignerWithAddress,
    id: BigNumber,
    amount: BigNumber
  ) => Promise<ContractTransaction>;
  mintERC1155: (
    address: string,
    id: BigNumber,
    amount: BigNumber
  ) => Promise<ContractTransaction>;
  burnERC1155: (
    address: string,
    id: BigNumber,
    amount: BigNumber
  ) => Promise<ContractTransaction>;
  tokenId: BigNumber;
}

export function describeBehaviorOfQueue(
  {
    deploy,
    getVaultUtil,
    interfaceIds,
    transfer,
    mintERC1155,
    burnERC1155,
    tokenId,
  }: QueueBehaviorArgs,
  skips?: string[]
) {
  describe("::Queue", () => {
    let instance: IVault;
    let v: VaultUtil;
    let assetContract: IAsset;
    let params: types.Params;
    let signers: types.Signers;
    let addresses: types.Addresses;

    beforeEach(async () => {
      instance = await deploy();
      v = await getVaultUtil();

      assetContract = v.assetContract;
      params = v.params;

      signers = v.signers;
      addresses = v.addresses;
    });

    describeBehaviorOfERC165(deploy, { interfaceIds }, skips);

    describeBehaviorOfERC1155Enumerable(
      deploy,
      {
        transfer,
        mint: mintERC1155,
        burn: burnERC1155,
        tokenId,
      },
      skips
    );

    describe("#depositToQueue", () => {
      it("should adjust LP and Vault when depositToQueue is called", async () => {
        const lpBalanceBefore = await assetContract.balanceOf(addresses.lp1);

        await assetContract
          .connect(signers.lp1)
          .approve(addresses.vault, params.depositAmount);

        await instance["depositToQueue(uint256)"](params.depositAmount);

        const lpBalanceAfter = await assetContract.balanceOf(addresses.lp1);
        assert.bnEqual(
          lpBalanceBefore,
          lpBalanceAfter.add(params.depositAmount)
        );

        const epoch = await instance["epoch()"]();
        const lpQueueSharesBalance = await instance[
          "balanceOf(address,uint256)"
        ](addresses.lp1, epoch);

        // Queue token is minted 1:1 with deposit
        assert.bnEqual(lpQueueSharesBalance, params.depositAmount);

        const vaultBalance = await assetContract.balanceOf(addresses.vault);
        assert.bnEqual(vaultBalance, params.depositAmount);
      });

      it("should increase vault balance and queue shares if lp1 deposits multiple times", async () => {
        const firstDeposit = params.depositAmount;

        await assetContract
          .connect(signers.lp1)
          .approve(addresses.vault, firstDeposit);

        await instance["depositToQueue(uint256)"](firstDeposit);

        let epoch = await instance["epoch()"]();
        let lpQueueSharesBalance = await instance["balanceOf(address,uint256)"](
          addresses.lp1,
          epoch
        );

        // Queue token is minted 1:1 with deposit
        assert.bnEqual(lpQueueSharesBalance, firstDeposit);

        let vaultBalance = await assetContract.balanceOf(addresses.vault);
        assert.bnEqual(vaultBalance, firstDeposit);

        const secondDeposit = params.depositAmount.div(2);

        await assetContract
          .connect(signers.lp1)
          .approve(addresses.vault, secondDeposit);

        await instance["depositToQueue(uint256)"](secondDeposit);

        epoch = await instance["epoch()"]();
        lpQueueSharesBalance = await instance["balanceOf(address,uint256)"](
          addresses.lp1,
          epoch
        );

        const balance = firstDeposit.add(secondDeposit);

        // Queue token is minted 1:1 with deposit
        assert.bnEqual(lpQueueSharesBalance, balance);

        vaultBalance = await assetContract.balanceOf(addresses.vault);
        assert.bnEqual(vaultBalance, balance);
      });

      it.skip("should receieve vault shares if LP has deposits in past epoch", async () => {
        const firstDeposit = params.depositAmount;

        await assetContract
          .connect(signers.lp1)
          .approve(addresses.vault, firstDeposit);

        await instance["depositToQueue(uint256)"](firstDeposit);

        await instance.connect(signers.keeper)["processEpoch(bool)"](false);

        const secondDeposit = params.depositAmount.div(2);

        await assetContract
          .connect(signers.lp1)
          .approve(addresses.vault, secondDeposit);

        await instance["depositToQueue(uint256)"](secondDeposit);

        const epoch = await instance["epoch()"]();

        const lpQueueShares = await instance["balanceOf(address,uint256)"](
          addresses.lp1,
          epoch
        );

        assert.bnEqual(lpQueueShares, secondDeposit);

        const lpVaultShares = await instance["balanceOf(address)"](
          addresses.lp1
        );

        assert.bnEqual(lpVaultShares, firstDeposit);
      });
    });

    describe("#withdrawFromQueue", () => {
      time.revertToSnapshotAfterEach(async () => {
        await assetContract
          .connect(signers.lp1)
          .approve(addresses.vault, params.depositAmount);

        await instance["depositToQueue(uint256)"](params.depositAmount);
      });

      it("should withdraw exact amount deposited", async () => {
        const lpBalanceBefore = await assetContract.balanceOf(addresses.lp1);

        await instance.withdrawFromQueue(params.depositAmount);

        const lpBalanceAfter = await assetContract.balanceOf(addresses.lp1);
        assert.bnEqual(
          lpBalanceBefore,
          lpBalanceAfter.sub(params.depositAmount)
        );

        const epoch = await instance.epoch();
        const lpQueueSharesBalance = await instance[
          "balanceOf(address,uint256)"
        ](addresses.lp1, epoch);

        // LPs Queue token is burned
        assert.isTrue(lpQueueSharesBalance.isZero());
      });
    });

    describe.skip("#maxRedeemShares", () => {
      time.revertToSnapshotAfterEach(async () => {
        await assetContract
          .connect(signers.lp1)
          .approve(addresses.vault, params.depositAmount);

        await instance["depositToQueue(uint256)"](params.depositAmount);
        await instance.connect(signers.keeper)["processEpoch(bool)"](false);
      });

      it("should redeem Queue shares for Vault shares", async () => {
        const previousEpoch = (await instance.epoch()).sub(1);
        const lpQueueSharesBefore = await instance[
          "balanceOf(address,uint256)"
        ](addresses.lp1, previousEpoch);

        assert.bnEqual(lpQueueSharesBefore, params.depositAmount);

        const lpVaultSharesBefore = await instance["balanceOf(address)"](
          addresses.lp1
        );

        assert.isTrue(lpVaultSharesBefore.isZero());

        await instance.maxRedeemShares(addresses.lp1);

        const lpQueueSharesAfter = await instance["balanceOf(address,uint256)"](
          addresses.lp1,
          previousEpoch
        );

        assert.isTrue(lpQueueSharesAfter.isZero());

        const lpVaultSharesAfter = await instance["balanceOf(address)"](
          addresses.lp1
        );

        assert.bnEqual(lpVaultSharesAfter, params.depositAmount);
      });

      it("should revert if sender != receiver and sender != approved", async () => {
        await expect(
          instance.connect(signers.lp2).maxRedeemShares(addresses.lp1)
        ).to.be.revertedWith("ERC1155: caller is not owner nor approved");

        await instance.setApprovalForAll(addresses.lp2, true);
        await instance.connect(signers.lp2).maxRedeemShares(addresses.lp1);
      });
    });
  });
}
