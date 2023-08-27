const { ethers, network } = require("hardhat");
const fs = require("fs");

const FrontEndContractFile =
  "../hh-nft-marketplace-moralis-fronted/constants/NetworkMapping.json";

module.exports = async () => {
    if (process.env.UpdateFrontEnd) {
        console.log("updating front end.....");
        await updateContractAddresses();
    }
}

async function updateContractAddresses() {
    const ChainId = network.config.chainId;
    const nftMarketplace = await ethers.getContract("NFTMarketPlace");
    const contractAddresses = JSON.parse(
      fs.readFileSync(FrontEndContractFile, "utf8")
    );
    if (ChainId in contractAddresses) {
      if (
        !contractAddresses[ChainId]["NftMarketplace"].includes(
          nftMarketplace.address
        )
      ) {
        contractAddresses[ChainId]["NftMarketplace"].push(
          nftMarketplace.address
        );
      }
    } else {
      contractAddresses[ChainId] = {
        NftMarketplace: [nftMarketplace.address],
      };
    }
    fs.writeFileSync(FrontEndContractFile, JSON.stringify(contractAddresses));
    fs.writeFileSync(FrontEndContractFile, JSON.stringify(contractAddresses));
}

module.exports.tags = ["all", "frontEnd"];