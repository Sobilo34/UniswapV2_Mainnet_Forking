import { ethers } from "hardhat"
const helpers = require("@nomicfoundation/hardhat-network-helpers")

const main = async () => {
    const impersonated_address = "0xf584f8728b874a6a5c7a8d4d387c9aae9172d621"
    const router_address = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"
    const usdc_address = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
    const factory_address = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f"

    await helpers.impersonateAccount(impersonated_address)
    const signer = await ethers.getSigner(impersonated_address)

    const usdc_contract = await ethers.getContractAt("IERC20", usdc_address)
    const router_contract = await ethers.getContractAt("IUniswapV2Router01", router_address)
    const factory_contract = await ethers.getContractAt("IUniswapV2Factory", factory_address)
    const weth_address = await router_contract.WETH()

    const pool_address = await factory_contract.getPair(usdc_address, weth_address)
    const pool_contract = await ethers.getContractAt("IUniswapV2Pair", pool_address)

    const [reserveUSDC, reserveWETH] = await pool_contract.getReserves();
    const myUSDC = await ethers.formatUnits(reserveUSDC)
    const myEther = await ethers.formatEther(reserveWETH)
    console.log(`Usdc reserve: ${myUSDC}, Ether reserve: ${myEther}`)

    const ethdesired = ethers.parseEther("1");
    const ethmin = ethers.parseEther("0.9");
    const usdcmin = ethers.parseUnits("1", 6);

    const liquidity = await pool_contract.balanceOf(impersonated_address)
    const approveLP = await pool_contract.connect(signer).approve(router_address, liquidity)
    await approveLP.wait()

    const deadline = await helpers.time.latest() + 300
    await helpers.setBalance(impersonated_address, ethers.parseEther("100"))

    console.log("Before USDC Balnace:" +  await usdc_contract.balanceOf(impersonated_address))

    console.log("Before Pool address:" + await pool_contract.balanceOf(impersonated_address))


    await router_contract.connect(signer).removeLiquidityETH(usdc_address, liquidity, usdcmin, ethmin, impersonated_address, deadline)

    console.log("After USDC Balance:" +  await usdc_contract.balanceOf(impersonated_address))

    console.log("After Pool address:" + await pool_contract.balanceOf(impersonated_address))
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});