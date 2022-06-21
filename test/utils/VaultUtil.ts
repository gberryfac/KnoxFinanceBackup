import * as types from "./types";

import { diamondCut } from "../../scripts/diamond";

import {
  IVault,
  Admin__factory,
  Auction__factory,
  Base__factory,
  Helpers__factory,
  IVault__factory,
  Queue__factory,
  VaultDiamond__factory,
  View__factory,
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
    const helpers = await new Helpers__factory(signers.admin).deploy();

    const initParams = {
      isCall: params.isCall,
      minimumContractSize: params.minimumContractSize,
      delta64x64: fixedFromFloat(params.delta),
    };
    const initProps = {
      minimumSupply: params.minimumSupply,
      cap: params.cap,
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
      signers.admin
    ).deploy();

    let registeredSelectors = [
      vaultDiamond.interface.getSighash("supportsInterface(bytes4)"),
    ];

    const baseFactory = new Base__factory(signers.admin);
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

    const queueFactory = new Queue__factory(signers.admin);
    const queueContract = await queueFactory.deploy(
      params.isCall,
      addresses.pool
    );
    await queueContract.deployed();

    registeredSelectors = registeredSelectors.concat(
      await diamondCut(
        vaultDiamond,
        queueContract.address,
        queueFactory,
        registeredSelectors
      )
    );

    const adminFactory = new Admin__factory(
      {
        "contracts/libraries/Helpers.sol:Helpers": helpers.address,
      },
      signers.admin
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

    const auctionFactory = new Auction__factory(signers.admin);
    const auctionContract = await auctionFactory.deploy(
      params.isCall,
      addresses.pool
    );
    await auctionContract.deployed();

    registeredSelectors = registeredSelectors.concat(
      await diamondCut(
        vaultDiamond,
        auctionContract.address,
        auctionFactory,
        registeredSelectors
      )
    );

    const viewFactory = new View__factory(signers.admin);
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
    await vault.connect(signers.admin).init(initParams, initProps);

    return new VaultUtil({ vault, assetContract, params, signers, addresses });
  }
}
