// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@solidstate/contracts/utils/ReentrancyGuard.sol";

import "./AccessInternal.sol";

contract Access is AccessInternal, ReentrancyGuard {
    /************************************************
     *  SAFETY
     ***********************************************/

    /**
     * @notice Pauses the vault during an emergency preventing deposits and borrowing.
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpauses the vault during following an emergency allowing deposits and borrowing.
     */
    function unpause() external onlyOwner {
        _unpause();
    }
}
