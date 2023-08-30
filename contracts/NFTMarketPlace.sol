// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

error NFTMarketPlace__PriceMustBeAboveZero();
error NFTMarketPlace__NFTNotApprovedForMarketPlace();
error NFTMarketPlace__NFTAlreadyMinted(address NFTContractAddress,uint256 TokenId);
error NFTMarketPlace__NotOwner();
error NFTMarketPlace__NotListed(address NFTContractAddress,uint256 tokenId);
error NFTMarketPlace__PriceNotMet(address NFTContractAddress,uint256 tokenId,uint256 price);
error NFTMarketPlace__NoProceeds();
error NFTMarketPlace__TransferFailed();

contract NFTMarketPlace is ReentrancyGuard{

    struct Listing {
        uint256 PriceNFT;
        address seller;
    }

    // events ---------->
    event ItemListing(address indexed seller,address indexed NFTContractAddress,uint256 tokenId,uint256 price);

    event ItemBought(address indexed buyer,address indexed NFTContractAddress,uint256 indexed tokenId,uint256 price);

    event ItemCancelled(address indexed seller, address indexed NFTContractAddress, uint256 indexed tokenId);
    
    //STATE VARIABLES -------->

    // NFT contract address -> TokenId -> Listing Info 
    mapping(address => mapping(uint256 => Listing)) private s_Listings;

    // Seller address to amount earned
    mapping(address => uint256) private s_proceeds;

    // MODIFIERS ---------->
    modifier notListed(address NFTContractAddress, uint256 TokenId, address owner) {
        Listing memory listed = s_Listings[NFTContractAddress][TokenId];

        if (listed.PriceNFT > 0) {
            revert NFTMarketPlace__NFTAlreadyMinted(NFTContractAddress,TokenId);
        } 
        _;
    }

    modifier isOwner(address NFTContractAddress,uint256 tokenId, address spender) {
        IERC721 nft = IERC721(NFTContractAddress);
        address owner = nft.ownerOf(tokenId);

        if (spender != owner) {
            revert NFTMarketPlace__NotOwner();
        }
        _;
    }

    modifier isListed(address NFTContractAddress, uint256 tokenId) {
        Listing memory listing = s_Listings[NFTContractAddress][tokenId];
        if (listing.PriceNFT <= 0) {
            revert NFTMarketPlace__NotListed(NFTContractAddress,tokenId);
        }
        _;
    }


    // MAIN FUNCTIONS  -------------------->

    /**
     * @notice A function to list the NFTs
     * @param NFTContractAddress address of the NFT Contract
     * @param tokenId the tokenId of the NFT
     * @param price the sale price of the NFT to be listed
     * @dev We could have an escrow contract but I choose this way bcoz the people could still
     * be holding their nfts until bought by the buyer 
     */ 
    function ListItem(address NFTContractAddress, uint256 tokenId, uint256 price) external 
    notListed(NFTContractAddress, tokenId, msg.sender) 
    isOwner(NFTContractAddress,tokenId,msg.sender) {
        if (price <= 0) {
            revert NFTMarketPlace__PriceMustBeAboveZero();
        }
        // Owners can still hold their nfts, while giving the marketplace the approval to sell the NFT

        IERC721 nft = IERC721(NFTContractAddress);

        if (nft.getApproved(tokenId) != address(this)) {
            revert NFTMarketPlace__NFTNotApprovedForMarketPlace();
        }

        s_Listings[NFTContractAddress][tokenId] = Listing(price,msg.sender);

        emit ItemListing(msg.sender,NFTContractAddress,tokenId,price);
    }

    /** 
     * @notice Method for buying listing
     * @notice The owner of an NFT could unapprove the marketplace,
     * which would cause this function to fail
     * Ideally you'd also have a `createOffer` functionality.
     * @param NFTContractAddress Address of NFT contract
     * @param tokenId Token ID of NFT
     */
    function BuyItem(address NFTContractAddress,uint256 tokenId) 
    isListed(NFTContractAddress, tokenId) 
    nonReentrant external payable{
        Listing memory listingItem = s_Listings[NFTContractAddress][tokenId];

        if (msg.value < listingItem.PriceNFT) {
            revert NFTMarketPlace__PriceNotMet(NFTContractAddress,tokenId,listingItem.PriceNFT);
        }

        unchecked {
            s_proceeds[listingItem.seller] += msg.value;
        }

        delete (s_Listings[NFTContractAddress][tokenId]);

        /*
         * To prevent Re-entrancy its always better to make external contract calls or tranfer 
           funds at the end of the functions so even if the external contract is malicious it 
           cannot attack bcoz the state has already been changed 
         * Using the openzeppelin Re-entrancy Guard   
        */

        IERC721(NFTContractAddress).safeTransferFrom(listingItem.seller, msg.sender, tokenId, "");
    
        emit ItemBought(msg.sender,NFTContractAddress,tokenId,listingItem.PriceNFT);
    }

     /* 
     * @notice Method for cancelling listing
     * @param nftAddress Address of NFT contract
     * @param tokenId Token ID of NFT
     */
    function CancelListing(address NFTContractAddress,uint256 tokenId) 
    isOwner(NFTContractAddress, tokenId, msg.sender) 
    isListed(NFTContractAddress, tokenId) external {
        delete (s_Listings[NFTContractAddress][tokenId]);

        emit ItemCancelled(msg.sender,NFTContractAddress, tokenId);
    }

    /*
     * @notice Method for updating listing
     * @param NFTContractAddress Address of NFT contract
     * @param tokenId Token ID of NFT
     * @param newPrice Price in Wei of the item
     */
    function UpdateListing(address NFTContractAddress, uint256 tokenId, uint256 newPrice) 
    isListed(NFTContractAddress, tokenId)  
    isOwner(NFTContractAddress,tokenId,msg.sender) external {
        s_Listings[NFTContractAddress][tokenId].PriceNFT = newPrice;

        emit ItemListing(msg.sender, NFTContractAddress, tokenId, newPrice);
    } 


    /*
     * @notice Method for withdrawing proceeds from sales
     */
    function Withdraw() external {
        uint256 balance = s_proceeds[msg.sender];

        if (balance <= 0) {
            revert  NFTMarketPlace__NoProceeds();
        }

        s_proceeds[msg.sender] = 0;

        (bool success, ) = msg.sender.call{value : balance}("");
        if (!success) {
            revert NFTMarketPlace__TransferFailed();
        }
    }


    // GETTER FUNCTIONS -------------------->
    function getListing(address NFTContractAddress, uint256 tokenId) external view returns(Listing memory) {
        return s_Listings[NFTContractAddress][tokenId];
    }

    function getProceeds(address seller) external view returns(uint256) {
        return s_proceeds[seller];
    }

    function getBalance() public view returns(uint256) {
        return address(this).balance;
    }
}