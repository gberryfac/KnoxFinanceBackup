import { network } from "hardhat";

import * as time from "../test/utils/time";
import * as types from "../test/utils/types";

import { VaultUtil } from "../test/utils/VaultUtil";

import { MockERC20, IVault } from "../types";

interface AdminBehaviorArgs {
  deploy: () => Promise<IVault>;
  getVaultUtil: () => Promise<VaultUtil>;
}

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

      it("should adjust Queue and Vault balances when processEpoch is called", async () => {});

      it("should update the Vault state when processEpoch is called", async () => {});
    });
  });
}
