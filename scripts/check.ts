/**
 * ============================================================================
 * 链上状态检查脚本 — 快速查看所有比赛和管理员账户状态
 * ============================================================================
 *
 * 【用途】
 *   部署并创建比赛后，运行此脚本一次性查看：
 *   - 当前区块高度
 *   - 所有比赛的详情（状态、奖池、截止时间、是否已到期）
 *   - 管理员账户的 USDT 余额、授权额度和 ETH 余额
 *
 * 【用法】
 *   npx hardhat run scripts/check.ts --network localhost
 *
 * 【注意】
 *   此脚本硬编码读取 deployments/localhost.json，仅适用于本地测试。
 *   如需连接测试网，修改 deployments 文件路径即可。
 */
import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  // 读取本地部署记录（包含合约地址和 MockERC20 地址）
  const record = JSON.parse(fs.readFileSync(path.join(__dirname,"..","deployments","localhost.json"),"utf-8"));
  const contractAddr = record.address;
  const usdtAddr = record.usdtAddress;

  // 连接合约（使用通用 getContractAt，适用于本地快速调试）
  const contract = await ethers.getContractAt("FootballBetting", contractAddr);
  const usdt = await ethers.getContractAt("MockERC20", usdtAddr);

  // ── 链全局状态 ──
  console.log("=== Chain State ===");
  console.log("Block:", await ethers.provider.getBlockNumber());
  console.log("MatchCounter:", (await contract.matchCounter()).toString());

  // ── 遍历所有比赛 ──
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

  // ── 管理员账户信息 ──
  const [admin] = await ethers.getSigners();
  const usdtBal = await usdt.balanceOf(admin.address);
  const allowance = await usdt.allowance(admin.address, contractAddr);
  console.log(`\n=== Account ${admin.address} ===`);
  console.log(`USDT Balance: ${ethers.formatUnits(usdtBal, 6)}`);
  console.log(`USDT Allowance: ${ethers.formatUnits(allowance, 6)}`);
  console.log(`ETH Balance: ${ethers.formatEther(await ethers.provider.getBalance(admin.address))}`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
