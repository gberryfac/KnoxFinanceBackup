// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Registry is EIP712, Ownable {
    /************************************************
     *  CONSTANTS
     ***********************************************/

    string public constant name = "Knox Registry";
    string public constant version = "v0.0.1";

    /************************************************
     *  CONSTRUCTOR
     ***********************************************/

    constructor() EIP712(name, version) {}

    /************************************************
     *  OPERATIONS
     ***********************************************/

    /**
     * @notice Authenticates the signature and transaction data provided by the signer
     * @param signature is an EIP-712 signature
     * @param transaction is the metadata and trade parameters of the signature
     **/
    function authenticate(
        bytes memory signature,
        uint256 deadline,
        uint256 maturity,
        uint256 strikePrices,
        uint256 spotPrice,
        uint256 premium,
        bool isCall
    ) external view returns (bool) {
        require(
            block.timestamp < transaction.deadline,
            "Signature has expired"
        );

        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    keccak256(
                        "Transaction(address controller, uint256 deadline, uint256 maturity, uint256[] strikePrices, uint256 spotPrice, uint256 premium, bool isCall)"
                    ),
                    msg.sender,
                    deadline,
                    maturity,
                    strikePrices,
                    spotPrice,
                    premium,
                    isCall
                )
            )
        );

        address signer = ECDSA.recover(digest, signature);
        require(signer != address(0) && signer == owner(), "Invalid signature");

        return true;
    }
}
