/**
 * 修复 Hardhat EVM 时间偏移问题
 * 将区块时间同步为真实系统时间
 */
import { ethers } from "hardhat";

async function main() {
  const block = await ethers.provider.getBlock("latest");
  const blockTime = Number(block!.timestamp);
  const sysTime = Math.floor(Date.now() / 1000);
  const diff = blockTime - sysTime;
  console.log("区块时间:", new Date(blockTime * 1000).toLocaleString());
  console.log("系统时间:", new Date(sysTime * 1000).toLocaleString());
  console.log("偏差:", diff, "秒", diff > 0 ? "(链超前)" : diff < 0 ? "(链落后)" : "(同步)");

  // 如果链上时间已经超前（之前 evm_increaseTime 导致），取链上时间+1
  // 否则同步到系统时间+1
  const newTime = Math.max(sysTime, blockTime) + 1;
  await ethers.provider.send("evm_setNextBlockTimestamp", [newTime]);
  await ethers.provider.send("evm_mine", []);

  const newBlock = await ethers.provider.getBlock("latest");
  console.log("\n修复后区块时间:", new Date(newBlock!.timestamp * 1000).toLocaleString());
  console.log("偏差:", Number(newBlock!.timestamp) - sysTime, "秒");
  console.log("✓ 时间已同步");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
