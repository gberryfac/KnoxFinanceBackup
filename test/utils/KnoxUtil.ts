import { ethers } from "hardhat";
import { BigNumber } from "ethers";
const { provider } = ethers;
const { hexConcat, hexZeroPad } = ethers.utils;

import { fixedFromFloat } from "@premia/utils";
import { deployMockContract } from "ethereum-waffle";

import {
  Auction,
  MockERC20,
  Queue,
  Auction__factory,
  AuctionProxy__factory,
  Queue__factory,
  QueueProxy__factory,
} from "../../types";

import { accounts, time, types, PoolUtil, VaultUtil } from ".";

export interface ClaimTokenId {
  address: string;
  epoch: BigNumber;
}

export function formatClaimTokenId({ address, epoch }: ClaimTokenId) {
  return hexConcat([
    hexZeroPad(BigNumber.from(address).toHexString(), 20),
    hexZeroPad(epoch.toHexString(), 8),
  ]);
}

export async function getEvent(tx: any, event: string) {
  let receipt = await tx.wait();
  return receipt.events?.filter((x) => {
    return x.event == event;
  });
}

export async function getEventArgs(tx: any, event: string) {
  return (await getEvent(tx, event))[0].args;
}

interface KnoxUtilArgs {
  params: types.VaultParams;
  signers: types.Signers;
  addresses: types.Addresses;
  asset: MockERC20;
  vaultUtil: VaultUtil;
  poolUtil: PoolUtil;
  queue: Queue;
  auction: Auction;
}

export class KnoxUtil {
  params: types.VaultParams;
  signers: types.Signers;
  addresses: types.Addresses;
  asset: MockERC20;
  vaultUtil: VaultUtil;
  poolUtil: PoolUtil;
  queue: Queue;
  auction: Auction;

  constructor(props: KnoxUtilArgs) {
    this.params = props.params;
    this.signers = props.signers;
    this.addresses = props.addresses;
    this.asset = props.asset;
    this.vaultUtil = props.vaultUtil;
    this.poolUtil = props.poolUtil;
    this.queue = props.queue;
    this.auction = props.auction;
  }

  static async deploy(
    params: types.VaultParams,
    signers: types.Signers,
    addresses: types.Addresses
  ) {
    signers = await accounts.getSigners();
    addresses = await accounts.getAddresses(signers);

    // deploy Premia's Option Pool
    const poolUtil = await PoolUtil.deploy(
      params.underlying,
      params.base,
      signers.deployer
    );

    const pool = poolUtil.pool;
    addresses.pool = pool.address;

    // deploy Vault
    const vaultUtil = await VaultUtil.deploy(params, signers, addresses);

    const vault = vaultUtil.vault;
    addresses.vault = vault.address;

    // deploy Queue
    let queue = await new Queue__factory(signers.deployer).deploy(
      params.isCall,
      addresses.pool,
      addresses.vault
    );

    const queueProxy = await new QueueProxy__factory(signers.deployer).deploy(
      params.maxTVL,
      queue.address,
      addresses.vault
    );

    queue = Queue__factory.connect(queueProxy.address, signers.lp1);
    addresses.queue = queue.address;

    // deploy Auction
    let auction = await new Auction__factory(signers.deployer).deploy(
      params.isCall,
      addresses.pool,
      addresses.vault
    );

    const auctionProxy = await new AuctionProxy__factory(
      signers.deployer
    ).deploy(params.minSize, auction.address, addresses.vault);

    auction = Auction__factory.connect(auctionProxy.address, signers.buyer1);
    addresses.auction = auction.address;

    // deploy mock Pricer
    const mockVolatilityOracle = await deployMockContract(
      signers.deployer as any,
      [
        "function getAnnualizedVolatility64x64(address,address,int128,int128,int128) external view returns (int128)",
      ]
    );

    await mockVolatilityOracle.mock.getAnnualizedVolatility64x64.returns(
      fixedFromFloat("0.9")
    );

    const mockPricer = await deployMockContract(signers.deployer as any, [
      "function getDeltaStrikePrice64x64(bool,uint64,int128) external view returns (int128)",
      "function snapToGrid(bool,int128) external view returns (int128)",
    ]);

    const underlyingPrice = params.underlying.oracle.price;
    const basePrice = params.base.oracle.price;

    const strike = underlyingPrice / basePrice;
    const strike64x64 = fixedFromFloat(strike);

    await mockPricer.mock.getDeltaStrikePrice64x64.returns(strike64x64);
    await mockPricer.mock.snapToGrid.returns(strike64x64);

    addresses.pricer = mockPricer.address;

    // inititialize Vault
    const initImpl = {
      auction: addresses.auction,
      queue: addresses.queue,
      pricer: addresses.pricer,
    };

    await vault.connect(signers.deployer).initialize(initImpl);

    const asset = vaultUtil.asset;

    // gets vault signer
    signers.vault = await accounts.impersonateVault(signers, addresses);

    return new KnoxUtil({
      params,
      signers,
      addresses,
      asset,
      vaultUtil,
      poolUtil,
      queue,
      auction,
    });
  }

  async setAndInitializeAuction(): Promise<[BigNumber, BigNumber, BigNumber]> {
    const block = await provider.getBlock(await provider.getBlockNumber());
    await time.increaseTo(await time.getThursday8AM(block.timestamp));

    const vault = this.vaultUtil.vault;
    await vault.connect(this.signers.keeper).setAndInitializeAuction();

    const epoch = await vault.getEpoch();
    const auction = await this.auction.getAuction(epoch);

    return [auction.startTime, auction.endTime, epoch];
  }

  async processExpiredOptions() {
    const vault = this.vaultUtil.vault;
    const lastEpoch = (await vault.getEpoch()).sub(1);
    const expiredOption = await vault.getOption(lastEpoch);

    const pool = this.poolUtil.pool;
    const accounts = await pool.accountsByToken(expiredOption.longTokenId);
    let balances = BigNumber.from(0);

    for (const account of accounts) {
      const balance = await pool.balanceOf(account, expiredOption.longTokenId);
      balances = balances.add(balance);
    }

    await pool.processExpired(expiredOption.longTokenId, balances);
  }

  async initializeNextEpoch() {
    const vault = this.vaultUtil.vault;
    const epoch = await vault.getEpoch();

    await vault.connect(this.signers.keeper).depositQueuedToVault();

    const maxPrice64x64 = fixedFromFloat(this.params.price.max);
    const minPrice64x64 = fixedFromFloat(this.params.price.min);

    await this.auction
      .connect(this.signers.vault)
      .setAuctionPrices(epoch, maxPrice64x64, minPrice64x64);

    await vault.connect(this.signers.keeper).setNextEpoch();
  }
}
