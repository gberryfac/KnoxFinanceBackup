// *
// Vault constants
//

export enum CHAINID {
  ETH_MAINNET = 1, // eslint-disable-line no-unused-vars
  ETH_KOVAN = 42, // eslint-disable-line no-unused-vars
  ARB_MAINNET = 42161,
  ARB_RINKEBY = 421611,
}

// Must be 1 day from current time
export const BLOCK_NUMBER = {
  [CHAINID.ETH_MAINNET]: 14087600,
};

export const NULL_ADDR = "0x0000000000000000000000000000000000000000";
export const PLACEHOLDER_ADDR = "0x0000000000000000000000000000000000000001";

/**
 * Assets
 */
export const WETH_ADDRESS = {
  [CHAINID.ETH_MAINNET]: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  [CHAINID.ETH_KOVAN]: "0xd0A1E359811322d97991E03f863a0C30C2cF029C",
  [CHAINID.ARB_MAINNET]: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
  [CHAINID.ARB_RINKEBY]: "0xEBbc3452Cc911591e4F18f3b36727Df45d6bd1f9",
};

export const WETH_NAME = "wETH";
export const WETH_DECIMALS = 18;

export const WBTC_ADDRESS = {
  [CHAINID.ETH_MAINNET]: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
  [CHAINID.ETH_KOVAN]: "0xA5eFEe8c0D466349da48eCe3Da9EdcbA0466aaCc", //NOTE: Unofficial, use only for deployment testing
  [CHAINID.ARB_MAINNET]: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
  [CHAINID.ARB_RINKEBY]: "0xEBbc3452Cc911591e4F18f3b36727Df45d6bd1f9",
};

export const WBTC_NAME = "wBTC";
export const WBTC_DECIMALS = 8;

// export const WBTC_OWNER_ADDRESS = {
//   [CHAINID.ETH_MAINNET]: "0xCA06411bd7a7296d7dbdd0050DFc846E95fEBEB7",
//   [CHAINID.ETH_KOVAN]: "0xb73B66F01cC89abD9D1Fa6396608E758f9319D8A", //NOTE: Unofficial, use only for deployment testing
// };

export const DAI_ADDRESS = {
  [CHAINID.ETH_MAINNET]: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
  [CHAINID.ETH_KOVAN]: "0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa",
  [CHAINID.ARB_MAINNET]: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
  [CHAINID.ARB_RINKEBY]: "0x2f3C1B6A51A469051A22986aA0dDF98466cc8D3c",
};

export const DAI_NAME = "DAI";
export const DAI_DECIMALS = 18;

// export const USDC_ADDRESS = {
//   [CHAINID.ETH_MAINNET]: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
//   [CHAINID.ETH_KOVAN]: "0x7e6edA50d1c833bE936492BF42C1BF376239E9e2",
// };

// export const USDC_OWNER_ADDRESS = {
//   [CHAINID.ETH_MAINNET]: "0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503",
//   [CHAINID.ETH_KOVAN]: "0xf668606B896389066a39B132741763e1ca6d76a2",
// };

// export const SUSHI_ADDRESS = {
//   [CHAINID.ETH_MAINNET]: "0x6B3595068778DD592e39A122f4f5a5cF09C90fE2",
// };

// export const SUSHI_OWNER_ADDRESS = {
//   [CHAINID.ETH_MAINNET]: "0xc2EdaD668740f1aA35E4D8f227fB8E17dcA888Cd",
// };

/**
 * Chainlink Oracles
 *
 * https://data.chain.link/
 * https://docs.chain.link/docs/avalanche-price-feeds
 */
export const ETH_PRICE_ORACLE = {
  [CHAINID.ETH_MAINNET]: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
  [CHAINID.ETH_KOVAN]: "0x9326BFA02ADD2366b30bacB125260Af641031331",
};

export const BTC_PRICE_ORACLE = {
  [CHAINID.ETH_MAINNET]: "0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c",
  [CHAINID.ETH_KOVAN]: "0x6135b13325bfC4B00278B4abC5e20bbce2D6580e",
};

export const USDC_PRICE_ORACLE = {
  [CHAINID.ETH_MAINNET]: "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6",
  [CHAINID.ETH_KOVAN]: "0x9211c6b3BF41A10F78539810Cf5c64e1BB78Ec60",
};

export const AAVE_PRICE_ORACLE = {
  [CHAINID.ETH_MAINNET]: "0x547a514d5e3769680Ce22B2361c10Ea13619e8a9",
  [CHAINID.ETH_KOVAN]: "0x9326BFA02ADD2366b30bacB125260Af641031331", //NOTE: Unofficial, use only for deployment testing
};

export const PERP_PRICE_ORACLE = {
  [CHAINID.ETH_MAINNET]: "0x01cE1210Fe8153500F60f7131d63239373D7E26C",
  [CHAINID.ETH_KOVAN]: "0x9326BFA02ADD2366b30bacB125260Af641031331", //NOTE: Unofficial, use only for deployment testing
};

/**
 * Gamma Pricers
 */
export const CHAINLINK_WETH_PRICER_STETH =
  "0x128cE9B4D97A6550905dE7d9Abc2b8C747b0996C";

export const CHAINLINK_WETH_PRICER = {
  [CHAINID.ETH_MAINNET]: "0x128cE9B4D97A6550905dE7d9Abc2b8C747b0996C",
};

export const CHAINLINK_WBTC_PRICER = {
  [CHAINID.ETH_MAINNET]: "0x32363cAB91EEaad10BFdd0b6Cd013CAF2595E85d",
};

export const CHAINLINK_SUSHI_PRICER = {
  [CHAINID.ETH_MAINNET]: "0xE81462E3A2dC9696F678FcCF3402ec135b5E6AB3",
};

export const CHAINLINK_PERP_PRICER = {
  [CHAINID.ETH_MAINNET]: "0x733171b59Ed3839481cd0066076De2C3404EE66A",
};

export const BYTES_ZERO =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

/**
 * Swap Pools
 */

export const ETH_USDC_POOL = {
  [CHAINID.ETH_MAINNET]: "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8", // NOTE: Uniswap v3 - USDC / ETH 0.3%
  [CHAINID.ETH_KOVAN]: "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8", // NOTE: Unofficial, use only for deployment testing
};

export const WBTC_USDC_POOL = {
  [CHAINID.ETH_MAINNET]: "0x99ac8ca7087fa4a2a1fb6357269965a2014abc35", // NOTE: Uniswap v3 - WBTC / ETH 0.3%
  [CHAINID.ETH_KOVAN]: "0x99ac8ca7087fa4a2a1fb6357269965a2014abc35", // NOTE: Unofficial, use only for deployment testing
};
