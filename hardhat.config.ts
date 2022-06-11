import { HardhatUserConfig } from "hardhat/types";
import "hardhat-deploy";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "solidity-coverage";
import "hardhat-contract-sizer";
// import "hardhat-gas-reporter";
import "hardhat-tracer";
import "@primitivefi/hardhat-dodoc";

require("dotenv").config();

import { TEST_URI, BLOCK_NUMBER } from "./constants";

// Defaults to CHAINID=42161 so things will run with mainnet fork if not specified
const CHAINID = process.env.CHAINID ? Number(process.env.CHAINID) : 42161;

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.10",
        settings: {
          optimizer: {
            runs: 200,
            enabled: true,
          },
        },
      },
      {
        version: "0.8.6",
        settings: {
          optimizer: {
            runs: 200,
            enabled: true,
          },
        },
      },

      // WETH
      {
        version: "0.4.18",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
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
  namedAccounts: {
    deployer: {
      default: 0,
    },
    owner: {
      default: 0,
    },
    keeper: {
      default: 0,
    },
    admin: {
      default: 0,
    },
    feeRecipient: {
      default: 0,
    },
  },
  mocha: {
    timeout: 200000,
  },
  typechain: {
    outDir: "./types",
    target: "ethers-v5",
    alwaysGenerateOverloads: false,
  },
  dodoc: {
    runOnCompile: false,
    include: [
      "contracts/strategies/StandardDelta.sol",
      "contracts/strategies/StandardDeltaPricer.sol",
      "contracts/vaults/Vault.sol",
      "contracts/interfaces/IVault.sol",
      "contracts/interfaces/IStandardDeltaPricer.sol",
      "contracts/interfaces/IStandardDelta.sol",
    ],
  },
};

export default config;
