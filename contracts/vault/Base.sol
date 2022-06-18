// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@solidstate/contracts/token/ERC1155/IERC1155.sol";

import "./internal/BaseInternal.sol";

contract Base is BaseInternal {
    using SafeERC20 for IERC20;
    using Storage for Storage.Layout;

    constructor(bool isCall, address pool) BaseInternal(isCall, pool) {}
}

// TODO: Restructure files as Nick suggested
// TODO: Give each facet a storage contract, as needed
