// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "hardhat/console.sol";

contract Vault is ERC20 {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    address public controller;
    IERC20 public immutable baseToken;

    uint256 constant EPOCH_SPAN_IN_SECONDS = 7 * 24 * 3600 - 7200;

    mapping(address => Receipt) public deposits;
    mapping(address => Receipt) public withholding;

    Epoch public epoch;
    Epoch[] public epochs;

    struct Receipt {
        uint256 amount;
        uint256 epochIndex;
    }

    struct Epoch {
        uint256 index;
        uint256 expiry;
        uint256 withholding;
    }

    constructor(
        string memory _name,
        string memory _symbol,
        address _baseToken,
        address _controller,
        uint256 _expiry
    ) ERC20(_name, _symbol) {
        baseToken = IERC20(_baseToken);
        controller = _controller;
        epoch = Epoch({index: 0, expiry: _expiry, withholding: 0});
    }

    function deposit(uint256 _amount) public {
        Receipt memory receipt = deposits[msg.sender];

        if (receipt.epochIndex == epoch.index) {
            receipt.amount += _amount;
        } else {
            receipt.amount = _amount;
            receipt.epochIndex = epoch.index;
        }

        deposits[msg.sender] = receipt;

        uint256 epochBalanceBeforeDeposit = epochBalance();
        baseToken.safeTransferFrom(msg.sender, address(this), _amount);

        uint256 epochBalanceAfterDeposit = epochBalance();
        _amount = epochBalanceAfterDeposit.sub(epochBalanceBeforeDeposit);

        uint256 shares;
        if (totalSupply() == 0) {
            shares = _amount;
        } else {
            shares = getShares(_amount, epochBalanceBeforeDeposit);
        }

        _mint(msg.sender, shares);
    }

    /* @dev this function should only be called if a deposit was made within the same epoch */
    function instantWithdraw(uint256 _shares) public {
        Receipt memory receipt = deposits[msg.sender];

        require(
            balanceOf(msg.sender) >= _shares,
            "vault/insufficient-lp-token-balance"
        );

        // if the receipt.epochIndex != epoch.index, the users funds have already been rolled into the current epoch.
        require(
            receipt.epochIndex == epoch.index,
            "vault/instant-withdraw-failed"
        );

        uint256 _amount = getAmount(_shares);

        if (receipt.amount >= _amount) {
            receipt.amount -= _amount;
        } else {
            // user can only instantly withdraw the amount deposited within the same epoch.
            _amount = receipt.amount;
            _shares = getShares(_amount, epochBalance());
        }

        deposits[msg.sender] = receipt;

        _burn(msg.sender, _shares);

        baseToken.safeTransfer(msg.sender, _amount);
    }

    function initiateWithdraw(uint256 _shares) public {
        require(
            balanceOf(msg.sender) >= _shares,
            "vault/insufficient-lp-token-balance"
        );

        uint256 _amount = getAmount(_shares);

        _burn(msg.sender, _shares);

        Receipt memory receipt = withholding[msg.sender];
        receipt.amount += _amount;
        receipt.epochIndex = epoch.index;

        withholding[msg.sender] = receipt;

        epoch.withholding += _amount;
    }

    function withdraw() public {
        Receipt memory receipt = withholding[msg.sender];
        uint256 _amount = receipt.amount;

        // if the receipt.epochIndex != epoch.index, the users has not submitted a
        // withdrawal within the current epoch.
        require(
            receipt.epochIndex < epoch.index && _amount > 0,
            "vault/withdraw-not-initiated"
        );

        baseToken.safeTransfer(msg.sender, _amount);

        receipt.amount = 0;
        withholding[msg.sender] = receipt;

        epoch.withholding -= _amount;
    }

    function rollover() public {
        require(epoch.expiry < block.timestamp, "vault/epoch-has-not-expired");

        Epoch memory prevEpoch = epoch;
        epochs.push(prevEpoch);

        // check if Controller has settled positions before calculating epoch balance.

        epoch = Epoch({
            index: prevEpoch.index + 1,
            expiry: prevEpoch.expiry + EPOCH_SPAN_IN_SECONDS,
            withholding: prevEpoch.withholding
        });
    }

    function borrow(uint256 amount) external {
        // check if msg.sender if approved to borrow
        baseToken.safeTransfer(msg.sender, amount);
    }

    // /* transfers lp tokens to different account and adjusts the deposit/ withdrawal balances */
    // funciton transfer() public {
    // }

    function epochBalance() public view returns (uint256) {
        // Controller should repay all debts prior to this being called.
        // Keep track of funds borrowed.
        return baseToken.balanceOf(address(this)).sub(epoch.withholding);
    }

    function getPricePerFullShare() public view returns (uint256) {
        if (epochBalance() == 0) {
            return 0;
        }

        if (totalSupply() == 0) {
            return 1e18;
        }

        return epochBalance().mul(1e18).div(totalSupply());
    }

    function getShares(uint256 amount, uint256 _epochBalance)
        public
        view
        returns (uint256)
    {
        return (amount.mul(totalSupply())).div(_epochBalance);
    }

    function getAmount(uint256 shares) public view returns (uint256) {
        return epochBalance().mul(shares).div(totalSupply());
    }

    function getCurrentDepositReceipt(address account)
        public
        view
        returns (uint256, uint256)
    {
        Receipt memory receipt = deposits[account];

        if (receipt.epochIndex == epoch.index) {
            return (receipt.amount, receipt.epochIndex);
        }

        return (0, epoch.index);
    }

    function getCurrentWithholdingReceipt(address account)
        public
        view
        returns (uint256, uint256)
    {
        Receipt memory receipt = withholding[account];

        if (receipt.epochIndex == epoch.index) {
            return (receipt.amount, receipt.epochIndex);
        }

        return (0, epoch.index);
    }
}
