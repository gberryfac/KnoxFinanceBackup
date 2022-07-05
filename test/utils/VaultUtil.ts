import * as types from "./types";

import { diamondCut } from "../../scripts/diamond";

import {
  IVault,
  Helpers__factory,
  IVault__factory,
  VaultDiamond__factory,
  VaultAdmin__factory,
  VaultBase__factory,
  VaultView__factory,
  VaultWrite__factory,
  IAsset,
} from "../../types";

import { fixedFromFloat } from "@premia/utils";

interface VaultUtilArgs {
  vault: IVault;
  assetContract: IAsset;
  params: types.Params;
  signers: types.Signers;
  addresses: types.Addresses;
}

export class VaultUtil {
  vault: IVault;
  assetContract: IAsset;
  params: types.Params;
  signers: types.Signers;
  addresses: types.Addresses;

  constructor(props: VaultUtilArgs) {
    this.vault = props.vault;
    this.assetContract = props.assetContract;
    this.params = props.params;
    this.signers = props.signers;
    this.addresses = props.addresses;
  }

  static async deploy(
    assetContract: IAsset,
    params: types.Params,
    signers: types.Signers,
    addresses: types.Addresses
  ) {
    const helpers = await new Helpers__factory(signers.deployer).deploy();

    const initProxy = {
      isCall: params.isCall,
      minimumContractSize: params.minimumContractSize,
      delta64x64: fixedFromFloat(params.delta),
      performanceFee: params.performanceFee,
      withdrawalFee: params.withdrawalFee,
      name: params.tokenName,
      symbol: params.tokenSymbol,
      keeper: addresses.keeper,
      feeRecipient: addresses.feeRecipient,
      pool: addresses.pool,
    };

    const initImpl = {
      auction: addresses.auction,
      queue: addresses.queue,
      pricer: addresses.pricer,
    };

    const vaultDiamond = await new VaultDiamond__factory(
      signers.deployer
    ).deploy(initProxy);

    let registeredSelectors = [
      vaultDiamond.interface.getSighash("supportsInterface(bytes4)"),
    ];

    const vaultBaseFactory = new VaultBase__factory(signers.deployer);
    const vaultBaseContract = await vaultBaseFactory.deploy(
      params.isCall,
      addresses.pool
    );
    await vaultBaseContract.deployed();

    registeredSelectors = registeredSelectors.concat(
      await diamondCut(
        vaultDiamond,
        vaultBaseContract.address,
        vaultBaseFactory,
        registeredSelectors
      )
    );

    const vaultAdminFactory = new VaultAdmin__factory(
      {
        "contracts/libraries/Helpers.sol:Helpers": helpers.address,
      },
      signers.deployer
    );

    const vaultAdminContract = await vaultAdminFactory.deploy(
      params.isCall,
      addresses.pool
    );
    await vaultAdminContract.deployed();

    registeredSelectors = registeredSelectors.concat(
      await diamondCut(
        vaultDiamond,
        vaultAdminContract.address,
        vaultAdminFactory,
        registeredSelectors
      )
    );

    const vaultWriteFactory = new VaultWrite__factory(signers.deployer);
    const vaultWriteContract = await vaultWriteFactory.deploy(
      params.isCall,
      addresses.pool
    );
    await vaultWriteContract.deployed();

    registeredSelectors = registeredSelectors.concat(
      await diamondCut(
        vaultDiamond,
        vaultWriteContract.address,
        vaultWriteFactory,
        registeredSelectors
      )
    );

    const vaultViewFactory = new VaultView__factory(signers.deployer);
    const vaultViewContract = await vaultViewFactory.deploy(
      params.isCall,
      addresses.pool
    );
    await vaultViewContract.deployed();

    registeredSelectors.concat(
      await diamondCut(
        vaultDiamond,
        vaultViewContract.address,
        vaultViewFactory,
        registeredSelectors
      )
    );

    addresses.vault = vaultDiamond.address;
    const vault = IVault__factory.connect(addresses.vault, signers.lp1);
    await vault.connect(signers.deployer).initialize(initImpl);

    return new VaultUtil({ vault, assetContract, params, signers, addresses });
  }
}
