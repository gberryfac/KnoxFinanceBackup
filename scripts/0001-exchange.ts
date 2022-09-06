import { ethers, network } from "hardhat";

import { ExchangeHelper__factory } from "../types";

require("dotenv").config({ path: "../.env.prod" });

async function main() {
  const [deployer] = await ethers.getSigners();

  const exchange = await new ExchangeHelper__factory(deployer).deploy();
  await exchange.deployed();

  console.log(`-------------------------------------------------------------`);
  console.log(`ChainId: ${network.config.chainId}`);
  console.log(`-------------------------------------------------------------`);

  console.log(`Exchange Helper deployed @ ${exchange.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
