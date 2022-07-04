// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./internal/BaseInternal.sol";

contract View is BaseInternal {
    using Storage for Storage.Layout;

    constructor(bool isCall, address pool) BaseInternal(isCall, pool) {}

    function epoch() external view returns (uint64) {
        return Storage._epoch();
    }

    function optionByEpoch(uint64 epoch)
        external
        view
        returns (Storage.Option memory)
    {
        return Storage._optionByEpoch(epoch);
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
