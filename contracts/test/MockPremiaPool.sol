// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@solidstate/contracts/introspection/ERC165Storage.sol";
import "@solidstate/contracts/token/ERC20/IERC20.sol";
import "@solidstate/contracts/token/ERC20/metadata/IERC20Metadata.sol";
import "@solidstate/contracts/token/ERC1155/base/ERC1155Base.sol";
import "@solidstate/contracts/token/ERC1155/enumerable/ERC1155Enumerable.sol";
import "@solidstate/contracts/utils/SafeERC20.sol";

import "../libraries/ABDKMath64x64Token.sol";
import "../libraries/Helpers.sol";

import "hardhat/console.sol";

contract MockPremiaPool is ERC1155Base, ERC1155Enumerable {
    using ABDKMath64x64 for int128;
    using ABDKMath64x64 for uint256;
    using ABDKMath64x64Token for int128;
    using ABDKMath64x64Token for uint256;
    using ERC165Storage for ERC165Storage.Layout;
    using SafeERC20 for IERC20;

    enum TokenType {
        UNDERLYING_FREE_LIQ,
        BASE_FREE_LIQ,
        UNDERLYING_RESERVED_LIQ,
        BASE_RESERVED_LIQ,
        LONG_CALL,
        SHORT_CALL,
        LONG_PUT,
        SHORT_PUT
    }

    struct PoolSettings {
        address underlying;
        address base;
        address underlyingOracle;
        address baseOracle;
    }

    PoolSettings settings;

    uint8 internal immutable baseDecimals;
    uint8 internal immutable underlyingDecimals;
    int128 internal spot64x64;

    constructor(
        address _underlying,
        address _base,
        address _underlyingOracle,
        address _baseOracle
    ) {
        settings.underlying = _underlying;
        settings.base = _base;
        settings.underlyingOracle = _underlyingOracle;
        settings.baseOracle = _baseOracle;

        baseDecimals = IERC20Metadata(settings.base).decimals();
        underlyingDecimals = IERC20Metadata(settings.underlying).decimals();
    }

    function mint(
        address account,
        uint256 tokenId,
        uint256 amount
    ) external {
        _mint(account, tokenId, amount, "");
    }

    function burn(
        address account,
        uint256 tokenId,
        uint256 amount
    ) external {
        _burn(account, tokenId, amount);
    }

    function getPoolSettings() external view returns (PoolSettings memory) {
        return settings;
    }

    function writeFrom(
        address underwriter,
        address longReceiver,
        uint64 maturity,
        int128 strike64x64,
        uint256 contractSize,
        bool isCall
    ) external payable returns (uint256 longTokenId, uint256 shortTokenId) {
        address asset = isCall ? settings.underlying : settings.base;

        uint256 amount =
            isCall
                ? contractSize
                : ABDKMath64x64Token.toBaseTokenAmount(
                    underlyingDecimals,
                    baseDecimals,
                    strike64x64.mulu(contractSize)
                );

        IERC20(asset).safeTransferFrom(underwriter, address(this), amount);

        TokenType longTokenType =
            isCall ? TokenType.LONG_CALL : TokenType.LONG_PUT;

        longTokenId = _formatTokenId(longTokenType, maturity, strike64x64);

        _mint(longReceiver, longTokenId, contractSize, "");

        TokenType shortTokenType =
            isCall ? TokenType.SHORT_CALL : TokenType.SHORT_PUT;

        shortTokenId = _formatTokenId(shortTokenType, maturity, strike64x64);

        _mint(underwriter, shortTokenId, contractSize, "");
    }

    function getPriceAfter64x64(uint256) external view returns (int128) {
        return spot64x64;
    }

    function withdraw(uint256 amount, bool isCallPool) external {}

    function setDivestmentTimestamp(uint64 timestamp, bool isCallPool)
        external
    {}

    function processExpired(uint256 longTokenId, uint256) external {
        address[] memory accounts = accountsByToken(longTokenId);

        for (uint256 i; i < accounts.length; i++) {
            uint256 balance = balanceOf(accounts[i], longTokenId);

            (TokenType tokenType, , int128 strike64x64) =
                _parseTokenId(longTokenId);

            bool isCall = tokenType == TokenType.LONG_CALL ? true : false;
            uint256 amount = _getExerciseAmount(isCall, strike64x64, balance);

            address asset = isCall ? settings.underlying : settings.base;

            // sends ERC20 to long holder
            IERC20(asset).safeTransfer(accounts[i], amount);
            // burns all ERC1155 tokens
            _burn(accounts[i], longTokenId, balance);
        }
    }

    /************************************************
     *  SETTERS
     ***********************************************/

    function setSpot64x64(int128 _spot64x64) external {
        spot64x64 = _spot64x64;
    }

    /************************************************
     *  HELPERS
     ***********************************************/

    function _formatTokenId(
        TokenType tokenType,
        uint64 maturity,
        int128 strike64x64
    ) internal pure returns (uint256 tokenId) {
        tokenId =
            (uint256(tokenType) << 248) +
            (uint256(maturity) << 128) +
            uint256(int256(strike64x64));
    }

    function _parseTokenId(uint256 tokenId)
        internal
        pure
        returns (
            TokenType tokenType,
            uint64 maturity,
            int128 strike64x64
        )
    {
        assembly {
            tokenType := shr(248, tokenId)
            maturity := shr(128, tokenId)
            strike64x64 := tokenId
        }
    }

    function _getExerciseAmount(
        bool isCall,
        int128 strike64x64,
        uint256 size
    ) internal view returns (uint256) {
        if (isCall && spot64x64 > strike64x64) {
            return spot64x64.sub(strike64x64).div(spot64x64).mulu(size);
        } else if (!isCall && strike64x64 > spot64x64) {
            uint256 value = strike64x64.sub(spot64x64).mulu(size);
            return
                ABDKMath64x64Token.toBaseTokenAmount(
                    underlyingDecimals,
                    baseDecimals,
                    value
                );
        }

        return 0;
    }

    // function _contractSizeToBaseTokenAmount(
    //     uint8 underlyingDecimals,
    //     uint8 baseDecimals,
    //     uint256 value
    // ) internal view returns (uint256) {
    //     int128 value64x64 = value.fromDecimals(underlyingDecimals);
    //     return value64x64.toDecimals(baseDecimals);
    // }

    /************************************************
     *  ERC165 SUPPORT
     ***********************************************/

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
