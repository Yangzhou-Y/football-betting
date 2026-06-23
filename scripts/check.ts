import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const record = JSON.parse(fs.readFileSync(path.join(__dirname,"..","deployments","localhost.json"),"utf-8"));
  const contractAddr = record.address;
  const usdtAddr = record.usdtAddress;

  const contract = await ethers.getContractAt("FootballBetting", contractAddr);
  const usdt = await ethers.getContractAt("MockERC20", usdtAddr);

  console.log("=== Chain State ===");
  console.log("Block:", await ethers.provider.getBlockNumber());
  console.log("MatchCounter:", (await contract.matchCounter()).toString());

  const matchCnt = Number(await contract.matchCounter());
  for (let i = 1; i <= matchCnt; i++) {
    const m = await contract.getMatch(i);
    const statuses = ["Created","Open","Closed","Settled"];
    console.log(`\nMatch #${i}: ${statuses[m.status]}`);
    console.log(`  ${ethers.decodeBytes32String(m.homeTeam)} vs ${ethers.decodeBytes32String(m.awayTeam)}`);
    console.log(`  Pool: ${ethers.formatUnits(m.totalPool,6)} USDT`);
    console.log(`  Deadline: ${new Date(Number(m.deadline)*1000).toLocaleString()}`);
    console.log(`  Now: ${new Date().toLocaleString()}`);
    console.log(`  Deadline passed: ${m.deadline < BigInt(Math.floor(Date.now()/1000))}`);
    console.log(`  Status: ${m.status} (= ${statuses[m.status]})`);
  }

  const [admin] = await ethers.getSigners();
  const usdtBal = await usdt.balanceOf(admin.address);
  const allowance = await usdt.allowance(admin.address, contractAddr);
  console.log(`\n=== Account ${admin.address} ===`);
  console.log(`USDT Balance: ${ethers.formatUnits(usdtBal, 6)}`);
  console.log(`USDT Allowance: ${ethers.formatUnits(allowance, 6)}`);
  console.log(`ETH Balance: ${ethers.formatEther(await ethers.provider.getBalance(admin.address))}`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
