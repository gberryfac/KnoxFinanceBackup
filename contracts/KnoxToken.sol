// SPDX-License-Identifier: MIT
// Based on OpenZeppelin Contracts v4.4.1 (token/ERC1155/ERC1155.sol)

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/utils/introspection/ERC165Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";

import "./libraries/Errors.sol";

import "./interfaces/IKnoxToken.sol";

import "hardhat/console.sol";

contract KnoxToken is Initializable, ERC165Upgradeable, ERC1155Upgradeable {
    address public immutable vault;

    mapping(uint256 => uint256) private _totalSupply;

    constructor(address _vault) {
        vault = _vault;
    }

    function initialize(string memory _tokenName) external initializer {
        __Context_init();
        __ERC165_init();
        __ERC1155_init(_tokenName);
    }

    /**
     * @dev Only pool can call functions marked by this modifier.
     **/
    modifier onlyVault() {
        require(_msgSender() == address(vault), Errors.CALLER_MUST_BE_VAULT);
        _;
    }

    function mint(
        address to,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) external onlyVault {
        _mint(to, id, amount, data);
    }

    function burn(
        address from,
        uint256 id,
        uint256 amount
    ) external onlyVault {
        _burn(from, id, amount);
    }

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC1155Upgradeable, ERC165Upgradeable)
        returns (bool)
    {
        return
            interfaceId == type(IKnoxToken).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    /**
     * @dev Total amount of tokens in with a given id.
     */
    function totalSupply(uint256 id) public view returns (uint256) {
        return _totalSupply[id];
    }

    /**
     * @dev Indicates whether any token exist with a given id, or not.
     */
    function exists(uint256 id) public view returns (bool) {
        return this.totalSupply(id) > 0;
    }

    /**
     * @dev See {ERC1155-_beforeTokenTransfer}.
     */
    function _beforeTokenTransfer(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) internal virtual override {
        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);

        if (from == address(0)) {
            for (uint256 i = 0; i < ids.length; ++i) {
                _totalSupply[ids[i]] += amounts[i];
            }
        }

        if (to == address(0)) {
            for (uint256 i = 0; i < ids.length; ++i) {
                _totalSupply[ids[i]] -= amounts[i];
            }
        }
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}
