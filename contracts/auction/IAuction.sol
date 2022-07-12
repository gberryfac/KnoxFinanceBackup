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

    function lastPrice64x64(uint64 epoch) external view returns (int128);

    function priceCurve64x64(uint64 epoch) external view returns (int128);

    function clearingPrice64x64(uint64 epoch) external view returns (int128);

    function addLimitOrder(
        uint64 epoch,
        int128 price64x64,
        uint256 size
    ) external;

    function cancelLimitOrder(uint64 epoch, uint256 id) external;

    function addMarketOrder(uint64 epoch, uint256 size) external;

    function processOrders(uint64 epoch) external returns (bool);

    function finalizeAuction(uint64 epoch) external returns (bool);

    function transferPremium(uint64 epoch) external;

    function processAuction(uint64 epoch) external;

    function withdraw(uint64 epoch) external;

    function previewWithdraw(uint64 epoch) external returns (uint256, uint256);

    function isFinalized(uint64 epoch) external view returns (bool);

    function status(uint64 epoch) external view returns (AuctionStorage.Status);

    function totalContractsSold(uint64 epoch) external view returns (uint256);

    function claimsByBuyer(address buyer)
        external
        view
        returns (uint64[] memory);

    function getAuction(uint64 epoch)
        external
        view
        returns (AuctionStorage.Auction memory);
}
