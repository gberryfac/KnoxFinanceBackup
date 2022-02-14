import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "hardhat-deploy";

require("dotenv").config();

// Defaults to CHAINID=42 so things will run with Arbitrum fork unless specified
const CHAINID = process.env.CHAINID ? Number(process.env.CHAINID) : 42;

export default {
  solidity: {
    version: "0.8.10",
    settings: {
      optimizer: {
        runs: 200,
        enabled: true,
      },
    },
  },
  networks: {
    hardhat: {
      accounts: {
        mnemonic: process.env.TEST_MNEMONIC,
      },
      mainnet: {
        url: process.env.TEST_URI,
        chainId: CHAINID,
        accounts: {
          mnemonic: process.env.MAINNET_MNEMONIC,
        },
      },
      kovan: {
        url: process.env.KOVAN_URI,
        accounts: {
          mnemonic: process.env.KOVAN_MNEMONIC,
        },
      },
      arbitrum: {
        url: process.env.ARBITRUM_URI,
        accounts: {
          mnemonic: process.env.ARBITRUM_MNEMONIC,
        },
      },
      arbitrum_rinkeby: {
        url: process.env.ARBITRUM_RINKEBY_URI,
        accounts: {
          mnemonic: process.env.ARBITRUM_RINKEBY_MNEMONIC,
        },
      },
    },
  },
  mocha: {
    timeout: 500000,
  },
};
