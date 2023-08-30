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
            beforeEach(async () => {
                await BasicNft.mintNft();
                await BasicNft.approve(NFTMarketPlace.address, TokenId);
                await NFTMarketPlace.ListItem(BasicNft.address, TokenId, price);
            })
            it("The item not listed cant be bought", async () => {
                await expect(
                    NFTMarketPlace.BuyItem(BasicNft.address, 1)
                ).to.be.revertedWith("NFTMarketPlace__NotListed");
            });
            
            it("Fails when enough ether isnt sent", async () => {
                await expect(
                    NFTMarketPlace.BuyItem(BasicNft.address, TokenId)
                ).to.be.revertedWith("NFTMarketPlace__PriceNotMet");
            });

            it("The Nft is bought", async () => {
                assert(
                    await NFTMarketPlace.connect(player).BuyItem(
                        BasicNft.address,
                        TokenId,
                        { value: price }
                    )
                );
            });

            it("Checks if the Nft is transfered", async () => {
                await NFTMarketPlace.connect(player).BuyItem(
                    BasicNft.address,
                    TokenId,
                    { value: price }
                );
                assert.equal(await BasicNft.ownerOf(0), player.address);
            });

            it("emits an event when bought", async () => {
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
                await NFTMarketPlace.connect(player).BuyItem(
                    BasicNft.address,
                    TokenId,
                    { value: price }
                );
                const proceed = await NFTMarketPlace.getProceeds(player.address)
                assert(proceed.toString(), price);
            });

            it("resets the listing mapping", async () => {
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
            beforeEach(async () => {
                await BasicNft.mintNft();
                await BasicNft.approve(NFTMarketPlace.address, TokenId);
                await NFTMarketPlace.ListItem(BasicNft.address, TokenId, price);
            });
            it("Only allows the owner to Cancel the listing", async () => {
                await expect(
                    NFTMarketPlace.connect(player).CancelListing(
                        BasicNft.address,
                        TokenId
                    )
                ).to.be.revertedWith("NFTMarketPlace__NotOwner");
            });

            it("Only allows a listed NFT to be cancelled", async () => {
                await expect(
                    NFTMarketPlace.CancelListing(BasicNft.address, "1")
                ).to.be.revertedWith("ERC721: invalid token ID");
            });

            it("emits an event after the listing is cancelled", async () => {
                await expect(
                    await NFTMarketPlace.CancelListing(BasicNft.address, "0")
                ).to.emit(NFTMarketPlace, "ItemCancelled");
            });

            it("verify the emited events", async () => {
                const trx = await NFTMarketPlace.CancelListing(
                  BasicNft.address,
                  "0"
                );
                const trxRecipt = await trx.wait(1);
                const msgAddress = await trxRecipt.events[0].args[0];
                const NFTContractAddress = await trxRecipt.logs[0].topics[2];
                const tokenId = await trxRecipt.events[0].args.tokenId;
                assert.equal(msgAddress, deployer);
                assert.equal(
                  NFTContractAddress,
                  "0x000000000000000000000000e7f1725e7734ce288f8367e1bb143e90bb3f0512"
                );
                assert.equal(tokenId.toString(), TokenId);
            })

            it("After the listing is cancelled the mapping is set to 0", async () => {
                let x = await BasicNft.getTokenCounter();
                await NFTMarketPlace.CancelListing(BasicNft.address, (x - 1));
                let y = await NFTMarketPlace.getListing(BasicNft.address, "0");
                assert.equal(y.PriceNFT, "0");
                assert.equal(
                    y.seller,
                    "0x0000000000000000000000000000000000000000"
                );
            });
        });

        describe("Update Listing", () => {
            beforeEach(async () => {
                await BasicNft.mintNft();
                await BasicNft.approve(NFTMarketPlace.address, TokenId);
                await NFTMarketPlace.ListItem(BasicNft.address, TokenId, price);
            });
            it("Updates only if the contract is listed else fails", async () => {
                await expect(
                    NFTMarketPlace.UpdateListing(
                        BasicNft.address,
                        "1",
                        ethers.utils.parseEther("0.001")
                    )
                ).to.be.revertedWith("NFTMarketPlace__NotListed");
            });
            
            it("Fails if the person updating is not the owner", async () => {
                await expect(
                  NFTMarketPlace.connect(player).UpdateListing(
                    BasicNft.address,
                    "0",
                    ethers.utils.parseEther("0.001")
                  )
                ).to.be.revertedWith("NFTMarketPlace__NotOwner");
            });

            it("updates the state", async () => {
                const oldValue = await NFTMarketPlace.getListing(
                    BasicNft.address,
                    "0"
                );
                await
                    NFTMarketPlace.UpdateListing(
                        BasicNft.address,
                        "0",
                        ethers.utils.parseEther("0.001")
                    );
                const NewValue = await NFTMarketPlace.getListing(
                    BasicNft.address,
                    "0"
                );
                assert(NewValue.PriceNFT.toString() != oldValue.PriceNFT.toString());
            });
            
            it("Emits an event when update listing has taken place", async () => {
                await expect(
                    await NFTMarketPlace.UpdateListing(
                        BasicNft.address,
                        "0",
                        ethers.utils.parseEther("0.001")
                    )
                ).to.emit(NFTMarketPlace, "ItemListing");
            });
        });

        describe('Withdraw function', () => {
            beforeEach(async () => {
                await BasicNft.mintNft();
                await BasicNft.approve(NFTMarketPlace.address, TokenId);
                await NFTMarketPlace.ListItem(BasicNft.address, TokenId, price);
            });

            it("Fails when a person with 0 balance calls it", async () => {
                await expect(
                    NFTMarketPlace.Withdraw()
                ).to.be.reverted;
            });

            it("Passes when a correct function is called", async () => {
                await NFTMarketPlace.connect(player).BuyItem(
                    BasicNft.address,
                    TokenId,
                    { value: price }
                );
                await expect(await NFTMarketPlace.Withdraw());
                const NewBalance = await NFTMarketPlace.getBalance();
                assert.equal(NewBalance.toString(), "0");
            });
        });

        describe("Basic NFT Contract", () => {
            it("Checks the Token URI of Basic NFT contract", async () => {
                await BasicNft.mintNft();
                await BasicNft.approve(NFTMarketPlace.address, TokenId);
                await NFTMarketPlace.ListItem(BasicNft.address, TokenId, price);
                const tokenURI = await BasicNft.tokenURI("0");
                const token = "ipfs://bafybeig37ioir76s7mg5oobetncojcm3c3hxasyd4rvid4jqhy4gkaheg4/?filename=0-PUG.json"
                assert.equal(tokenURI.toString(), token);
            });
            });
    });