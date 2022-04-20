// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "abdk-libraries-solidity/ABDKMath64x64.sol";

import "./interfaces/IKnoxToken.sol";
import "./interfaces/IPremiaPool.sol";
import "./interfaces/IVault.sol";

import "./libraries/Errors.sol";
import "./libraries/ShareMath.sol";

import "hardhat/console.sol";

contract PremiaThetaVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;
    using ABDKMath64x64 for int128;

    mapping(uint256 => uint256) public roundByLongTokenId;
    mapping(uint256 => Claim) public claims;

    uint256 public totalUnclaimed;

    uint256 private constant UNDERLYING_RESERVED_LIQ_TOKEN_ID =
        0x0200000000000000000000000000000000000000000000000000000000000000;
    uint256 private constant BASE_RESERVED_LIQ_TOKEN_ID =
        0x0300000000000000000000000000000000000000000000000000000000000000;

    address public token;

    // @notice role in charge of weekly vault operations such as rollover, no access to critical vault changes
    address public keeper;

    address public immutable pool;
    address public immutable weth;

    IVault internal Vault;

    struct Claim {
        uint256 longTokenId;
        uint256 amount;
        int128 pricePerShare;
    }

    constructor(
        address _token,
        address _keeper,
        address _pool,
        address _weth
    ) Ownable() ReentrancyGuard() {
        require(_token != address(0), Errors.ADDRESS_NOT_PROVIDED);
        require(_keeper != address(0), Errors.ADDRESS_NOT_PROVIDED);

        require(_pool != address(0), Errors.ADDRESS_NOT_PROVIDED);
        require(_weth != address(0), Errors.ADDRESS_NOT_PROVIDED);

        token = _token;
        keeper = _keeper;

        pool = _pool;
        weth = _weth;
    }

    /**
     * @notice Sets the new keeper
     * @param newKeeper is the address of the new keeper
     */
    function setNewKeeper(address newKeeper) external onlyOwner {
        require(newKeeper != address(0), Errors.ADDRESS_NOT_PROVIDED);
        keeper = newKeeper;
    }

    /**
     * @notice Sets the vault
     * @param vault is the address of the vault
     */
    function setVault(address vault) external onlyOwner {
        require(vault != address(0), Errors.ADDRESS_NOT_PROVIDED);
        Vault = IVault(vault);
    }

    // TODO: ADD INIT FUNCTION

    function purchase(
        bytes memory signature,
        uint64 deadline,
        uint64 maturity,
        int128 strike64x64,
        int128 premium64x64,
        uint256 contractSize,
        bool isCall
    ) external nonReentrant returns (uint256 longTokenId) {
        // TODO: PREVENT USERS FROM BUYING 48 HOURS PRIOR TO ROUND CLOSE

        address asset = Vault.asset();

        IERC20(asset).safeTransferFrom(
            msg.sender,
            address(Vault),
            premium64x64.mulu(contractSize)
        );

        uint256 liquidityRequired = Vault.borrow(
            signature,
            deadline,
            maturity,
            strike64x64,
            premium64x64,
            contractSize,
            isCall
        );

        IERC20(asset).approve(pool, liquidityRequired);

        (longTokenId, ) = IPremiaPool(pool).writeFrom(
            address(this),
            address(this),
            maturity,
            strike64x64,
            contractSize,
            isCall
        );

        IPremiaPool(pool).setDivestmentTimestamp(maturity, isCall);

        uint256 round = Vault.round();
        Claim memory _claim = claims[round];

        if (_claim.longTokenId == 0) {
            require(
                roundByLongTokenId[longTokenId] == 0,
                "LongTokenId used in previous round"
            );

            roundByLongTokenId[longTokenId] = round;

            _claim.pricePerShare = 0;
            _claim.longTokenId = longTokenId;

            claims[round] = _claim;
        }

        require(
            _claim.longTokenId == longTokenId,
            "token id does not match round token id"
        );

        IKnoxToken(token).mint(msg.sender, longTokenId, contractSize, "");
    }

    function claim(
        address account,
        uint256 longTokenId,
        uint256 shares
    ) external nonReentrant {
        uint256 round = roundByLongTokenId[longTokenId];
        Claim memory _claim = claims[round];

        uint256 amount = ABDKMath64x64.mulu(_claim.pricePerShare, shares);

        require(_claim.amount > 0, Errors.CLAIM_NOT_FOUND);
        require(amount <= _claim.amount, Errors.CLAIM_AMOUNT_EXCEEDS_BALANCE);

        _claim.amount -= amount;
        totalUnclaimed -= uint128(amount);

        claims[round] = _claim;

        IKnoxToken(token).burn(account, longTokenId, shares);

        IERC20(Vault.asset()).safeTransfer(account, amount);
    }

    function harvest() external nonReentrant {
        require(msg.sender == keeper, Errors.ADDRESS_NOT_KEEPER);

        require(
            block.timestamp >= Vault.expiry(),
            Errors.VAULT_ROUND_NOT_CLOSED
        );

        bool isCall = Vault.isCall();
        address asset = Vault.asset();

        uint256 balanceBefore = IERC20(asset).balanceOf(address(this));

        uint256 reservedLiquidity = IPremiaPool(pool).balanceOf(
            address(this),
            isCall
                ? UNDERLYING_RESERVED_LIQ_TOKEN_ID
                : BASE_RESERVED_LIQ_TOKEN_ID
        );

        IPremiaPool(pool).withdraw(reservedLiquidity, isCall);

        uint256 balanceAfter = IERC20(asset).balanceOf(address(this));

        uint256 transferToVault = balanceAfter - balanceBefore;

        IERC20(asset).safeTransferFrom(
            address(this),
            address(Vault),
            transferToVault
        );

        uint256 unclaimed = Vault.lockedCollateral() - transferToVault;

        if (unclaimed > 0) {
            totalUnclaimed += uint128(unclaimed);

            uint256 round = Vault.round();
            Claim memory _claim = claims[round];

            _claim.amount = unclaimed;
            _claim.pricePerShare = ABDKMath64x64.divu(
                unclaimed,
                IKnoxToken(token).totalSupply(_claim.longTokenId)
            );

            claims[round] = _claim;
        }

        Vault.harvest();
    }
}
