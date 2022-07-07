// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./AuctionStorage.sol";

interface IAuction {
    function initialize(AuctionStorage.InitAuction memory initAuction) external;

    function setAuctionPrices(
        uint64 epoch,
        int128 maxPrice64x64,
        int128 minPrice64x64
    ) external;

    function lastPrice(uint64 epoch) external view returns (int128);

    function priceCurve(uint64 epoch) external view returns (int128);

    function clearingPrice(uint64 epoch) external view returns (int128);

    function addLimitOrder(
        uint64 epoch,
        int128 price64x64,
        uint256 size
    ) external returns (uint256);

    function cancelLimitOrder(uint64 epoch, uint256 id) external;

    function addOrder(uint64 epoch, uint256 size) external returns (uint256);

    function processOrders(uint64 epoch) external returns (bool);

    function finalizeAuction(uint64 epoch) external returns (bool);

    function transferPremium(uint64 epoch) external;

    function setLongTokenId(uint64 epoch, uint256 longTokenId) external;

    function processAuction(uint64 epoch) external;

    function withdraw(uint64 epoch) external;

    function isFinalized(uint64 epoch) external view returns (bool);

    function status(uint64 epoch) external view returns (AuctionStorage.Status);

    function totalCollateralUsed(uint64 epoch) external view returns (uint256);

    function claimsByBuyer(address buyer)
        external
        view
        returns (uint64[] memory);

    function getAuction(uint64 epoch)
        external
        view
        returns (AuctionStorage.Auction memory);
}
