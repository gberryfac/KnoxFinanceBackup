import { network } from "hardhat";

import * as time from "../test/utils/time";
import * as types from "../test/utils/types";
import { assert } from "../test/utils/assertions";

import { VaultUtil } from "../test/utils/VaultUtil";

import { MockERC20, IVault } from "../types";

import { NEXT_FRIDAY } from "../constants";

interface AdminBehaviorArgs {
  deploy: () => Promise<IVault>;
  getVaultUtil: () => Promise<VaultUtil>;
}

const chainId = network.config.chainId;

export function describeBehaviorOfAdmin(
  { deploy, getVaultUtil }: AdminBehaviorArgs,
  skips?: string[]
) {
  describe("::Admin", () => {
    let instance: IVault;
    let v: VaultUtil;
    let asset: MockERC20;
    let params: types.VaultParams;
    let signers: types.Signers;
    let addresses: types.Addresses;

    before(async () => {});

    beforeEach(async () => {
      instance = await deploy();
      v = await getVaultUtil();

      asset = v.asset;
      params = v.params;

      signers = v.signers;
      addresses = v.addresses;
    });

    describe.skip("#processEpoch", () => {
      time.revertToSnapshotAfterEach(async () => {
        await asset
          .connect(signers.lp1)
          .approve(addresses.vault, params.deposit);

        await instance["depositToQueue(uint256)"](params.deposit);
      });

      it("should adjust Queue and Vault balances when processEpoch is called", async () => {
        let totalAssets = await instance.totalAssets();
        assert.isTrue(totalAssets.isZero());

        let totalDeposits = await instance.totalDeposits();
        assert.bnEqual(totalDeposits, params.deposit);

        await instance.connect(signers.keeper)["processEpoch(bool)"](false);

        totalAssets = await instance.totalAssets();
        assert.bnEqual(totalAssets, params.deposit);

        totalDeposits = await instance.totalDeposits();
        assert.isTrue(totalDeposits.isZero());
      });

      it("should update the Vault state when processEpoch is called", async () => {
        let epoch = await instance.epoch();
        // // TODO: format claimTokenId
        // assert.bnEqual(claimTokenId, formatTokenId(epoch));

        await instance.connect(signers.keeper)["processEpoch(bool)"](false);

        epoch = await instance.epoch();
        // // TODO: format claimTokenId
        // assert.bnEqual(claimTokenId, formatTokenId(epoch));

        let [, expiry, claimTokenId] = await instance.option();
        assert.bnEqual(expiry, NEXT_FRIDAY[chainId]);

        // // TODO: format claimTokenId
        // assert.bnEqual(claimTokenId, formatTokenId(epoch));
      });
    });
  });
}
