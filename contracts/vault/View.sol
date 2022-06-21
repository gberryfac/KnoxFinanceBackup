// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./internal/BaseInternal.sol";

contract View is BaseInternal {
    using Storage for Storage.Layout;

    constructor(bool isCall, address pool) BaseInternal(isCall, pool) {}

    function totalDeposits() external view returns (uint256) {
        return Storage._totalDeposits();
    }

    function epoch() external view returns (uint256) {
        return Storage._epoch();
    }

    function pricePerShare(uint256 epoch) external view returns (uint256) {
        return Storage._pricePerShare(epoch);
    }

    function option()
        external
        view
        returns (
            bool,
            uint256,
            uint256
        )
    {
        return Storage._option();
    }

    function accountsByOption(uint256 id)
        external
        view
        returns (address[] memory)
    {
        return Pool.accountsByToken(id);
    }

    function optionsByAccount(address account)
        external
        view
        returns (uint256[] memory)
    {
        return Pool.tokensByAccount(account);
    }
}
