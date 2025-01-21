// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

contract assamDomain is ERC721URIStorage, Ownable {
    using Strings for uint256;
    
    uint256 public nextTokenId;
    uint256 public registrationFee = 20 * 10**18;  // Price 20 Tea Tokens
    string public constant DOMAIN_EXTENSION = ".assam";
    
    mapping(string => bool) public domainExists;
    mapping(uint256 => string) public tokenIdToDomain;

    constructor(address initialOwner) ERC721("assamDomain", "ASDN") Ownable(initialOwner) {}

    function setRegistrationFee(uint256 _fee) external onlyOwner {
        registrationFee = _fee;
    }

    function registerDomain(string memory username) external payable {
        string memory domainName = string(abi.encodePacked(username, DOMAIN_EXTENSION));
        require(!domainExists[domainName], "Domain already registered.");
        require(bytes(username).length > 0, "Username cannot be empty.");
        require(msg.value >= registrationFee, "Not enough Tea Tokens sent.");

        (bool success, ) = payable(owner()).call{value: msg.value}("");
        require(success, "Transfer to owner failed");

        uint256 tokenId = nextTokenId++;
        _safeMint(msg.sender, tokenId);
        tokenIdToDomain[tokenId] = domainName;

        string memory metadata = generateMetadata(domainName);
        _setTokenURI(tokenId, metadata);
        domainExists[domainName] = true;
    }

    function generateMetadata(string memory domainName) internal pure returns (string memory) {
        string memory svgImage = string(
            abi.encodePacked(
                '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300">',
                '<rect width="300" height="300" fill="white" stroke="black"/>',
                '<text x="150" y="150" dominant-baseline="middle" text-anchor="middle" font-size="30" fill="black">',
                domainName,
                '</text></svg>'
            )
        );

        string memory imageData = string(
            abi.encodePacked(
                "data:image/svg+xml;base64,",
                Base64.encode(bytes(svgImage))
            )
        );

        string memory json = string(
            abi.encodePacked(
                '{"name": "',
                domainName,
                '", "description": "Identity Domain NFT on tea-assam", "image": "',
                imageData,
                '"}'
            )
        );

        return string(
            abi.encodePacked(
                "data:application/json;base64,",
                Base64.encode(bytes(json))
            )
        );
    }

    function withdrawAmount(uint256 _amount) external onlyOwner {
        require(_amount <= address(this).balance, "Insufficient contract balance");
        (bool success, ) = payable(owner()).call{value: _amount}("");
        require(success, "Withdrawal failed");
    }

    function withdrawAll() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance to withdraw");
        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "Withdrawal failed");
    }

    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    receive() external payable {}
    
    fallback() external payable {}
}