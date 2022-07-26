import { ethers } from "hardhat";
const { getContractAt } = ethers;

import { types } from "./";

import { diamondCut } from "../../scripts/diamond";

import {
  IVault,
  IVault__factory,
  VaultDiamond__factory,
  VaultAdmin__factory,
  VaultBase__factory,
  VaultView__factory,
  MockERC20,
} from "../../types";

import { fixedFromFloat } from "@premia/utils";

interface VaultUtilArgs {
  vault: IVault;
  asset: MockERC20;
  params: types.VaultParams;
  signers: types.Signers;
  addresses: types.Addresses;
}

export class VaultUtil {
  vault: IVault;
  asset: MockERC20;
  params: types.VaultParams;
  signers: types.Signers;
  addresses: types.Addresses;

  constructor(props: VaultUtilArgs) {
    this.vault = props.vault;
    this.asset = props.asset;
    this.params = props.params;
    this.signers = props.signers;
    this.addresses = props.addresses;
  }

  static async deploy(
    params: types.VaultParams,
    signers: types.Signers,
    addresses: types.Addresses
  ) {
    const initProxy = {
      isCall: params.isCall,
      minSize: params.minSize,
      delta64x64: fixedFromFloat(params.delta),
      deltaOffset64x64: fixedFromFloat(params.deltaOffset),
      reserveRate64x64:
        params.reserveRate64x64 > 0
          ? fixedFromFloat(params.reserveRate64x64)
          : 0,
      performanceFee64x64: fixedFromFloat(params.performanceFee64x64),
      withdrawalFee64x64: fixedFromFloat(params.withdrawalFee64x64),
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

    const vaultAdminFactory = new VaultAdmin__factory(signers.deployer);

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
    const collateralAsset = await vault.getCollateralAsset();

    const asset = await getContractAt("MockERC20", collateralAsset);

    return new VaultUtil({ vault, asset, params, signers, addresses });
  }
}
