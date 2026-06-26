/**
 * ============================================================================
 * 诊断脚本 — 排查本地链时间偏移、比赛状态、createMatch 失败原因
 * ============================================================================
 *
 * 【背景：Hardhat 本地链时间偏移问题】
 *   Hardhat Network（尤其是 localhost 模式）重启后区块时间戳可能与系统时间
 *   严重不同步（可能超前或落后数小时）。createMatch 要求 startTime > block.timestamp，
 *   若链上时间已超前于预期的 startTime，交易会以 StartTimeNotFuture 回退。
 *
 * 【此脚本做什么】
 *   ① 对比系统时间 vs 链上区块时间，显示偏移量
 *   ② 列出现有比赛及其截止时间 vs 当前区块时间（判断是否到期）
 *   ③ 尝试用"区块时间+未来偏移"创建一场测试比赛，验证 createMatch 是否可用
 *   ④ 显示前端配置的合约地址和 USDT 地址
 *
 * 【用法】
 *   npx hardhat run scripts/diag.ts --network localhost
 *
 * 【诊断结论指南】
 *   - 偏差 > 0（链超前）→ 跑 fix-time.ts 同步
 *   - 偏差 < 0（链落后）→ 重新启动 Hardhat node
 *   - createMatch 失败 + 报 start time must be in the future → 时间偏移问题
 */
import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { U } from "./shared/usdt";

async function main() {
  const record = JSON.parse(fs.readFileSync(path.join(__dirname,"..","deployments","localhost.json"),"utf-8"));
  const [admin] = await ethers.getSigners();
  const blk = await ethers.provider.getBlock("latest");
  const sys = Math.floor(Date.now()/1000);

  console.log("=== 基础状态 ===");
  console.log("Block #:", await ethers.provider.getBlockNumber());
  console.log("Block时间:", new Date(Number(blk!.timestamp)*1000).toLocaleString());
  console.log("系统时间:", new Date(sys*1000).toLocaleString());
  console.log("时间偏差:", Number(blk!.timestamp)-sys, "秒");

  const c = await ethers.getContractAt("FootballBetting", record.address);
  console.log("Owner:", await c.owner());
  console.log("Match总数:", (await c.matchCounter()).toString());

  const blockTs = BigInt(blk!.timestamp);

  // 遍历所有比赛，检查截止时间与当前区块时间的关系
  const cnt = Number(await c.matchCounter());
  for (let i = 1; i <= cnt; i++) {
    const m = await c.getMatch(i);
    const statuses = ["Created","Open","Closed","Settled"];
    console.log(`\n=== Match #${i}: ${statuses[Number(m.status)]} ===`);
    console.log("Deadline:", new Date(Number(m.deadline)*1000).toLocaleString());
    console.log("block.timestamp:", new Date(Number(blockTs)*1000).toLocaleString());
    console.log("deadline > block.timestamp:", m.deadline > blockTs);
  }

  // 尝试基于区块时间（而非系统时间）创建未来比赛，验证时间偏移已修复
  console.log("\n=== 测试: 使用区块时间创建比赛 ===");
  try {
    const start = blockTs + 7200n;      // 区块时间 + 2 小时
    const deadline = blockTs + 3600n;    // 区块时间 + 1 小时
    console.log("startTime:", new Date(Number(start)*1000).toLocaleString());
    console.log("deadline:", new Date(Number(deadline)*1000).toLocaleString());

    const tx = await c.createMatch(
      ethers.encodeBytes32String("测试赛"),
      ethers.encodeBytes32String("法国"),
      ethers.encodeBytes32String("巴西"),
      start,
      deadline,
      U("0.01"),
      0n,
      true
    );
    const r = await tx.wait();
    console.log("✓ createMatch 成功! block", r!.blockNumber);
  } catch(e: any) {
    console.log("✗ createMatch 失败:", e.message?.slice(0, 300));
  }

  // 核对前端配置与链上部署是否一致
  console.log("\n=== 前端配置地址 ===");
  console.log("config.ts contractAddress:", record.address);
  console.log("config.ts usdtAddress:", record.usdtAddress);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
