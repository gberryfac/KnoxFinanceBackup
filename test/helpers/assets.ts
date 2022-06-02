import { network } from "hardhat";

import {
  DAI_ADDRESS,
  DAI_DECIMALS,
  DAI_PRICE_ORACLE,
  DAI_WHALE_ADDRESS,
  ETH_PRICE_ORACLE,
  WETH_ADDRESS,
  WETH_DECIMALS,
  WBTC_ADDRESS,
  WBTC_DECIMALS,
  BTC_PRICE_ORACLE,
  WBTC_WHALE_ADDRESS,
  LINK_ADDRESS,
  LINK_DECIMALS,
  LINK_WHALE_ADDRESS,
  LINK_PRICE_ORACLE,
  WETH_DAI_POOL,
  WBTC_DAI_POOL,
  LINK_DAI_POOL,
} from "../../constants";

const chainId = network.config.chainId;

export const DAI = {
  address: DAI_ADDRESS[chainId],
  decimals: DAI_DECIMALS,
  spotOracle: DAI_PRICE_ORACLE[chainId],
  whale: DAI_WHALE_ADDRESS[chainId],
};

export const ETH = {
  address: WETH_ADDRESS[chainId],
  decimals: WETH_DECIMALS,
  spotOracle: ETH_PRICE_ORACLE[chainId],
  whale: DAI_WHALE_ADDRESS[chainId],
};

export const BTC = {
  address: WBTC_ADDRESS[chainId],
  decimals: WBTC_DECIMALS,
  spotOracle: BTC_PRICE_ORACLE[chainId],
  whale: WBTC_WHALE_ADDRESS[chainId],
};

export const LINK = {
  address: LINK_ADDRESS[chainId],
  decimals: LINK_DECIMALS,
  spotOracle: LINK_PRICE_ORACLE[chainId],
  whale: LINK_WHALE_ADDRESS[chainId],
};

export const PREMIA = {
  WETH_DAI: {
    address: WETH_DAI_POOL[chainId],
    base: DAI,
    underlying: ETH,
  },
  WBTC_DAI: {
    address: WBTC_DAI_POOL[chainId],
    base: DAI,
    underlying: BTC,
  },
  LINK_DAI: {
    address: LINK_DAI_POOL[chainId],
    base: DAI,
    underlying: LINK,
  },
};
