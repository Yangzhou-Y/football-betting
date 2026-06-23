import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

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

  // 检查 match #1
  const cnt = Number(await c.matchCounter());
  for (let i = 1; i <= cnt; i++) {
    const m = await c.getMatch(i);
    const statuses = ["Created","Open","Closed","Settled"];
    console.log(`\n=== Match #${i}: ${statuses[Number(m.status)]} ===`);
    console.log("Deadline:", new Date(Number(m.deadline)*1000).toLocaleString());
    console.log("block.timestamp:", new Date(Number(blockTs)*1000).toLocaleString());
    console.log("deadline > block.timestamp:", m.deadline > blockTs);
  }

  // 测试 createMatch（基于区块时间创建未来比赛）
  console.log("\n=== 测试: 使用区块时间创建比赛 ===");
  try {
    const start = blockTs + 7200n;
    const deadline = blockTs + 3600n;
    console.log("startTime:", new Date(Number(start)*1000).toLocaleString());
    console.log("deadline:", new Date(Number(deadline)*1000).toLocaleString());

    const tx = await c.createMatch(
      ethers.encodeBytes32String("法国"),
      ethers.encodeBytes32String("巴西"),
      start,
      deadline,
      ethers.parseUnits("0.01", 6),
      0n
    );
    const r = await tx.wait();
    console.log("✓ createMatch 成功! block", r!.blockNumber);
  } catch(e: any) {
    console.log("✗ createMatch 失败:", e.message?.slice(0, 300));
  }

  // 前端的admin地址与owner对比确认
  console.log("\n=== 前端配置地址 ===");
  console.log("config.ts contractAddress:", record.address);
  console.log("config.ts usdtAddress:", record.usdtAddress);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
