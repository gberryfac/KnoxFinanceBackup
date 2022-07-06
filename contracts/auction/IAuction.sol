// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./AuctionStorage.sol";

interface IAuction {
    function initialize(AuctionStorage.InitAuction memory initAuction) external;

    function lastPrice(uint64 epoch) external view returns (uint256);

    function priceCurve(uint64 epoch) external view returns (uint256);

    function clearingPrice(uint64 epoch) external view returns (uint256);

    function addLimitOrder(
        uint64 epoch,
        uint256 price,
        uint256 size
    ) external returns (uint256);

    function cancelLimitOrder(uint64 epoch, uint256 id) external returns (bool);

    function addOrder(uint64 epoch, uint256 size) external returns (uint256);

    function processOrders(uint64 epoch) external returns (bool);

    function finalizeAuction(uint64 epoch) external returns (bool);

    function transferPremium(uint64 epoch) external;

    function setLongTokenId(uint64 epoch, uint256 longTokenId) external;

    function processAuction(uint64 epoch) external;

    function withdraw(uint64 epoch) external;

    function isFinalized(uint64 epoch) external view returns (bool);

    function totalCollateralUsed(uint64 epoch) external view returns (uint256);

    function claimsByBuyer(address buyer)
        external
        view
        returns (uint64[] memory);
}
