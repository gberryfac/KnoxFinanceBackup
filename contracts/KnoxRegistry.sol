// SPDX-License-Identifier: MIT
pragma solidity =0.8.11;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract KnoxRegistry is EIP712, Ownable {
    /************************************************
     *  CONSTANTS
     ***********************************************/

    string public constant name = "Knox Registry";
    string public constant version = "v0.0.1";

    /************************************************
     *  STRUCTS
     ***********************************************/

    struct Transaction {
        uint64 deadline;
        uint64 strategyID;
        uint64 k1StrikePrice;
        uint64 k2StrikePrice;
        uint64 premium;
    }

    /************************************************
     *  CONSTRUCTOR
     ***********************************************/

    constructor() EIP712(name, version) {}

    /************************************************
     *  OPERATIONS
     ***********************************************/

    /**
     * @notice Authenticates the signature and transaction data provided by the signer
     * @param signature is an EIP-712 signed transaction generated off-chain by the signer
     * @param transaction is the metadata and trade parameters of the signature
     **/
    function isValidSignature(
        bytes memory signature,
        Transaction calldata transaction
    ) external view returns (bool) {
        require(
            block.timestamp < transaction.deadline,
            "Signature has expired"
        );

        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    keccak256(
                        "Transaction(uint64 deadline,uint64 strategyID,uint64 k1StrikePrice,uint64 k2StrikePrice,uint64 premium)"
                    ),
                    transaction.deadline,
                    transaction.strategyID,
                    transaction.k1StrikePrice,
                    transaction.k2StrikePrice,
                    transaction.premium
                )
            )
        );

        address signer = ECDSA.recover(digest, signature);
        require(signer != address(0) && signer == owner(), "Invalid signature");

        return true;
    }
}
