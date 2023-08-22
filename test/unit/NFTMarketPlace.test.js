const { assert, expect } = require("chai")
const { network, deployments, ethers, getNamedAccounts } = require("hardhat")
const { developmentChains } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Nft Marketplace Tests", () => { 
        let NFTMarketPlace;
        let BasicNft;
        let deployer;
        let player;
        const price = ethers.utils.parseEther("0.1");
        const TokenId = 0;
        beforeEach(async () => {
            deployer = (await getNamedAccounts()).deployer;
            const accounts = await ethers.getSigners();
            player = accounts[1];
            await deployments.fixture(["all"]);
            NFTMarketPlace = await ethers.getContract("NFTMarketPlace");
            BasicNft = await ethers.getContract("BasicNft");
        });

        describe("Listing function", () => {
            it("Fails if the item is already listed", async () => {
                await BasicNft.mintNft();
                await BasicNft.approve(NFTMarketPlace.address, TokenId);
                await NFTMarketPlace.ListItem(BasicNft.address, TokenId, price);
                await expect(
                    NFTMarketPlace.ListItem(
                        BasicNft.address,
                        TokenId,
                        price
                    )
                ).to.be.revertedWith("NFTMarketPlace__NFTAlreadyMinted");
            });

            it("Fails if the listee is not the owner", async () => {
                await BasicNft.mintNft();
                await BasicNft.approve(NFTMarketPlace.address, TokenId);
                const accounts = await ethers.getSigners();
                await expect(
                    NFTMarketPlace.connect(player)
                        .ListItem(BasicNft.address, TokenId, price)
                ).to.be.revertedWith("NFTMarketPlace__NotOwner")
            });

            it("Reverts if the mint is free", async () => {
                await BasicNft.mintNft();
                await BasicNft.approve(NFTMarketPlace.address, TokenId);
                await expect(
                    NFTMarketPlace.ListItem(
                        BasicNft.address,
                        TokenId,
                        "0"
                    )
                ).to.be.revertedWith("NFTMarketPlace__PriceMustBeAboveZero");
            });

            it("Fails to list if the MarketPlace has not been aprroved", async () => {
                await BasicNft.mintNft();
                await expect(
                    NFTMarketPlace.ListItem(BasicNft.address, TokenId, price)
                ).to.be.revertedWith(
                    "NFTMarketPlace__NFTNotApprovedForMarketPlace"
                );
            });

            it("Lists the Nft", async () => {
                await BasicNft.mintNft();
                await BasicNft.approve(NFTMarketPlace.address, TokenId);
                assert(await NFTMarketPlace.ListItem(BasicNft.address, TokenId, price));
            });

            it("It updates the storage variable", async () => {
                await BasicNft.mintNft();
                await BasicNft.approve(NFTMarketPlace.address, TokenId);
                await NFTMarketPlace.ListItem(BasicNft.address, TokenId, price);

                const Listing = await NFTMarketPlace.getListing(BasicNft.address, TokenId);
                assert.equal(Listing.PriceNFT.toString(), price);
                assert.equal(Listing.seller, deployer);
            });

            it("Emits an Event when an item is listed ", async () => {
                await BasicNft.mintNft();
                await BasicNft.approve(NFTMarketPlace.address, TokenId);
                const trx = await NFTMarketPlace.ListItem(
                    BasicNft.address,
                    TokenId,
                    price
                );
                const trxRecipt = await trx.wait();

                const tokenId = await trxRecipt.events[0].args[2];
                const Price = await trxRecipt.events[0].args[3];
                const sender = await trxRecipt.events[0].args[0];

                assert.equal(tokenId.toString(), "0");
                assert.equal(Price.toString(), price);
                assert.equal(sender, deployer);
            });
        });

        describe("BuyItem function ", async () => {
            it("The item not listed cant be bought", async () => {
                await BasicNft.mintNft();
                await BasicNft.approve(NFTMarketPlace.address, TokenId);
                await NFTMarketPlace.ListItem(BasicNft.address, TokenId, price);
                await expect(
                    NFTMarketPlace.BuyItem(BasicNft.address, 1)
                ).to.be.revertedWith("NFTMarketPlace__NotListed");
            });
            
            it("Fails when enough ether isnt sent", async () => {
                await BasicNft.mintNft();
                await BasicNft.approve(NFTMarketPlace.address, TokenId);
                await NFTMarketPlace.ListItem(BasicNft.address, TokenId, price);
                await expect(
                    NFTMarketPlace.BuyItem(BasicNft.address, TokenId)
                ).to.be.revertedWith("NFTMarketPlace__PriceNotMet");
            });

            it("The Nft is bought", async () => {
                await BasicNft.mintNft();
                await BasicNft.approve(NFTMarketPlace.address, TokenId);
                await NFTMarketPlace.ListItem(BasicNft.address, TokenId, price);
                assert(
                    await NFTMarketPlace.connect(player).BuyItem(
                        BasicNft.address,
                        TokenId,
                        { value: price }
                    )
                );
            });

            it("Checks if the Nft is transfered", async () => {
                await BasicNft.mintNft();
                await BasicNft.approve(NFTMarketPlace.address, TokenId);
                await NFTMarketPlace.ListItem(BasicNft.address, TokenId, price);
                await NFTMarketPlace.connect(player).BuyItem(
                    BasicNft.address,
                    TokenId,
                    { value: price }
                );
                assert.equal(await BasicNft.ownerOf(0), player.address);
            });

            it("emits an event when bought", async () => {
                await BasicNft.mintNft();
                await BasicNft.approve(NFTMarketPlace.address, TokenId);
                await NFTMarketPlace.ListItem(BasicNft.address, TokenId, price);
                const trx = await NFTMarketPlace.connect(player).BuyItem(
                    BasicNft.address,
                    TokenId,
                    { value: price }
                );
                const trxRecipt = await trx.wait(1);
                const seller = await trxRecipt.events[1].args[0];
                const contractAddress = await trxRecipt.events[1].args.NFTContractAddress;

                assert.equal(seller.toString(), player.address);
                assert.equal(contractAddress, BasicNft.address);
            });

            it("checks if the proceeds are added to the mapping", async () => {
                await BasicNft.mintNft();
                await BasicNft.approve(NFTMarketPlace.address, TokenId);
                await NFTMarketPlace.ListItem(BasicNft.address, TokenId, price);
                await NFTMarketPlace.connect(player).BuyItem(
                    BasicNft.address,
                    TokenId,
                    { value: price }
                );
                const proceed = await NFTMarketPlace.getProceeds(player.address)
                assert(proceed.toString(), price);
            });

            it("resets the listing mapping", async () => {
                await BasicNft.mintNft();
                await BasicNft.approve(NFTMarketPlace.address, TokenId);
                await NFTMarketPlace.ListItem(BasicNft.address, TokenId, price);
                await NFTMarketPlace.connect(player).BuyItem(
                    BasicNft.address,
                    TokenId,
                    { value: price }
                );
                const update = await NFTMarketPlace.getListing(NFTMarketPlace.address, TokenId);
                assert.equal(update.PriceNFT.toString(), "0");
            });
        });

        describe("Cancel Listing", () => {
            it("Only allows the owner to Cancel the listing", async () => {
                await BasicNft.mintNft();
                await BasicNft.approve(NFTMarketPlace.address, TokenId);
                await NFTMarketPlace.ListItem(BasicNft.address, TokenId, price);
                await expect(
                    NFTMarketPlace.connect(player).CancelListing(
                        BasicNft.address,
                        TokenId
                    )
                ).to.be.revertedWith("NFTMarketPlace__NotOwner");
            });

            it("Only allows a listed NFT to be cancelled", async () => {
                await BasicNft.mintNft();
                await BasicNft.approve(NFTMarketPlace.address, TokenId);
                await NFTMarketPlace.ListItem(BasicNft.address, TokenId, price);
                await expect(
                  NFTMarketPlace.CancelListing(BasicNft.address, "1")
                ).to.be.revertedWith("ERC721: invalid token ID");
            })
        })
    });