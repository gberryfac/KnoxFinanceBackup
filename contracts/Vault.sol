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

    uint256 constant WEEK_SPAN = 7 * 24 * 3600 - 7200;

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
        uint256 balance;
        uint256 withholding;
        uint256 pricePerFullShare;
    }

    event DepositorSynced(address depositor, int32 epoch);
    event FundsDeposited(address depositor, uint256 amount, int32 epochNumber);

    constructor(
        string memory _name,
        string memory _symbol,
        address _baseToken,
        address _controller,
        uint256 _startTimestamp
    ) ERC20(_name, _symbol) {
        baseToken = IERC20(_baseToken);
        controller = _controller;
        epoch = Epoch({
            index: 0,
            expiry: _startTimestamp,
            balance: 0,
            withholding: 0,
            pricePerFullShare: 0
        });
    }

    function epochBalance() public view returns (uint256) {
        // Controller should repay all debts prior to this being called.
        return baseToken.balanceOf(address(this)).sub(epoch.withholding);
    }

    function getPricePerFullShare() public view returns (uint256) {
        if (epoch.balance == 0) {
            return 0;
        }

        if (totalSupply() == 0) {
            return 1e18;
        }

        return epoch.balance.mul(1e18).div(totalSupply());
    }

    function getShares(uint256 amount) public view returns (uint256) {
        return (amount.mul(totalSupply())).div(epochBalance());
    }

    function getAmount(uint256 shares) public view returns (uint256) {
        return epochBalance().mul(shares).div(totalSupply());
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

        baseToken.safeTransferFrom(msg.sender, address(this), _amount);

        uint256 shares;
        if (totalSupply() == 0 || epoch.balance == 0) {
            shares = _amount;
        } else {
            shares = getShares(_amount);
        }

        console.log("deposit - shares:", shares);

        _mint(msg.sender, shares);
    }

    /* @dev this function should only be called if a deposit was made within the same epoch */
    function instantWithdraw(uint256 _shares) public {
        Receipt memory receipt = deposits[msg.sender];

        console.log("inst withdraw - shares:", _shares);

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
            console.log("receipt.amount:", receipt.amount);
            console.log("Amount:", _amount);
            receipt.amount -= _amount;
        } else {
            // user can only instantly withdraw the amount deposited within the same epoch.
            _amount = receipt.amount;
            _shares = getShares(_amount);
        }

        deposits[msg.sender] = receipt;

        _burn(msg.sender, _shares);

        console.log("Amount Sent:", _amount);
        baseToken.safeTransfer(msg.sender, _amount);
    }

    function initiateWithdrawAll() public {
        initiateWithdraw(balanceOf(msg.sender));
    }

    function initiateWithdraw(uint256 _shares) public {
        require(
            balanceOf(msg.sender) >= _shares,
            "vault/insufficient-lp-token-balance"
        );

        uint256 _amount = epochBalance().mul(_shares).div(totalSupply());

        // console.log("PPFS:", getPricePerFullShare());
        // console.log("shares:", _shares);
        // console.log("epochBalance():", epochBalance());
        // console.log("epoch.balance:", epoch.balance);
        // console.log("totalSupply:", totalSupply());
        // console.log("amount:", _amount);

        _burn(msg.sender, _shares);

        Receipt memory receipt = withholding[msg.sender];
        receipt.amount += _amount;
        withholding[msg.sender] = receipt;

        epoch.withholding += _amount;
    }

    function claim() public {
        Receipt memory receipt = withholding[msg.sender];

        uint256 _amount = receipt.amount;

        // if the receipt.epochIndex != epoch.index, the users has not submitted a
        // withdrawal within the current epoch.
        require(
            receipt.epochIndex == epoch.index && _amount > 0,
            "vault/claim-not-found"
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
            index: epoch.index + 1,
            expiry: epoch.expiry + WEEK_SPAN,
            balance: epochBalance(),
            withholding: 0,
            pricePerFullShare: getPricePerFullShare()
        });
    }

    // /* transfers lp tokens to different account and adjusts the deposit/ withdrawal balances */
    //     funciton transfer() public {

    //     }
}
