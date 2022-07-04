import * as types from "./types";

import { diamondCut } from "../../scripts/diamond";

import {
  IVault,
  Admin__factory,
  Base__factory,
  Helpers__factory,
  IVault__factory,
  VaultDiamond__factory,
  View__factory,
  Write__factory,
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

    const initParams = {
      isCall: params.isCall,
      minimumContractSize: params.minimumContractSize,
      delta64x64: fixedFromFloat(params.delta),
    };
    const initProps = {
      minimumSupply: params.minimumSupply,
      maxTVL: params.maxTVL,
      performanceFee: params.performanceFee,
      withdrawalFee: params.withdrawalFee,
      name: params.tokenName,
      symbol: params.tokenSymbol,
      keeper: addresses.keeper,
      feeRecipient: addresses.feeRecipient,
      pool: addresses.pool,
      pricer: addresses.pricer,
    };

    const vaultDiamond = await new VaultDiamond__factory(
      signers.deployer
    ).deploy();

    let registeredSelectors = [
      vaultDiamond.interface.getSighash("supportsInterface(bytes4)"),
    ];

    const baseFactory = new Base__factory(signers.deployer);
    const baseContract = await baseFactory.deploy(
      params.isCall,
      addresses.pool
    );
    await baseContract.deployed();

    registeredSelectors = registeredSelectors.concat(
      await diamondCut(
        vaultDiamond,
        baseContract.address,
        baseFactory,
        registeredSelectors
      )
    );

    const adminFactory = new Admin__factory(
      {
        "contracts/libraries/Helpers.sol:Helpers": helpers.address,
      },
      signers.deployer
    );

    const adminContract = await adminFactory.deploy(
      params.isCall,
      addresses.pool
    );
    await adminContract.deployed();

    registeredSelectors = registeredSelectors.concat(
      await diamondCut(
        vaultDiamond,
        adminContract.address,
        adminFactory,
        registeredSelectors
      )
    );

    const writeFactory = new Write__factory(signers.deployer);
    const writeContract = await writeFactory.deploy(
      params.isCall,
      addresses.pool
    );
    await writeContract.deployed();

    registeredSelectors = registeredSelectors.concat(
      await diamondCut(
        vaultDiamond,
        writeContract.address,
        writeFactory,
        registeredSelectors
      )
    );

    const viewFactory = new View__factory(signers.deployer);
    const viewContract = await viewFactory.deploy(
      params.isCall,
      addresses.pool
    );
    await viewContract.deployed();

    registeredSelectors = registeredSelectors.concat(
      await diamondCut(
        vaultDiamond,
        viewContract.address,
        viewFactory,
        registeredSelectors
      )
    );

    addresses.vault = vaultDiamond.address;
    const vault = IVault__factory.connect(addresses.vault, signers.lp1);
    await vault.connect(signers.deployer).init(initParams, initProps);

    return new VaultUtil({ vault, assetContract, params, signers, addresses });
  }
}
