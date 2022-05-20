import { network } from "hardhat";

import {
  DAI_ADDRESS,
  DAI_DECIMALS,
  DAI_PRICE_ORACLE,
  ETH_PRICE_ORACLE,
  WETH_ADDRESS,
  WETH_DECIMALS,
} from "../../constants";

const chainId = network.config.chainId;

export const DAI = {
  address: DAI_ADDRESS[chainId],
  decimals: DAI_DECIMALS,
  spotOracle: DAI_PRICE_ORACLE[chainId],
};

export const ETH = {
  address: WETH_ADDRESS[chainId],
  decimals: WETH_DECIMALS,
  spotOracle: ETH_PRICE_ORACLE[chainId],
};
