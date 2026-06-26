/**
 * ============================================================================
 * 测试创建赛事脚本 — 在本地区块链上创建一场测试比赛
 * ============================================================================
 *
 * 【用途】
 *   验证 createMatch 和 openMatch 的交易流程，用于部署后快速冒烟测试。
 *
 * 【检验点】
 *   ① owner 身份验证 — 部署者是否为合约 owner
 *   ② 时间偏移检测 — 区块时间 vs 系统时间
 *   ③ createMatch — 使用区块时间 + 1 小时/30 分钟作为 startTime/deadline
 *   ④ openMatch  — 创建后立即开放投注
 *
 * 【前提条件】
 *   ① 本地链已运行（npx hardhat node）
 *   ② 合约已部署（npm run deploy）
 *   (不需要 interact.ts 预先创建比赛)
 *
 * 【用法】
 *   npx hardhat run scripts/test-create.ts --network localhost
 *
 * 【关键设计：使用区块时间而非系统时间】
 *   这是此脚本最重要的技巧。createMatch 要求 startTime > block.timestamp，
 *   block.timestamp 是上一个区块的时间戳，而非系统时间。如果 Hardhat 本地链
 *   的时间已偏移（例如超前 30 分钟），用系统时间 + 1 小时可能仍小于区块时间，
 *   导致 "start time must be in the future" 错误。
 *
 *   解决方案：直接用 block.timestamp（而非 Date.now()）作为 now 基准。
 */
import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { U } from "./shared/usdt";

async function main() {
  const record = JSON.parse(fs.readFileSync(path.join(__dirname,"..","deployments","localhost.json"),"utf-8"));
  const contractAddr = record.address;

  const [admin] = await ethers.getSigners();
  const contract = await ethers.getContractAt("FootballBetting", contractAddr);

  // ── ① 验证 owner 身份 ──
  const owner = await contract.owner();
  console.log("Owner:", owner);
  console.log("Admin:", admin.address);
  console.log("Is owner:", owner.toLowerCase() === admin.address.toLowerCase());

  // ── ② 检查时间偏移 ──
  const block = await ethers.provider.getBlock("latest");
  const sysTime = Math.floor(Date.now() / 1000);
  console.log("Block timestamp:", block!.timestamp, "=", new Date(block!.timestamp * 1000).toLocaleString());
  console.log("System time:", sysTime, "=", new Date(sysTime * 1000).toLocaleString());
  console.log("Offset:", Number(block!.timestamp) - sysTime, "seconds");

  // ── ③ 使用区块时间（非系统时间！）创建未来比赛 ──
  const now = block!.timestamp;    // 以链上时间为准，不受系统时间偏差影响
  const startTime = now + 3600;    // 开赛时间 = 当前区块时间 + 1 小时
  const deadline = now + 1800;     // 截止时间 = 当前区块时间 + 30 分钟
  const minBet = U("0.01");

  const matchName = ethers.encodeBytes32String("测试赛");
  const home = ethers.encodeBytes32String("法国");
  const away = ethers.encodeBytes32String("阿根廷");

  console.log(`\nCreating match: now=${now}, start=${startTime}, deadline=${deadline}`);
  try {
    const tx = await contract.createMatch(matchName, home, away, startTime, deadline, minBet, 0n, true);
    console.log("tx:", tx.hash);
    const receipt = await tx.wait();
    console.log("✓ SUCCESS! Block #" + receipt!.blockNumber);

    // ── ④ 开放投注 ──
    const tx2 = await contract.openMatch(2);
    await tx2.wait();
    console.log("✓ Opened match #2");
  } catch(e: any) {
    console.error("✗ FAILED:", e.message);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
