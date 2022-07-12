// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../auction/OrderBook.sol";

contract TestOrderBook {
    using OrderBook for OrderBook.Index;

    OrderBook.Index index;

    function head() external view returns (uint256) {
        return index._head();
    }

    function length() external view returns (uint256) {
        return index._length();
    }

    function getOrder(uint256 id)
        external
        view
        returns (
            uint256,
            uint256,
            uint256,
            address
        )
    {
        return index._getOrder(id);
    }

    function getPreviousOrder(uint256 id) external view returns (uint256) {
        return index._getPreviousOrder(id);
    }

    function getNextOrder(uint256 id) external view returns (uint256) {
        return index._getNextOrder(id);
    }

    function insert(
        uint256 price,
        uint256 amount,
        address buyer
    ) external returns (uint256) {
        return index._insert(price, amount, buyer);
    }

    function remove(uint256 id) external returns (bool) {
        return index._remove(id);
    }
}
