import { ethers } from "hardhat";
const helpers = require("@nomicfoundation/hardhat-network-helpers");

// Common constants
const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const DAI_ADDRESS = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const IMPERSONATED_ADDRESS = "0xf584f8728b874a6a5c7a8d4d387c9aae9172d621";
const ROUTER_ADDRESS = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
const USDC_DAI_POOL_ADDRESS = "0xAE461cA67B15dc8dc81CE7615e0320dA1A9aB8D5";
const FACTORY_ADDRESS = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";

// Helper function to initialize contracts and signer
async function setup() {
  await helpers.impersonateAccount(IMPERSONATED_ADDRESS);
  await helpers.setBalance(IMPERSONATED_ADDRESS, ethers.parseEther("100"));
  
  // Get the signer directly from the provider
  const provider = ethers.provider;
  const signer = await provider.getSigner(IMPERSONATED_ADDRESS);

  // Get contracts without signer first
  const usdcContract = await ethers.getContractAt("IERC20", USDC_ADDRESS);
  const daiContract = await ethers.getContractAt("IERC20", DAI_ADDRESS);
  const wethContract = await ethers.getContractAt("IERC20", WETH_ADDRESS);
  const routerContract = await ethers.getContractAt("IUniswapV2Router01", ROUTER_ADDRESS);
  const factoryContract = await ethers.getContractAt("IUniswapV2Factory", FACTORY_ADDRESS);
  const usdcDaiPoolContract = await ethers.getContractAt("IUniswapV2Pair", USDC_DAI_POOL_ADDRESS);

  return { 
    signer, 
    provider,
    usdcContract: usdcContract.connect(signer),
    daiContract: daiContract.connect(signer),
    wethContract: wethContract.connect(signer),
    routerContract: routerContract.connect(signer),
    factoryContract: factoryContract.connect(signer),
    usdcDaiPoolContract: usdcDaiPoolContract.connect(signer)
  };
}

// Helper function to print balances
async function printBalances(
  usdcContract: any,
  daiContract: any,
  poolContract: any,
  address: string,
  prefix: string = ""
) {
  const usdcBalance = await usdcContract.balanceOf(address);
  const daiBalance = daiContract ? await daiContract.balanceOf(address) : 0;
  const poolBalance = poolContract ? await poolContract.balanceOf(address) : 0;

  console.log(`${prefix}USDC Balance:`, ethers.formatUnits(usdcBalance, 6));
  if (daiContract) {
    console.log(`${prefix}DAI Balance:`, ethers.formatUnits(daiBalance, 18));
  }
  if (poolContract) {
    console.log(`${prefix}Pool Balance:`, ethers.formatUnits(poolBalance, 18));
  }
}

// Test 1: Add liquidity to USDC-DAI pool
async function testAddLiquidity() {
  console.log("\n=== Testing addLiquidity ===");
  const { signer, usdcContract, daiContract, routerContract, usdcDaiPoolContract } = await setup();

  const usdcDesired = ethers.parseUnits("1000", 6);
  const daiDesired = ethers.parseUnits("1000", 18);
  const usdcMin = ethers.parseUnits("900", 6);
  const daiMin = ethers.parseUnits("900", 18);
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

  await printBalances(usdcContract, daiContract, usdcDaiPoolContract, signer.address, "Before ");

  // Approve tokens
  await (await usdcContract.approve(ROUTER_ADDRESS, usdcDesired)).wait();
  await (await daiContract.approve(ROUTER_ADDRESS, daiDesired)).wait();

  // Add liquidity
  await routerContract.addLiquidity(
    USDC_ADDRESS,
    DAI_ADDRESS,
    usdcDesired,
    daiDesired,
    usdcMin,
    daiMin,
    signer.address,
    deadline
  );

  await printBalances(usdcContract, daiContract, usdcDaiPoolContract, signer.address, "After ");
}

// Test 2: Remove liquidity from USDC-DAI pool
async function testRemoveLiquidity() {
  console.log("\n=== Testing removeLiquidity ===");
  const { signer, usdcContract, daiContract, routerContract, usdcDaiPoolContract } = await setup();

  const usdcMin = ethers.parseUnits("900", 6);
  const daiMin = ethers.parseUnits("900", 18);
  const deadline = await helpers.time.latest() + 300;

  await printBalances(usdcContract, daiContract, usdcDaiPoolContract, signer.address, "Before ");

  const liquidity = await usdcDaiPoolContract.balanceOf(signer.address);
  await (await usdcDaiPoolContract.approve(ROUTER_ADDRESS, liquidity)).wait();

  await routerContract.removeLiquidity(
    USDC_ADDRESS,
    DAI_ADDRESS,
    liquidity,
    usdcMin,
    daiMin,
    signer.address,
    deadline
  );

  await printBalances(usdcContract, daiContract, usdcDaiPoolContract, signer.address, "After ");
}

// Test 3: Add liquidity with ETH
async function testAddLiquidityETH() {
  console.log("\n=== Testing addLiquidityETH ===");
  const { signer, provider } = await setup();

  // Get contracts without signer first
  const routerContract = await ethers.getContractAt("IUniswapV2Router01", ROUTER_ADDRESS);
  const factoryContract = await ethers.getContractAt("IUniswapV2Factory", FACTORY_ADDRESS);
  const usdcContract = await ethers.getContractAt("IERC20", USDC_ADDRESS);

  // Connect them to signer
  const connectedRouter = routerContract.connect(signer);
  const connectedFactory = factoryContract.connect(signer);
  const connectedUSDC = usdcContract.connect(signer);

  const wethAddress = await connectedRouter.WETH();
  const poolAddress = await connectedFactory.getPair(USDC_ADDRESS, wethAddress);
  const poolContract = await ethers.getContractAt("IUniswapV2Pair", poolAddress).then(c => c.connect(signer));

  const [reserveUSDC, reserveWETH] = await poolContract.getReserves();
  console.log(`USDC reserve: ${ethers.formatUnits(reserveUSDC, 6)}, WETH reserve: ${ethers.formatEther(reserveWETH)}`);

  const ethDesired = ethers.parseEther("1");
  const usdcDesired = ethDesired * reserveUSDC / reserveWETH;
  const usdcMin = ethers.parseUnits("1", 6);
  const ethMin = ethers.parseEther("0.9");
  const deadline = await helpers.time.latest() + 300;

  await printBalances(connectedUSDC, null, poolContract, signer.address, "Before ");

  await (await connectedUSDC.approve(ROUTER_ADDRESS, usdcDesired)).wait();

  const tx = await connectedRouter.addLiquidityETH(
    USDC_ADDRESS,
    usdcDesired,
    usdcMin,
    ethMin,
    signer.address,
    deadline,
    { value: ethDesired }
  );
  await tx.wait();

  await printBalances(connectedUSDC, null, poolContract, signer.address, "After ");
}

// Test 4: Remove liquidity with ETH
async function testRemoveLiquidityETH() {
  console.log("\n=== Testing removeLiquidityETH ===");
  const { signer, routerContract, factoryContract, usdcContract } = await setup();

  const wethAddress = await routerContract.WETH();
  const poolAddress = await factoryContract.getPair(USDC_ADDRESS, wethAddress);
  const poolContract = await ethers.getContractAt("IUniswapV2Pair", poolAddress).then(c => c.connect(signer));

  const [reserveUSDC, reserveWETH] = await poolContract.getReserves();
  console.log(`USDC reserve: ${ethers.formatUnits(reserveUSDC, 6)}, WETH reserve: ${ethers.formatEther(reserveWETH)}`);

  const usdcMin = ethers.parseUnits("1", 6);
  const ethMin = ethers.parseEther("0.9");
  const deadline = await helpers.time.latest() + 300;

  await printBalances(usdcContract, null, poolContract, signer.address, "Before ");

  const liquidity = await poolContract.balanceOf(signer.address);
  await (await poolContract.approve(ROUTER_ADDRESS, liquidity)).wait();

  await routerContract.removeLiquidityETH(
    USDC_ADDRESS,
    liquidity,
    usdcMin,
    ethMin,
    signer.address,
    deadline
  );

  await printBalances(usdcContract, null, poolContract, signer.address, "After ");
}

// Test 5: Swap ETH for exact DAI amount
async function testSwapETHForExactTokens() {
  console.log("\n=== Testing swapETHForExactTokens ===");
  const { signer, daiContract, routerContract } = await setup();

  const amountOut = ethers.parseUnits("100", 18); // 100 DAI
  const deadline = Math.floor(Date.now() / 1000) + 60 * 10;

  await printBalances(null, daiContract, null, signer.address, "Before ");

  const tx = await routerContract.swapETHForExactTokens(
    amountOut,
    [WETH_ADDRESS, DAI_ADDRESS],
    signer.address,
    deadline,
    { value: ethers.parseEther("1") }
  );
  await tx.wait();

  await printBalances(null, daiContract, null, signer.address, "After ");
}

// Test 6: Swap exact ETH for DAI
async function testSwapExactETHForTokens() {
  console.log("\n=== Testing swapExactETHForTokens ===");
  const { signer, daiContract, routerContract } = await setup();

  const amountOutMin = ethers.parseUnits("90", 18);
  const deadline = Math.floor(Date.now() / 1000) + 60 * 10;

  await printBalances(null, daiContract, null, signer.address, "Before ");

  const tx = await routerContract.swapExactETHForTokens(
    amountOutMin,
    [WETH_ADDRESS, DAI_ADDRESS],
    signer.address,
    deadline,
    { value: ethers.parseEther("1") }
  );
  await tx.wait();

  await printBalances(null, daiContract, null, signer.address, "After ");
}

// // Test 7: Swap exact ETH for DAI with fee support
// async function testSwapExactETHForTokensSupportingFee() {
//   console.log("\n=== Testing swapExactETHForTokensSupportingFee ===");
//   const { signer, daiContract, routerContract } = await setup();

//   const amountOutMin = ethers.parseUnits("90", 18);
//   const deadline = Math.floor(Date.now() / 1000) + 60 * 10;

//   await printBalances(null, daiContract, null, signer.address, "Before ");

//   const tx = await routerContract.swapExactETHForTokensSupportingFeeOnTransferTokens(
//     amountOutMin,
//     [WETH_ADDRESS, DAI_ADDRESS],
//     signer.address,
//     deadline,
//     { value: ethers.parseEther("1") }
//   );
//   await tx.wait();

//   await printBalances(null, daiContract, null, signer.address, "After ");
// }

// Test 8: Swap exact USDC for ETH
async function testSwapExactTokensForETH() {
  console.log("\n=== Testing swapExactTokensForETH ===");
  const { signer, usdcContract, routerContract } = await setup();

  const amountIn = ethers.parseUnits("10000", 6); // 10,000 USDC
  const amountOutMin = ethers.parseUnits("3", 18); // 3 ETH
  const deadline = Math.floor(Date.now() / 1000) + 60 * 10;

  await printBalances(usdcContract, null, null, signer.address, "Before ");

  await (await usdcContract.approve(ROUTER_ADDRESS, amountIn)).wait();

  const tx = await routerContract.swapExactTokensForETH(
    amountIn,
    amountOutMin,
    [USDC_ADDRESS, WETH_ADDRESS],
    signer.address,
    deadline
  );
  await tx.wait();

  await printBalances(usdcContract, null, null, signer.address, "After ");
}

// Main function to run all tests
async function main() {
  try {
    await testAddLiquidity();
    await testRemoveLiquidity();
    await testAddLiquidityETH();
    await testRemoveLiquidityETH();
    await testSwapETHForExactTokens();
    await testSwapExactETHForTokens();
    // await testSwapExactETHForTokensSupportingFee();
    await testSwapExactTokensForETH();
  } catch (error) {
    console.error("Error in main execution:", error);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});