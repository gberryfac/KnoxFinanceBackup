// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@solidstate/contracts/token/ERC1155/IERC1155Receiver.sol";

import "../exchange/IExchangeHelper.sol";

import "./AuctionStorage.sol";
import "./IAuctionEvents.sol";

interface IAuction is IAuctionEvents, IERC1155Receiver {
    /************************************************
     *  ADMIN
     ***********************************************/

    /**
     * @notice sets a new Exchange Helper contract
     * @param newExchangeHelper is the new Exchange Helper contract address
     */
    function setExchangeHelper(address newExchangeHelper) external;

    /************************************************
     *  INITIALIZE AUCTION
     ***********************************************/

    /**
     * @notice initializes a new auction
     * @param initAuction auction parameters
     */
    function initialize(AuctionStorage.InitAuction memory initAuction) external;

    /**
     * @notice sets the auction max/min prices
     * @param epoch epoch id
     * @param maxPrice64x64 max price as 64x64 fixed point number
     * @param minPrice64x64 min price as 64x64 fixed point number
     */
    function setAuctionPrices(
        uint64 epoch,
        int128 maxPrice64x64,
        int128 minPrice64x64
    ) external;

    /************************************************
     *  PRICING
     ***********************************************/

    /**
     * @notice last price paid during the auction
     * @param epoch epoch id
     * @return price as 64x64 fixed point number
     */
    function lastPrice64x64(uint64 epoch) external view returns (int128);

    /**
     * @notice calculates price as a function of time
     * @param epoch epoch id
     * @return price as 64x64 fixed point number
     */
    function priceCurve64x64(uint64 epoch) external view returns (int128);

    /**
     * @notice clearing price of the auction
     * @param epoch epoch id
     * @return price as 64x64 fixed point number
     */
    function clearingPrice64x64(uint64 epoch) external view returns (int128);

    /************************************************
     *  PURCHASE
     ***********************************************/

    /**
     * @notice adds an order specified by the price and size
     * @dev sent ETH will be wrapped as wETH
     * @dev sender must approve contract
     * @param epoch epoch id
     * @param price64x64 max price as 64x64 fixed point number
     * @param size amount of contracts
     */
    function addLimitOrder(
        uint64 epoch,
        int128 price64x64,
        uint256 size
    ) external payable;

    /**
     * @notice swaps into the collateral asset and adds an order specified by the price and size
     * @dev sent ETH will be wrapped as wETH
     * @dev sender must approve contract
     * @param s swap arguments
     * @param epoch epoch id
     * @param price64x64 max price as 64x64 fixed point number
     * @param size amount of contracts
     */
    function swapAndAddLimitOrder(
        IExchangeHelper.SwapArgs calldata s,
        uint64 epoch,
        int128 price64x64,
        uint256 size
    ) external payable;

    /**
     * @notice cancels an order
     * @dev sender must approve contract
     * @param epoch epoch id
     * @param id order id
     */
    function cancelLimitOrder(uint64 epoch, uint256 id) external;

    /**
     * @notice adds an order specified by size only
     * @dev sent ETH will be wrapped as wETH
     * @dev sender must approve contract
     * @param epoch epoch id
     * @param size amount of contracts
     * @param maxCost max cost of buyer is willing to pay
     */
    function addMarketOrder(
        uint64 epoch,
        uint256 size,
        uint256 maxCost
    ) external payable;

    /**
     * @notice swaps into the collateral asset and adds an order specified by size only
     * @dev sent ETH will be wrapped as wETH
     * @dev sender must approve contract
     * @param s swap arguments
     * @param epoch epoch id
     * @param size amount of contracts
     * @param maxCost max cost of buyer is willing to pay
     */
    function swapAndAddMarketOrder(
        IExchangeHelper.SwapArgs calldata s,
        uint64 epoch,
        uint256 size,
        uint256 maxCost
    ) external payable;

    /************************************************
     *  WITHDRAW
     ***********************************************/

    /**
     * @notice removes any amount(s) owed to the buyer (fill and/or refund)
     * @param epoch epoch id
     */
    function withdraw(uint64 epoch) external;

    /**
     * @notice calculates amount(s) owed to the buyer
     * @param epoch epoch id
     * @return amount refunded
     * @return amount filled
     */
    function previewWithdraw(uint64 epoch) external returns (uint256, uint256);

    /**
     * @notice calculates amount(s) owed to the buyer
     * @param epoch epoch id
     * @param buyer address of buyer
     * @return amount refunded
     * @return amount filled
     */
    function previewWithdraw(uint64 epoch, address buyer)
        external
        returns (uint256, uint256);

    /************************************************
     *  FINALIZE AUCTION
     ***********************************************/

    /**
     * @notice checks various conditions to determine if auction is finalized
     * @param epoch epoch id
     */
    function finalizeAuction(uint64 epoch) external;

    /**
     * @notice transfers the premiums paid during auction to the vault
     * @param epoch epoch id
     * @return amount in premiums paid during auction
     */
    function transferPremium(uint64 epoch) external returns (uint256);

    /**
     * @notice checks various conditions to determine if auction is processed
     * @param epoch epoch id
     */
    function processAuction(uint64 epoch) external;

    /************************************************
     *  VIEW
     ***********************************************/

    /**
     * @notice displays the epochs the buyer has a fill and/or refund
     * @param buyer address of buyer
     * @return array of epoch ids
     */
    function epochsByBuyer(address buyer)
        external
        view
        returns (uint64[] memory);

    /**
     * @notice gets the auction parameters
     * @param epoch epoch id
     * @return auction parameters
     */
    function getAuction(uint64 epoch)
        external
        view
        returns (AuctionStorage.Auction memory);

    /**
     * @notice gets the minimum order size
     * @return minimum order size
     */
    function getMinSize() external view returns (uint256);

    /**
     * @notice gets the order from the auction orderbook
     * @param epoch epoch id
     * @param id order id
     * @return order from auction orderbook
     */
    function getOrderById(uint64 epoch, uint256 id)
        external
        view
        returns (OrderBook.Data memory);

    /**
     * @notice gets the status of the auction
     * @param epoch epoch id
     * @return auction status
     */
    function getStatus(uint64 epoch)
        external
        view
        returns (AuctionStorage.Status);

    /**
     * @notice gets the total number of contracts
     * @param epoch epoch id
     * @return total number of contracts
     */
    function getTotalContracts(uint64 epoch) external view returns (uint256);

    /**
     * @notice gets the total number of contracts sold during auction
     * @param epoch epoch id
     * @return total number of contracts sold
     */
    function getTotalContractsSold(uint64 epoch)
        external
        view
        returns (uint256);

    /**
     * @notice checks if the auction is finalized
     * @param epoch epoch id
     * @return true == finalized, false == not finalized
     */
    function isFinalized(uint64 epoch) external view returns (bool);
}
