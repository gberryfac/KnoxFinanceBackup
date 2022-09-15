// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@solidstate/contracts/introspection/ERC165Storage.sol";
import "@solidstate/contracts/token/ERC1155/base/ERC1155Base.sol";
import "@solidstate/contracts/token/ERC1155/enumerable/ERC1155Enumerable.sol";
import "@solidstate/contracts/utils/ReentrancyGuard.sol";

import "./IQueue.sol";
import "./QueueInternal.sol";

/**
 * @title Knox Queue Contract
 * @dev deployed standalone and referenced by QueueProxy
 */

contract Queue is
    ERC1155Base,
    ERC1155Enumerable,
    IQueue,
    QueueInternal,
    ReentrancyGuard
{
    using ERC165Storage for ERC165Storage.Layout;
    using QueueStorage for QueueStorage.Layout;
    using SafeERC20 for IERC20;
    using SafeERC20 for IWETH;

    constructor(
        bool isCall,
        address pool,
        address vault,
        address weth
    ) QueueInternal(isCall, pool, vault, weth) {}

    /************************************************
     *  SAFETY
     ***********************************************/

    /**
     * @notice pauses the vault during an emergency preventing deposits and borrowing.
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice unpauses the vault during following an emergency allowing deposits and borrowing.
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /************************************************
     *  ADMIN
     ***********************************************/

    /**
     * @inheritdoc IQueue
     */
    function setMaxTVL(uint256 newMaxTVL) external onlyOwner {
        QueueStorage.Layout storage l = QueueStorage.layout();
        require(newMaxTVL > 0, "value exceeds minimum");
        emit MaxTVLSet(l.epoch, l.maxTVL, newMaxTVL, msg.sender);
        l.maxTVL = newMaxTVL;
    }

    /**
     * @inheritdoc IQueue
     */
    function setExchangeHelper(address newExchangeHelper) external onlyOwner {
        QueueStorage.Layout storage l = QueueStorage.layout();
        require(newExchangeHelper != address(0), "address not provided");
        require(
            newExchangeHelper != address(l.Exchange),
            "new address equals old"
        );

        emit ExchangeHelperSet(
            address(l.Exchange),
            newExchangeHelper,
            msg.sender
        );

        l.Exchange = IExchangeHelper(newExchangeHelper);
    }

    /************************************************
     *  DEPOSIT
     ***********************************************/

    /**
     * @inheritdoc IQueue
     */
    function deposit(uint256 amount)
        external
        payable
        nonReentrant
        whenNotPaused
    {
        QueueStorage.Layout storage l = QueueStorage.layout();
        uint256 credited = _wrapNativeToken(amount);
        // an approve() by the msg.sender is required beforehand
        ERC20.safeTransferFrom(msg.sender, address(this), amount - credited);
        _deposit(l, amount);
    }

    /**
     * @inheritdoc IQueue
     */
    function swapAndDeposit(IExchangeHelper.SwapArgs calldata s)
        external
        payable
        nonReentrant
        whenNotPaused
    {
        QueueStorage.Layout storage l = QueueStorage.layout();
        uint256 credited = _swapForPoolTokens(l.Exchange, s, address(ERC20));
        _deposit(l, credited);
    }

    /************************************************
     *  CANCEL
     ***********************************************/

    /**
     * @inheritdoc IQueue
     */
    function cancel(uint256 amount) external nonReentrant {
        uint256 currentTokenId = QueueStorage._getCurrentTokenId();
        // burns the callers claim token
        _burn(msg.sender, currentTokenId, amount);
        // refunds the callers deposit
        ERC20.safeTransfer(msg.sender, amount);
        uint64 epoch = QueueStorage._getEpoch();
        emit Cancel(epoch, msg.sender, amount);
    }

    /************************************************
     *  REDEEM
     ***********************************************/

    /**
     * @inheritdoc IQueue
     */
    function redeem(uint256 tokenId) external nonReentrant {
        _redeem(tokenId, msg.sender, msg.sender);
    }

    /**
     * @inheritdoc IQueue
     */
    function redeem(uint256 tokenId, address receiver) external nonReentrant {
        _redeem(tokenId, receiver, msg.sender);
    }

    /**
     * @inheritdoc IQueue
     */
    function redeem(
        uint256 tokenId,
        address receiver,
        address owner
    ) external nonReentrant {
        require(
            owner == msg.sender || isApprovedForAll(owner, msg.sender),
            "ERC1155: caller is not owner nor approved"
        );

        _redeem(tokenId, receiver, owner);
    }

    /**
     * @inheritdoc IQueue
     */
    function redeemMax() external nonReentrant {
        _redeemMax(msg.sender, msg.sender);
    }

    function redeemMax(address receiver) external nonReentrant {
        _redeemMax(receiver, msg.sender);
    }

    /**
     * @inheritdoc IQueue
     */
    function redeemMax(address receiver, address owner) external nonReentrant {
        require(
            owner == msg.sender || isApprovedForAll(owner, msg.sender),
            "ERC1155: caller is not owner nor approved"
        );

        _redeemMax(receiver, owner);
    }

    /************************************************
     *  INITIALIZE NEXT EPOCH
     ***********************************************/

    /**
     * @inheritdoc IQueue
     */
    function syncEpoch(uint64 epoch) external onlyVault {
        QueueStorage.Layout storage l = QueueStorage.layout();
        l.epoch = epoch;
        emit EpochSet(l.epoch, msg.sender);
    }

    /**
     * @inheritdoc IQueue
     */
    function processDeposits() external onlyVault {
        uint256 deposits = ERC20.balanceOf(address(this));
        ERC20.approve(address(Vault), deposits);
        // the queue deposits their entire balance into the vault at the end of each epoch
        uint256 shares = Vault.deposit(deposits, address(this));

        // the shares returned by the vault represent a pro-rata share of the vault tokens. these
        // shares are used to calculate a price-per-share based on the supply of claim tokens for
        // that epoch. the price-per-share is used as an exchange rate of claim tokens to vault
        // shares when a user withdraws or redeems.
        uint256 currentTokenId = QueueStorage._getCurrentTokenId();
        uint256 claimTokenSupply = _totalSupply(currentTokenId);
        uint256 pricePerShare = ONE_SHARE;

        if (shares <= 0) {
            pricePerShare = 0;
        } else if (claimTokenSupply > 0) {
            pricePerShare = (pricePerShare * shares) / claimTokenSupply;
        }

        QueueStorage.Layout storage l = QueueStorage.layout();
        // the price-per-share can be queried if the claim token id is provided
        l.pricePerShare[currentTokenId] = pricePerShare;

        emit ProcessQueuedDeposits(
            l.epoch,
            deposits,
            pricePerShare,
            shares,
            claimTokenSupply
        );
    }

    /************************************************
     *  VIEW
     ***********************************************/

    /**
     * @inheritdoc IQueue
     */
    function getCurrentTokenId() external view returns (uint256) {
        return QueueStorage._getCurrentTokenId();
    }

    /**
     * @inheritdoc IQueue
     */
    function getEpoch() external view returns (uint64) {
        return QueueStorage._getEpoch();
    }

    /**
     * @inheritdoc IQueue
     */
    function getMaxTVL() external view returns (uint256) {
        return QueueStorage._getMaxTVL();
    }

    /**
     * @inheritdoc IQueue
     */
    function getPricePerShare(uint256 tokenId) external view returns (uint256) {
        return QueueStorage._getPricePerShare(tokenId);
    }

    /**
     * @inheritdoc IQueue
     */
    function previewUnredeemed(uint256 tokenId)
        external
        view
        returns (uint256)
    {
        return _previewUnredeemed(tokenId, msg.sender);
    }

    /**
     * @inheritdoc IQueue
     */
    function previewUnredeemed(uint256 tokenId, address account)
        external
        view
        returns (uint256)
    {
        return _previewUnredeemed(tokenId, account);
    }

    /************************************************
     *  DEPOSIT HELPERS
     ***********************************************/

    /**
     * @notice wraps ETH sent to the contract and credits the amount, if the collateral asset
     * is not WETH, the transaction will revert
     * @param amount total collateral deposited
     * @return credited amount
     */
    function _wrapNativeToken(uint256 amount) private returns (uint256) {
        uint256 credit;

        if (msg.value > 0) {
            require(address(ERC20) == address(WETH), "collateral != wETH");

            if (msg.value > amount) {
                // if the ETH amount is greater than the amount needed, it will be sent
                // back to the msg.sender
                unchecked {
                    (bool success, ) =
                        payable(msg.sender).call{value: msg.value - amount}("");

                    require(success, "ETH refund failed");

                    credit = amount;
                }
            } else {
                credit = msg.value;
            }

            WETH.deposit{value: credit}();
        }

        return credit;
    }

    /**
     * @notice pull token from user, send to exchangeHelper trigger a trade from
     * ExchangeHelper, and credits the amount
     * @param Exchange ExchangeHelper contract interface
     * @param s swap arguments
     * @param tokenOut token to swap for. should always equal to the collateral asset
     * @return credited amount
     */
    function _swapForPoolTokens(
        IExchangeHelper Exchange,
        IExchangeHelper.SwapArgs calldata s,
        address tokenOut
    ) private returns (uint256) {
        if (msg.value > 0) {
            require(s.tokenIn == address(WETH), "tokenIn != wETH");
            WETH.deposit{value: msg.value}();
            WETH.safeTransfer(address(Exchange), msg.value);
        }

        if (s.amountInMax > 0) {
            IERC20(s.tokenIn).safeTransferFrom(
                msg.sender,
                address(Exchange),
                s.amountInMax
            );
        }

        uint256 amountCredited =
            Exchange.swapWithToken(
                s.tokenIn,
                tokenOut,
                s.amountInMax + msg.value,
                s.callee,
                s.allowanceTarget,
                s.data,
                s.refundAddress
            );

        require(
            amountCredited >= s.amountOutMin,
            "not enough output from trade"
        );

        return amountCredited;
    }

    /************************************************
     * HELPERS
     ***********************************************/

    /**
     * @inheritdoc IQueue
     */
    function formatClaimTokenId(uint64 epoch) external view returns (uint256) {
        return QueueStorage._formatClaimTokenId(epoch);
    }

    /**
     * @inheritdoc IQueue
     */
    function parseClaimTokenId(uint256 tokenId)
        external
        pure
        returns (address, uint64)
    {
        return QueueStorage._parseClaimTokenId(tokenId);
    }

    /************************************************
     *  ERC165 SUPPORT
     ***********************************************/

    /**
     * @inheritdoc IERC165
     */
    function supportsInterface(bytes4 interfaceId)
        external
        view
        returns (bool)
    {
        return ERC165Storage.layout().isSupportedInterface(interfaceId);
    }

    /************************************************
     *  ERC1155 OVERRIDES
     ***********************************************/

    /**
     * @notice ERC1155 hook, called before all transfers including mint and burn
     * @dev function should be overridden and new implementation must call super
     * @dev called for both single and batch transfers
     * @param operator executor of transfer
     * @param from sender of tokens
     * @param to receiver of tokens
     * @param ids token IDs
     * @param amounts quantities of tokens to transfer
     * @param data data payload
     */
    function _beforeTokenTransfer(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    )
        internal
        virtual
        override(QueueInternal, ERC1155BaseInternal, ERC1155EnumerableInternal)
    {
        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
    }
}
