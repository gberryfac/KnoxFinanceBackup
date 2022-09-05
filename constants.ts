/* eslint-disable no-unused-vars */
export enum CHAINID {
  ETH_MAINNET = 1,
  ETH_RINKEBY = 4,
  ARB_MAINNET = 42161,
  ARB_RINKEBY = 421611,
}
/* eslint-enable */

export const BLOCK_NUMBER = {
  // TODO: [CHAINID.ETH_MAINNET]: // must be a monday
  [CHAINID.ARB_MAINNET]: 17900000, // Jul-18-2022 09:21:06 AM +UTC
};

export const TEST_URI = {
  [CHAINID.ETH_MAINNET]: process.env.TEST_URI,
  [CHAINID.ETH_RINKEBY]: process.env.MAINNET_RINKEBY_URI,
  [CHAINID.ARB_MAINNET]: process.env.ARBITRUM_URI,
  [CHAINID.ARB_RINKEBY]: process.env.ARBITRUM_RINKEBY_URI,
};

export const UNDERLYING_RESERVED_LIQ_TOKEN_ID =
  "0x0200000000000000000000000000000000000000000000000000000000000000";
export const BASE_RESERVED_LIQ_TOKEN_ID =
  "0x0300000000000000000000000000000000000000000000000000000000000000";

/**
 * Assets
 */
export const WETH_ADDRESS = {
  [CHAINID.ETH_MAINNET]: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  [CHAINID.ETH_RINKEBY]: "0xd0A1E359811322d97991E03f863a0C30C2cF029C",
  [CHAINID.ARB_MAINNET]: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
  [CHAINID.ARB_RINKEBY]: "0xEBbc3452Cc911591e4F18f3b36727Df45d6bd1f9",
};

export const WBTC_ADDRESS = {
  [CHAINID.ETH_MAINNET]: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
  [CHAINID.ETH_RINKEBY]: "0xA5eFEe8c0D466349da48eCe3Da9EdcbA0466aaCc",
  [CHAINID.ARB_MAINNET]: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
  [CHAINID.ARB_RINKEBY]: "0xEBbc3452Cc911591e4F18f3b36727Df45d6bd1f9",
};

export const DAI_ADDRESS = {
  [CHAINID.ETH_MAINNET]: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
  [CHAINID.ETH_RINKEBY]: "0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa",
  [CHAINID.ARB_MAINNET]: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
  [CHAINID.ARB_RINKEBY]: "0x2f3C1B6A51A469051A22986aA0dDF98466cc8D3c",
};

export const LINK_ADDRESS = {
  [CHAINID.ETH_MAINNET]: "0x514910771AF9Ca656af840dff83E8264EcF986CA",
  [CHAINID.ETH_RINKEBY]: "",
  [CHAINID.ARB_MAINNET]: "0xf97f4df75117a78c1A5a0DBb814Af92458539FB4",
  [CHAINID.ARB_RINKEBY]: "",
};

export const WETH_NAME = "wETH";
export const WBTC_NAME = "wBTC";
export const DAI_NAME = "DAI";
export const LINK_NAME = "LINK";

export const WETH_DECIMALS = 18;
export const WBTC_DECIMALS = 8;
export const DAI_DECIMALS = 18;
export const LINK_DECIMALS = 18;

/**
 * Assets Storage Slots
 *
 * Used https://npmjs.com/package/slot20 to get slots.
 */
export const SLOTS = {
  [DAI_ADDRESS[CHAINID.ETH_MAINNET]]: 2,
  [DAI_ADDRESS[CHAINID.ARB_MAINNET]]: 2,
  [WETH_ADDRESS[CHAINID.ETH_MAINNET]]: 3,
  [WETH_ADDRESS[CHAINID.ARB_MAINNET]]: 51,
  [WBTC_ADDRESS[CHAINID.ETH_MAINNET]]: 0,
  [WBTC_ADDRESS[CHAINID.ARB_MAINNET]]: 51,
  [LINK_ADDRESS[CHAINID.ETH_MAINNET]]: 1,
  [LINK_ADDRESS[CHAINID.ARB_MAINNET]]: 51,
};

/**
 * Oracles
 *
 * Chainlink: https://data.chain.link/
 */
export const ETH_PRICE_ORACLE = {
  [CHAINID.ETH_MAINNET]: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
  [CHAINID.ETH_RINKEBY]: "0x9326BFA02ADD2366b30bacB125260Af641031331",
  [CHAINID.ARB_MAINNET]: "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612",
  [CHAINID.ARB_RINKEBY]: "",
};

export const BTC_PRICE_ORACLE = {
  [CHAINID.ETH_MAINNET]: "0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c",
  [CHAINID.ETH_RINKEBY]: "0x6135b13325bfC4B00278B4abC5e20bbce2D6580e",
  [CHAINID.ARB_MAINNET]: "0x6ce185860a4963106506C203335A2910413708e9",
  [CHAINID.ARB_RINKEBY]: "",
};

export const USDC_PRICE_ORACLE = {
  [CHAINID.ETH_MAINNET]: "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6",
  [CHAINID.ETH_RINKEBY]: "0x9211c6b3BF41A10F78539810Cf5c64e1BB78Ec60",
  [CHAINID.ARB_MAINNET]: "0x50834f3163758fcc1df9973b6e91f0f0f0434ad3",
  [CHAINID.ARB_RINKEBY]: "",
};

export const DAI_PRICE_ORACLE = {
  [CHAINID.ETH_MAINNET]: "0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9",
  [CHAINID.ETH_RINKEBY]: "",
  [CHAINID.ARB_MAINNET]: "0xc5C8E77B397E531B8EC06BFb0048328B30E9eCfB",
  [CHAINID.ARB_RINKEBY]: "",
};

export const LINK_PRICE_ORACLE = {
  [CHAINID.ETH_MAINNET]: "0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c",
  [CHAINID.ETH_RINKEBY]: "",
  [CHAINID.ARB_MAINNET]: "0x86E53CF1B870786351Da77A57575e79CB55812CB",
  [CHAINID.ARB_RINKEBY]: "",
};

export const ETH_PRICE_ORACLE_DECIMALS = 8;
export const BTC_PRICE_ORACLE_DECIMALS = 8;
export const USDC_PRICE_ORACLE_DECIMALS = 8;
export const DAI_PRICE_ORACLE_DECIMALS = 8;
export const LINK_PRICE_ORACLE_DECIMALS = 8;

export const ETH_SPOT_PRICE = 200000000000;
export const BTC_SPOT_PRICE = 2000000000000;
export const DAI_SPOT_PRICE = 100000000;
export const LINK_SPOT_PRICE = 1000000000;

/**
 * Premia Pools
 * https://github.com/Premian-Labs/premia-contracts/blob/master/docs/deployments
 */
export const WETH_DAI_POOL = {
  [CHAINID.ETH_MAINNET]: "0xa4492fcDa2520cB68657d220f4D4aE3116359C10",
  [CHAINID.ARB_MAINNET]: "0xE5DbC4EDf467B609A063c7ea7fAb976C6b9BAa1a",
};

export const WBTC_DAI_POOL = {
  [CHAINID.ETH_MAINNET]: "0x1B63334f7bfDf0D753AB3101EB6d02B278db8852",
  [CHAINID.ARB_MAINNET]: "0xb5fE3bc2eF4c34cC233922dfF2Fcb1B1BF89A38E",
};

export const LINK_DAI_POOL = {
  [CHAINID.ETH_MAINNET]: "0xFDD2FC2c73032AE1501eF4B19E499F2708F34657",
  [CHAINID.ARB_MAINNET]: "0xf87Ca9EB60c2E40A6C5Ab14ca291934a95F845Ff",
};

export const PREMIA_VOLATILITY_SURFACE_ORACLE = {
  [CHAINID.ETH_MAINNET]: "0x9b0EfA67e8112d8EA2eB3C86C798B2bb88467335",
  [CHAINID.ETH_RINKEBY]: "",
  [CHAINID.ARB_MAINNET]: "0xC4B2C51f969e0713E799De73b7f130Fb7Bb604CF",
  [CHAINID.ARB_RINKEBY]: "",
};

export const PREMIA_MULTISIG = {
  [CHAINID.ARB_MAINNET]: "0xa079C6B032133b95Cf8b3d273D27eeb6B110a469",
};

export const PREMIA_DIAMOND = {
  [CHAINID.ARB_MAINNET]: "0x89b36CE3491f2258793C7408Bd46aac725973BA2",
};

/**
 * Uniswap V2
 */
export const UNISWAP_V2_FACTORY = {
  [CHAINID.ARB_MAINNET]: "0xc35DADB65012eC5796536bD9864eD8773aBc74C4",
};

export const UNISWAP_V2_ROUTER02 = {
  [CHAINID.ARB_MAINNET]: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506",
};
