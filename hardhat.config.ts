import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const API_KEY = process.env.API_KEY;
const config: HardhatUserConfig = {
  solidity: "0.8.28",
  networks: {
    hardhat: {
      forking: {
        url: `https://mainnet.infura.io/v3/aabba8d72cfc4bb5b74b3e7d90ee5477`,
      }
    }
  },
};

export default config;

