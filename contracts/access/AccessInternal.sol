// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@solidstate/contracts/access/ownable/OwnableInternal.sol";
import "@solidstate/contracts/security/PausableInternal.sol";

import "./AccessStorage.sol";

contract AccessInternal is OwnableInternal, PausableInternal {}
