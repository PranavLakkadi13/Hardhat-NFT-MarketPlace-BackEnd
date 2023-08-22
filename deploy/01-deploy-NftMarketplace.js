const { network, ethers } = require("hardhat");
const {
  developmentChains,
  networkConfig,
} = require("../helper-hardhat-config");
const { verify } = require("../utils/verify");


module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();

    args = []

    const NFTMarketPlace = await deploy("NFTMarketPlace", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1
    });

  
  log("The address of the contract is : " + NFTMarketPlace.address);
    log(
      "--------------------------------------------------------------------------"
    );

    if (
      !developmentChains.includes(network.name) &&
      process.env.Etherscan_API_KEY
    ) {
      log("Verifying contract......");
        await verify(NFTMarketPlace.address, args);
        log("--------------------------------------------------------------------------")
    }
}

module.exports.tags = ["all", "NFTMarketPlace"];