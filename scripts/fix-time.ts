/**
 * ============================================================================
 * 修复 Hardhat EVM 时间偏移 — 将区块时间同步为真实系统时间
 * ============================================================================
 *
 * 【为什么需要这个脚本？】
 *   Hardhat Network（特别是 localhost 长期运行的节点）的区块时间戳可能与系统
 *   时间产生偏差。原因包括：
 *   - 手动 evm_increaseTime 后未重置
 *   - Hardhat node 长期运行导致漂移
 *   - 系统休眠/唤醒后时间不同步
 *
 *   时间偏差会导致 createMatch 无法创建"未来"比赛（合约要求 startTime > block.timestamp）。
 *
 * 【工作原理】
 *   使用 Hardhat 的底层 RPC 方法：
 *   ① evm_setNextBlockTimestamp — 设置下一个区块的时间戳
 *   ② evm_mine — 强制挖出一个区块
 *   两步配合实现"将区块时间设为任意值"的效果。
 *
 * 【注意事项】
 *   - 只能在 Hardhat Network（本地/本地节点）上使用，真实链不支持这些 RPC 方法
 *   - 修复后区块时间 = max(系统时间, 原区块时间) + 1 秒
 *   - 只影响一个区块，之后正常挖矿的时间戳会在此基础上递增
 *
 * 【用法】
 *   npx hardhat run scripts/fix-time.ts --network localhost
 */
import { ethers } from "hardhat";

async function main() {
  // ① 获取当前区块时间并计算偏移
  const block = await ethers.provider.getBlock("latest");
  const blockTime = Number(block!.timestamp);
  const sysTime = Math.floor(Date.now() / 1000);
  const diff = blockTime - sysTime;
  console.log("区块时间:", new Date(blockTime * 1000).toLocaleString());
  console.log("系统时间:", new Date(sysTime * 1000).toLocaleString());
  console.log("偏差:", diff, "秒", diff > 0 ? "(链超前)" : diff < 0 ? "(链落后)" : "(同步)");

  // ② 取两者较大值 + 1 秒，确保下一个区块在"未来"
  //    如果链上时间已经超前（之前 evm_increaseTime 导致），取链上时间+1
  //    否则同步到系统时间+1
  const newTime = Math.max(sysTime, blockTime) + 1;
  await ethers.provider.send("evm_setNextBlockTimestamp", [newTime]);
  await ethers.provider.send("evm_mine", []);

  // ③ 验证修复结果
  const newBlock = await ethers.provider.getBlock("latest");
  console.log("\n修复后区块时间:", new Date(newBlock!.timestamp * 1000).toLocaleString());
  console.log("偏差:", Number(newBlock!.timestamp) - sysTime, "秒");
  console.log("✓ 时间已同步");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
