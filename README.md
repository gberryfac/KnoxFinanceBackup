[![Twitter Follow](https://img.shields.io/badge/Twitter-black?logo=twitter&logoColor=white)](https://twitter.com/knox_finance)
[![Discord](https://img.shields.io/badge/Discord-black?logo=discord&logoColor=white)](https://discord.gg/azPNJXQ4kR)
[![tests](https://github.com/KnoxFinance/knox-contracts/actions/workflows/test.yaml/badge.svg)](https://codecov.io/gh/KnoxFinance/knox-contracts)
[![Lint](https://github.com/KnoxFinance/knox-contracts/workflows/Lint/badge.svg)](https://github.com/KnoxFinance/knox-contracts/actions/workflows/lint.yaml)
[![codecov](https://codecov.io/gh/KnoxFinance/knox-contracts/branch/master/graph/badge.svg?token=ZI3OV5TSAV)](https://codecov.io/gh/KnoxFinance/knox-contracts)

# Knox Finance

Create a `.env` file with the following values defined:

| Key                    | Description                                                   |
| ---------------------- | ------------------------------------------------------------- |
| `CHAINID`              | sets the default chain id                                     |
| `MAINNET_URI`          | API key Mainnet node                                          |
| `ARBITRUM_URI`         | API key Arbitrum node                                         |
| `MAINNET_GOERLI_URI`   | API key Mainnet Goerli node                                   |
| `ARBITRUM_RINKEBY_URI` | API key Arbitrum Rinkeby node                                 |
| `DODOC_ON_COMPILE`     | if `true`, docs will be generated on every compilation        |
| `REPORT_GAS`           | if `true`, a gas report will be generated after running tests |
| `SIZER_ON_COMPILE`     | if `true`, contract sizes will be output on every compilation |

## Development

Install dependencies via npm:

```bash
npm install
```

Setup Husky to format code on commit:

```bash
npm run prepare
```

## Testing

Generate typechain typings:

```bash
npx hardhat typechain
```

Compile contracts:

```bash
npx hardhat compile
```

Run the test suite:

```bash
npx hardhat test
```

Activate gas usage reporting by setting the `REPORT_GAS` environment variable to `"true"`:

```bash
REPORT_GAS=true npx hardhat test
```

Generate a code coverage report using `solidity-coverage`:

```bash
npx hardhat coverage
```
