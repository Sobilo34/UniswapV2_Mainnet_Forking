import { ethers } from "hardhat";
const helpers = require("@nomicfoundation/hardhat-network-helpers");

const main = async () => {
  const usdc_address = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
  const dai_address = "0x6B175474E89094C44Da98b954EedeAC495271d0F"
  const impersonated_address = "0xf584f8728b874a6a5c7a8d4d387c9aae9172d621"
  const router_address = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"
  const pool_address = "0xAE461cA67B15dc8dc81CE7615e0320dA1A9aB8D5"

  await helpers.impersonateAccount(impersonated_address)
  const signer = await ethers.getSigner(impersonated_address)

  const usdc_contract = await ethers.getContractAt("IERC20", usdc_address)
  const dai_contract = await ethers.getContractAt("IERC20", dai_address)
  const router_contract = await ethers.getContractAt("IUniswapV2Router01", router_address)
  const pool_contract = await ethers.getContractAt("IUniswapV2Pair", pool_address)
  const usdcdesired = ethers.parseUnits("1000", 6)
  const daidesired = ethers.parseUnits("1000", 18)
  const usdcmin = ethers.parseUnits("900", 6)
  const daimin = ethers.parseUnits("900", 18)
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes from now


  const usdc_balance = await usdc_contract.balanceOf(signer.address);
  const dai_balance = await dai_contract.balanceOf(signer.address);
  const pool_balance = await pool_contract.balanceOf(signer.address);

  console.log("Before USDC Balance:", ethers.formatUnits(usdc_balance, 6))
  console.log("Dai balance before formating:", dai_balance)
  console.log("Before DAI balance:", ethers.formatUnits(dai_balance, 18))
  console.log("Before Pool Balance:", ethers.formatUnits(pool_balance, 18))

  await helpers.setBalance(impersonated_address, ethers.parseEther("10"))

  const approveUSDC = await usdc_contract.connect(signer).approve(router_address, usdcdesired)
  await approveUSDC.wait()
  const approveDAI = await dai_contract.connect(signer).approve(router_address, daidesired)
  await approveDAI.wait()

  const addLiquidity = await router_contract.connect(signer).addLiquidity(usdc_address, dai_address, usdcdesired, daidesired, usdcmin, daimin, signer.address, deadline);

  const new_usdc_balance = await usdc_contract.balanceOf(signer.address)
  const new_dai_balance = await dai_contract.balanceOf(signer.address)
  const new_pool_balance = await pool_contract.balanceOf(signer.address)

  console.log("After USDC Balance:", ethers.formatUnits(new_usdc_balance, 6))
  console.log("After DAI balance:", ethers.formatUnits(new_dai_balance,18))
  console.log("After Pool Balance:", ethers.formatUnits(new_pool_balance, 18))

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });