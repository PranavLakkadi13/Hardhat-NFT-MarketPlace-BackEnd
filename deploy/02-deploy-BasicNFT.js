const { network, ethers } = require("hardhat");
const {
  developmentChains,
  networkConfig,
} = require("../helper-hardhat-config");
const { verify } = require("../utils/verify");

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  args = [];

  const BasicNft = await deploy("BasicNft", {
    from: deployer,
    args: args,
    log: true,
    waitConfirmations: network.config.blockConfirmations || 1,
  });

  log("the address of the contract is : " + BasicNft.address);
    
log("--------------------------------------------------------------------------")

  if (
    !developmentChains.includes(network.name) &&
    process.env.Etherscan_API_KEY
  ) {
    log("Verifying contract......");
      await verify(BasicNft.address, args);
      log(
        "--------------------------------------------------------------------------"
      );
    }
};

module.exports.tags = ["all", "BasicNft"];
