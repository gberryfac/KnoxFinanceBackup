import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "solidity-coverage";
import "hardhat-contract-sizer";

import { BLOCK_NUMBER } from "./constants/constants";
import { TEST_URI } from "./scripts/helpers/getDefaultEthersProvider";

require("dotenv").config();

// Defaults to CHAINID=1 so things will run with mainnet fork if not specified
const CHAINID = process.env.CHAINID ? Number(process.env.CHAINID) : 1;

export default {
  solidity: {
    version: "0.8.4",
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
      chainId: CHAINID,
      forking: {
        url: TEST_URI[CHAINID],
        blockNumber: BLOCK_NUMBER[CHAINID],
        gasLimit: 8e6,
      },
    },
    mainnet: {
      url: process.env.TEST_URI,
      chainId: CHAINID,
      accounts: {
        mnemonic: process.env.MAINNET_MNEMONIC,
      },
    },
  },
  mocha: {
    timeout: 500000,
  },
  typechain: {
    outDir: "./types",
    target: "ethers-v5",
    alwaysGenerateOverloads: false,
  },
};
