// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@solidstate/contracts/access/ownable/OwnableInternal.sol";
import "@solidstate/contracts/security/PausableInternal.sol";
import "@solidstate/contracts/token/ERC20/IERC20.sol";
import "@solidstate/contracts/token/ERC1155/base/ERC1155BaseInternal.sol";
import "@solidstate/contracts/token/ERC1155/enumerable/ERC1155EnumerableInternal.sol";
import "@solidstate/contracts/utils/IWETH.sol";
import "@solidstate/contracts/utils/SafeERC20.sol";

import "../interfaces/IPremiaPool.sol";

import "../vault/IVault.sol";

import "./IQueueEvents.sol";
import "./QueueStorage.sol";

contract QueueInternal is
    ERC1155BaseInternal,
    ERC1155EnumerableInternal,
    IQueueEvents,
    OwnableInternal,
    PausableInternal
{
    using QueueStorage for QueueStorage.Layout;
    using SafeERC20 for IERC20;

    uint256 internal constant ONE_SHARE = 10**18;

    IERC20 public immutable ERC20;
    IVault public immutable Vault;
    IWETH public immutable WETH;

    constructor(
        bool isCall,
        address pool,
        address vault,
        address weth
    ) {
        IPremiaPool.PoolSettings memory settings =
            IPremiaPool(pool).getPoolSettings();
        address asset = isCall ? settings.underlying : settings.base;

        ERC20 = IERC20(asset);
        Vault = IVault(vault);
        WETH = IWETH(weth);
    }

    /************************************************
     *  ACCESS CONTROL
     ***********************************************/

    /**
     * @dev Throws if called by any account other than the vault.
     */
    modifier onlyVault() {
        QueueStorage.Layout storage l = QueueStorage.layout();
        require(msg.sender == address(Vault), "!vault");
        _;
    }

    /************************************************
     *  ADMIN
     ***********************************************/

    /**
     * @notice sets a new max TVL for deposits
     * @param newMaxTVL is the new TVL limit for deposits
     */
    function _setMaxTVL(uint256 newMaxTVL) internal {
        QueueStorage.Layout storage l = QueueStorage.layout();
        require(newMaxTVL > 0, "value exceeds minimum");
        l.maxTVL = newMaxTVL;
        emit MaxTVLSet(l.epoch, l.maxTVL, newMaxTVL, msg.sender);
    }

    /**
     * @notice sets a new Exchange Helper contract
     * @param newExchangeHelper is the new Exchange Helper contract address
     */
    function _setExchangeHelper(address newExchangeHelper) internal {
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
     * @notice deposits collateral asset
     * @param amount total collateral deposited
     * @param receiver claim token recipient
     */
    function _deposit(uint256 amount, address receiver) internal {
        QueueStorage.Layout storage l = QueueStorage.layout();
        uint256 credited = _wrapNativeToken(amount);
        // an approve() by the msg.sender is required beforehand
        ERC20.safeTransferFrom(receiver, address(this), amount - credited);
        _deposit(l, amount, receiver);
    }

    /**
     * @notice swaps into the collateral asset and deposits the proceeds
     * @param s exchange arguments
     * @param receiver claim token recipient
     */
    function _swapAndDeposit(
        IExchangeHelper.SwapArgs calldata s,
        address receiver
    ) internal {
        QueueStorage.Layout storage l = QueueStorage.layout();
        uint256 credited = _swapForPoolTokens(l.Exchange, s, address(ERC20));
        _deposit(l, credited, receiver);
    }

    function _deposit(
        QueueStorage.Layout storage l,
        uint256 amount,
        address receiver
    ) private {
        uint256 totalWithDepositedAmount =
            Vault.totalAssets() + ERC20.balanceOf(address(this));

        require(totalWithDepositedAmount <= l.maxTVL, "maxTVL exceeded");
        require(amount > 0, "value exceeds minimum");

        // redeems shares from previous epochs
        _redeemMax(receiver, msg.sender);

        uint256 currentTokenId = QueueStorage._getCurrentTokenId();
        _mint(receiver, currentTokenId, amount, "");

        emit Deposit(l.epoch, receiver, msg.sender, amount);
    }

    /************************************************
     *  CANCEL
     ***********************************************/

    /**
     * @notice cancels deposit, refunds collateral asset
     * @dev cancellation must be made within the same epoch as the deposit
     * @param amount total collateral which will be withdrawn
     */
    function _cancel(uint256 amount) internal {
        uint256 currentTokenId = QueueStorage._getCurrentTokenId();
        _burn(msg.sender, currentTokenId, amount);
        ERC20.safeTransfer(msg.sender, amount);

        uint64 epoch = QueueStorage._getEpoch();
        emit Cancel(epoch, msg.sender, amount);
    }

    /************************************************
     *  REDEEM
     ***********************************************/

    /**
     * @notice exchanges claim token for vault shares
     * @param tokenId claim token id
     * @param receiver vault share recipient
     * @param owner claim token holder
     */
    function _redeem(
        uint256 tokenId,
        address receiver,
        address owner
    ) internal {
        uint256 currentTokenId = QueueStorage._getCurrentTokenId();

        require(
            tokenId != currentTokenId,
            "current claim token cannot be redeemed"
        );

        uint256 balance = _balanceOf(owner, tokenId);

        uint256 unredeemedShares = _previewUnredeemed(tokenId, owner);

        _burn(owner, tokenId, balance);
        require(Vault.transfer(receiver, unredeemedShares), "transfer failed");

        uint64 epoch = QueueStorage._getEpoch();
        emit Redeem(epoch, receiver, owner, unredeemedShares);
    }

    /**
     * @notice exchanges all claim tokens for vault shares
     * @param receiver vault share recipient
     * @param owner claim token holder
     */
    function _redeemMax(address receiver, address owner) internal {
        uint256[] memory tokenIds = _tokensByAccount(owner);
        uint256 currentTokenId = QueueStorage._getCurrentTokenId();

        for (uint256 i; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            if (tokenId != currentTokenId) {
                _redeem(tokenId, receiver, owner);
            }
        }
    }

    /************************************************
     *  PROCESS LAST EPOCH
     ***********************************************/

    /**
     * @notice syncs queue epoch with vault epoch
     * @param epoch current epoch of vault
     */
    function _syncEpoch(uint64 epoch) internal {
        QueueStorage.Layout storage l = QueueStorage.layout();
        l.epoch = epoch;
        emit EpochSet(l.epoch, msg.sender);
    }

    /**
     * @notice transfers deposited collateral to vault, calculates the price per share
     */
    function _processDeposits() internal {
        uint256 deposits = ERC20.balanceOf(address(this));

        ERC20.approve(address(Vault), deposits);
        uint256 shares = Vault.deposit(deposits, address(this));

        uint256 currentTokenId = QueueStorage._getCurrentTokenId();
        uint256 claimTokenSupply = _totalSupply(currentTokenId);
        uint256 pricePerShare = ONE_SHARE;

        if (shares == 0) {
            pricePerShare = 0;
        } else if (claimTokenSupply > 0) {
            pricePerShare = (pricePerShare * shares) / claimTokenSupply;
        }

        QueueStorage.Layout storage l = QueueStorage.layout();
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
     * @notice calculates unredeemed vault shares available
     * @param tokenId claim token id
     * @param account claim token holder
     * @return total unredeemed vault shares
     */
    function _previewUnredeemed(uint256 tokenId, address account)
        internal
        view
        returns (uint256)
    {
        QueueStorage.Layout storage l = QueueStorage.layout();
        uint256 balance = _balanceOf(account, tokenId);
        return (balance * l.pricePerShare[tokenId]) / ONE_SHARE;
    }

    /************************************************
     *  DEPOSIT HELPERS
     ***********************************************/

    function _wrapNativeToken(uint256 amount) private returns (uint256) {
        uint256 credit;

        if (msg.value > 0) {
            require(
                address(ERC20) == address(WETH),
                "collateral token != wETH"
            );

            if (msg.value > amount) {
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

    function _swapForPoolTokens(
        IExchangeHelper Exchange,
        IExchangeHelper.SwapArgs calldata s,
        address tokenOut
    ) private returns (uint256) {
        if (msg.value > 0) {
            require(s.tokenIn == address(WETH), "tokenIn != wETH");
            WETH.deposit{value: msg.value}();
            WETH.transfer(address(Exchange), msg.value);
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
     *  ERC1155 OVERRIDES
     ***********************************************/

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
        override(ERC1155BaseInternal, ERC1155EnumerableInternal)
    {
        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
    }
}
