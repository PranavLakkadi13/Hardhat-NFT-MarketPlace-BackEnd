const { ethers } = require("hardhat");

const price = ethers.utils.parseEther("0.1");

async function mintandList() {
    const NFTMarketPlace = await ethers.getContract("NFTMarketPlace");
    const BasicNFT = await ethers.getContract("BasicNft");
    console.log("Minting....");
    const mintTx = await BasicNFT.mintNft();
    const mintTxRecipt = await mintTx.wait(1);
    const tokenId = mintTxRecipt.events[0].args.tokenId
    console.log("Approving NFT.....");
    const ApproveTx = await BasicNFT.approve(NFTMarketPlace.address, tokenId);
    await ApproveTx.wait(1);
    console.log("Listing the NFT.....");
    const tx = await NFTMarketPlace.ListItem(BasicNFT.address, tokenId, price);
    await tx.wait(1);
    console.log("Listed The NFT....");
}

mintandList()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });