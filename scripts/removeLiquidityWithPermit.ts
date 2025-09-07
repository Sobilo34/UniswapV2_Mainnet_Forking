import { ethers } from "hardhat";
const helpers = require("@nomicfoundation/hardhat-network-helpers");

// Common constants
const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const DAI_ADDRESS = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
const WHALE_ADDRESS = "0xf584f8728b874a6a5c7a8d4d387c9aae9172d621"; // Known USDC/DAI whale
const ROUTER_ADDRESS = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
const POOL_ADDRESS = "0xAE461cA67B15dc8dc81CE7615e0320dA1A9aB8D5";

async function main() {
  // Use a local Hardhat account for signing
  const [localSigner] = await ethers.getSigners();
  console.log("Local Signer Address:", localSigner.address);

  // Impersonate the whale account to transfer funds
  await helpers.impersonateAccount(WHALE_ADDRESS);
  await helpers.setBalance(WHALE_ADDRESS, ethers.parseEther("10"));
  const whaleSigner = await ethers.provider.getSigner(WHALE_ADDRESS);

  // Get contracts
  const usdcContract = await ethers.getContractAt("IERC20", USDC_ADDRESS);
  const daiContract = await ethers.getContractAt("IERC20", DAI_ADDRESS);
  const routerContract = await ethers.getContractAt("IUniswapV2Router02", ROUTER_ADDRESS);
  const poolContract = await ethers.getContractAt("IERC20Permit", POOL_ADDRESS);
  const factoryContract = await ethers.getContractAt("IUniswapV2Factory", "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f");

  // Connect contracts to local signer for transactions
  const usdc = usdcContract.connect(localSigner);
  const dai = daiContract.connect(localSigner);
  const router = routerContract.connect(localSigner);
  const pool = poolContract.connect(localSigner);

  // Check whale balances
  const whaleUsdcBalance = await usdcContract.balanceOf(WHALE_ADDRESS);
  const whaleDaiBalance = await daiContract.balanceOf(WHALE_ADDRESS);
  console.log("Whale USDC Balance:", ethers.formatUnits(whaleUsdcBalance, 6));
  console.log("Whale DAI Balance:", ethers.formatUnits(whaleDaiBalance, 18));

  // Transfer USDC and DAI from whale to local signer
  const usdcAmount = ethers.parseUnits("1000", 6);
  const daiAmount = ethers.parseUnits("1000", 18);
  if (whaleUsdcBalance < usdcAmount || whaleDaiBalance < daiAmount) {
    console.error("Whale has insufficient USDC or DAI balance");
    return;
  }
  await usdcContract.connect(whaleSigner).transfer(localSigner.address, usdcAmount);
  await daiContract.connect(whaleSigner).transfer(localSigner.address, daiAmount);
  console.log("Transferred USDC and DAI to local signer");

  // Add liquidity to ensure the local signer has LP tokens
  const deadline = (await helpers.time.latest()) + 300;
  await usdc.approve(ROUTER_ADDRESS, usdcAmount);
  await dai.approve(ROUTER_ADDRESS, daiAmount);

  // Verify token order for the USDC-DAI pair
  const token0 = await factoryContract.getPair(USDC_ADDRESS, DAI_ADDRESS);
  console.log("Pair Address:", token0);
  const isUsdcFirst = token0.toLowerCase() === POOL_ADDRESS.toLowerCase();
  console.log("Token Order (USDC, DAI):", isUsdcFirst);

  await router.addLiquidity(
    isUsdcFirst ? USDC_ADDRESS : DAI_ADDRESS,
    isUsdcFirst ? DAI_ADDRESS : USDC_ADDRESS,
    isUsdcFirst ? usdcAmount : daiAmount,
    isUsdcFirst ? daiAmount : usdcAmount,
    ethers.parseUnits("900", 6),
    ethers.parseUnits("900", 18),
    localSigner.address,
    deadline
  );
  console.log("Liquidity added successfully");

  // Print balances before
  const usdcBalance = await usdc.balanceOf(localSigner.address);
  const daiBalance = await dai.balanceOf(localSigner.address);
  const poolBalance = await pool.balanceOf(localSigner.address);
  console.log("Before USDC Balance:", ethers.formatUnits(usdcBalance, 6));
  console.log("Before DAI Balance:", ethers.formatUnits(daiBalance, 18));
  console.log("Before Pool Balance:", ethers.formatUnits(poolBalance, 18));

  // Prepare permit signature
  const liquidity = await pool.balanceOf(localSigner.address);
  if (liquidity === 0n) {
    console.error("No LP tokens available for local signer");
    return;
  }
  const usdcMin = ethers.parseUnits("900", 6);
  const daiMin = ethers.parseUnits("900", 18);
  const permitDeadline = (await helpers.time.latest()) + 300;

  const nonce = await pool.nonces(localSigner.address);
  const domain = {
    name: await pool.name(),
    version: "1",
    chainId: 1, // Hardcode to mainnet chain ID for fork
    verifyingContract: POOL_ADDRESS,
  };

  const types = {
    Permit: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
  };

  const values = {
    owner: localSigner.address,
    spender: ROUTER_ADDRESS,
    value: liquidity,
    nonce: nonce,
    deadline: permitDeadline,
  };

  console.log("Permit Parameters:", { domain, types, values });
  console.log("Signing permit...");
  const signature = await localSigner.signTypedData(domain, types, values);
  const { v, r, s } = ethers.Signature.from(signature);
  console.log("Signature:", { v, r, s });

  // Remove liquidity with permit
  console.log("Removing liquidity with permit...");
  const removeLiquidity = await router.removeLiquidityWithPermit(
    isUsdcFirst ? USDC_ADDRESS : DAI_ADDRESS,
    isUsdcFirst ? DAI_ADDRESS : USDC_ADDRESS,
    liquidity,
    isUsdcFirst ? usdcMin : daiMin,
    isUsdcFirst ? daiMin : usdcMin,
    localSigner.address,
    permitDeadline,
    false,
    v,
    r,
    s
  );
  await removeLiquidity.wait();
  console.log("Remove liquidity successful");

  // Print balances after
  const newUsdcBalance = await usdc.balanceOf(localSigner.address);
  const newDaiBalance = await dai.balanceOf(localSigner.address);
  const newPoolBalance = await pool.balanceOf(localSigner.address);
  console.log("After USDC Balance:", ethers.formatUnits(newUsdcBalance, 6));
  console.log("After DAI Balance:", ethers.formatUnits(newDaiBalance, 18));
  console.log("After Pool Balance:", ethers.formatUnits(newPoolBalance, 18));
}

main().catch((error) => {
  console.error("Error:", error);
  process.exitCode = 1;
});