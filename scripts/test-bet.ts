/**
 * ============================================================================
 * 测试投注脚本 — 在本地区块链上对指定比赛执行一次 placeBet
 * ============================================================================
 *
 * 【用途】
 *   快速验证投注流程是否正常：检查比赛状态、余额和授权 → 发送 0.05 USDT 投注
 *   → 输出交易结果和 Gas 消耗。
 *
 * 【前置条件】
 *   ① 本地链已运行（npx hardhat node）
 *   ② 合约已部署（npm run deploy）
 *   ③ 比赛已创建并开放投注（npm run interact）
 *   ④ 管理员账户已 mint USDT（deploy.ts 自动完成）
 *
 * 【用法】
 *   npx hardhat run scripts/test-bet.ts --network localhost
 */
import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { U } from "./shared/usdt";

async function main() {
  const record = JSON.parse(fs.readFileSync(path.join(__dirname,"..","deployments","localhost.json"),"utf-8"));
  const contractAddr = record.address;
  const usdtAddr = record.usdtAddress;

  const [admin] = await ethers.getSigners();
  const contract = await ethers.getContractAt("FootballBetting", contractAddr);
  const usdt = await ethers.getContractAt("MockERC20", usdtAddr);

  console.log("Testing placeBet for match #2...");

  // ── 检查比赛 #2 的当前状态 ──
  const m = await contract.getMatch(2);
  // Status 字段：0=Created, 1=Open, 2=Closed, 3=Settled
  console.log(`Status: ${m.status} (Open=1)`);
  console.log(`Deadline: ${m.deadline}, Now: ${Math.floor(Date.now()/1000)}`);
  console.log(`minBet: ${ethers.formatUnits(m.minBet, 6)} USDT`);

  // 检查用户对合约的 USDT 授权额度
  const allowance = await usdt.allowance(admin.address, contractAddr);
  const balance = await usdt.balanceOf(admin.address);
  console.log(`Allowance: ${ethers.formatUnits(allowance, 6)} USDT`);
  console.log(`Balance: ${ethers.formatUnits(balance, 6)} USDT`);

  // ── 执行投注：0.05 USDT  →  投注"主队胜"（betOn=1） ──
  const betAmount = U("0.05");
  console.log(`\nPlacing bet: 0.05 USDT on HomeWin...`);

  try {
    const tx = await contract.placeBet(2, 1, betAmount);
    console.log(`tx sent: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`✓ SUCCESS! Block #${receipt!.blockNumber}, Gas: ${receipt!.gasUsed}`);
  } catch(e: any) {
    console.error(`✗ FAILED: ${e.message}`);
    // revert data 包含合约返回的 4 字节自定义错误选择器
    if (e.data) console.error(`  revert data: ${e.data}`);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
