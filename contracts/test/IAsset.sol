// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./../interfaces/IWETH.sol";

interface IAsset is IWETH {
    /**
     * @dev Function to mint tokens
     * @param _to The address that will receive the minted tokens.
     * @param _amount The amount of tokens to mint.
     * @return A boolean that indicates if the operation was successful.
     */
    function mint(address _to, uint256 _amount) external returns (bool);
}

