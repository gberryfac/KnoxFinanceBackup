import { BigNumber, ContractTransaction } from "ethers";
import { describeBehaviorOfERC4626Base } from "@solidstate/spec";

import * as time from "../test/utils/time";
import * as types from "../test/utils/types";
import { assert } from "../test/utils/assertions";

import { VaultUtil } from "../test/utils/VaultUtil";

import { IAsset, IVault, MockERC20 } from "../types";

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
    let assetContract: IAsset;
    let params: types.Params;
    let signers: types.Signers;
    let addresses: types.Addresses;

    before(async () => {});

    beforeEach(async () => {
      instance = await deploy();
      v = await getVaultUtil();

      assetContract = v.assetContract;
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

    // TODO: ERC165 behavior

    describe.skip("#withdraw", () => {
      time.revertToSnapshotAfterEach(async () => {
        await assetContract
          .connect(signers.lp1)
          .approve(addresses.vault, params.depositAmount);

        await instance["depositToQueue(uint256)"](params.depositAmount);
        await instance.connect(signers.keeper)["processEpoch(bool)"](false);
      });

      it("should withdraw deposit amount from Vault", async () => {
        const lpBalanceBefore = await assetContract.balanceOf(addresses.lp1);

        await instance.setApprovalForAll(addresses.vault, true);

        await instance["withdraw(uint256,address,address)"](
          params.depositAmount,
          addresses.lp1,
          addresses.lp1
        );

        const lpBalanceAfter = await assetContract.balanceOf(addresses.lp1);
        assert.bnEqual(
          lpBalanceBefore,
          lpBalanceAfter.sub(params.depositAmount)
        );
      });
    });
  });
}
