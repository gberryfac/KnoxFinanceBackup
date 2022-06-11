import { HardhatUserConfig } from "hardhat/types";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@primitivefi/hardhat-dodoc";
import "@typechain/hardhat";
import "hardhat-contract-sizer";
import "hardhat-gas-reporter";
import "hardhat-tracer";
import "solidity-coverage";

require("dotenv").config();

import { TEST_URI, BLOCK_NUMBER } from "./constants";

let { MAINNET_URI, DODOC_ON_COMPILE, REPORT_GAS, SIZER_ON_COMPILE } =
  process.env;

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
      chainId: CHAINID,
      forking: {
        url: TEST_URI[CHAINID],
        blockNumber: BLOCK_NUMBER[CHAINID],
      },
    },
    mainnet: {
      url: MAINNET_URI,
      chainId: CHAINID,
    },
  },
  mocha: {
    timeout: 60000,
  },
  typechain: {
    outDir: "./types",
    target: "ethers-v5",
    alwaysGenerateOverloads: true,
  },
  dodoc: {
    runOnCompile: DODOC_ON_COMPILE === "true",
    include: [
      "contracts/interfaces/IVault.sol",
      "contracts/interfaces/IStandardDelta.sol",
      "contracts/interfaces/IStandardDeltaPricer.sol",
      "contracts/strategies/StandardDelta.sol",
      "contracts/strategies/StandardDeltaPricer.sol",
      "contracts/vaults/Vault.sol",
    ],
  },
  gasReporter: {
    enabled: REPORT_GAS === "true",
  },
  contractSizer: {
    runOnCompile: SIZER_ON_COMPILE === "true",
  },
};

export default config;
