import { BigNumber, ContractTransaction } from "ethers";
import { describeBehaviorOfERC4626Base } from "@solidstate/spec";

import * as time from "../test/utils/time";
import * as types from "../test/utils/types";
import { assert } from "../test/utils/assertions";

import { VaultUtil } from "../test/utils/VaultUtil";

import { MockERC20, IVault } from "../types";

interface BaseBehaviorArgs {
  deploy: () => Promise<IVault>;
  getVaultUtil: () => Promise<VaultUtil>;
  getAsset: () => Promise<MockERC20>;
  mintERC20: (
    address: string,
    amount: BigNumber
  ) => Promise<ContractTransaction>;
  burnERC20: (
    address: string,
    amount: BigNumber
  ) => Promise<ContractTransaction>;
  mintAsset: (
    address: string,
    amount: BigNumber
  ) => Promise<ContractTransaction>;
  supply: BigNumber;
}

export function describeBehaviorOfBase(
  {
    deploy,
    getVaultUtil,
    getAsset,
    mintERC20,
    burnERC20,
    mintAsset,
    supply,
  }: BaseBehaviorArgs,
  skips?: string[]
) {
  describe("::Base", () => {
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

    describeBehaviorOfERC4626Base(
      deploy,
      {
        getAsset,
        mint: mintERC20,
        burn: burnERC20,
        mintAsset,
        supply,
      },
      skips
    );

    describe.skip("#withdraw", () => {
      time.revertToSnapshotAfterEach(async () => {});
    });
  });
}
