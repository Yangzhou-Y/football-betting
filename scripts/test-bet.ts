import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const record = JSON.parse(fs.readFileSync(path.join(__dirname,"..","deployments","localhost.json"),"utf-8"));
  const contractAddr = record.address;
  const usdtAddr = record.usdtAddress;

  const [admin] = await ethers.getSigners();
  const contract = await ethers.getContractAt("FootballBetting", contractAddr);
  const usdt = await ethers.getContractAt("MockERC20", usdtAddr);

  console.log("Testing placeBet for match #2...");

  // Check current state
  const m = await contract.getMatch(2);
  console.log(`Status: ${m.status} (Open=1)`);
  console.log(`Deadline: ${m.deadline}, Now: ${Math.floor(Date.now()/1000)}`);
  console.log(`minBet: ${ethers.formatUnits(m.minBet, 6)} USDT`);

  const allowance = await usdt.allowance(admin.address, contractAddr);
  const balance = await usdt.balanceOf(admin.address);
  console.log(`Allowance: ${ethers.formatUnits(allowance, 6)} USDT`);
  console.log(`Balance: ${ethers.formatUnits(balance, 6)} USDT`);

  const betAmount = ethers.parseUnits("0.05", 6); // 0.05 USDT
  console.log(`\nPlacing bet: 0.05 USDT on HomeWin...`);

  try {
    const tx = await contract.placeBet(2, 1, betAmount);
    console.log(`tx sent: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`✓ SUCCESS! Block #${receipt!.blockNumber}, Gas: ${receipt!.gasUsed}`);
  } catch(e: any) {
    console.error(`✗ FAILED: ${e.message}`);
    if (e.data) console.error(`  revert data: ${e.data}`);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
