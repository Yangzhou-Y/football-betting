/**
 * ============================================================================
 * 赛事创建脚本 — 一键创建 10 场现有比赛
 * ============================================================================
 *
 * 用法：
 *   npx hardhat run scripts/interact.ts --network confluxTestnet
 *
 * 部署后运行此脚本，将之前合约上的所有比赛新加到新合约中。
 * 已结算的比赛只创建不开放，投注中的比赛创建后开放，已创建的只创建。
 */
import { ethers } from "hardhat";
import { FootballBetting__factory, MockERC20__factory } from "../typechain-types";
import * as fs from "fs";
import * as path from "path";
import { U as u, FU as fu } from "./shared/usdt";

function loadDeployRecord(): { address: string; usdtAddress: string } {
  const network = process.env.HARDHAT_NETWORK || "localhost";
  const deployDir = path.join(__dirname, "..", "deployments");
  const networkFile = path.join(deployDir, `${network}.json`);

  if (fs.existsSync(networkFile)) {
    const record = JSON.parse(fs.readFileSync(networkFile, "utf-8"));
    console.log(`从 ${networkFile} 读取部署记录`);
    return { address: record.address, usdtAddress: record.usdtAddress || "" };
  }

  const localFile = path.join(deployDir, "localhost.json");
  if (fs.existsSync(localFile)) {
    const record = JSON.parse(fs.readFileSync(localFile, "utf-8"));
    console.log(`从 ${localFile} 读取部署记录 (回退)`);
    return { address: record.address, usdtAddress: record.usdtAddress || "" };
  }

  throw new Error("未找到部署记录！请先运行 npm run deploy");
}

const RECORD = loadDeployRecord();
const CONTRACT_ADDR = RECORD.address;
const USDT_ADDR = RECORD.usdtAddress;

const hr = (title?: string) => {
  if (title) {
    const pad = Math.max(0, 50 - title.length);
    console.log(`\n┌${"─".repeat(52)}┐`);
    console.log(`│  ${title}${" ".repeat(pad)}│`);
    console.log(`└${"─".repeat(52)}┘`);
  }
};

const short = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

const fmtGas = (g: bigint) => (g > 1_000_000n ? `${(Number(g) / 1_000_000).toFixed(2)}M` : g.toString());

const txInfo = async (receipt: { hash: string; blockNumber: number; gasUsed: bigint; status: number | null } | null, label?: string) => {
  if (!receipt) return;
  const prefix = label ? `[${label}] ` : "";
  console.log(`  ${prefix}tx: ${receipt.hash.slice(0, 20)}...  #${receipt.blockNumber}  Gas: ${fmtGas(receipt.gasUsed)}  ${receipt.status === 1 ? "✓" : "✗"}`);
};

async function main(): Promise<void> {
  const [admin] = await ethers.getSigners();
  const contract = FootballBetting__factory.connect(CONTRACT_ADDR, admin);
  const chainId = (await ethers.provider.getNetwork()).chainId;
  const blockNum = await ethers.provider.getBlockNumber();

  let usdt;
  if (USDT_ADDR) {
    usdt = MockERC20__factory.connect(USDT_ADDR, admin);
  } else {
    throw new Error("部署记录中缺少 usdtAddress！");
  }

  console.log("╔" + "═".repeat(52) + "╗");
  console.log("║" + "  FootballBetting — 创建 10 场比赛".padEnd(52) + "║");
  console.log("╚" + "═".repeat(52) + "╝");
  console.log(`  网络        chainId=${chainId}  区块 #${blockNum}`);
  console.log(`  合约        ${CONTRACT_ADDR}`);
  console.log(`  USDT        ${USDT_ADDR}`);
  console.log(`  管理员      ${admin.address}`);

  // 日期范围：2026-06-24 ~ 2026-06-27（北京时间）
  // month=5 = June (0-indexed)
  const minBet = u("0.01");
  const maxBet = u("100");
  const allowDraw = true;

  type MatchDef = { name: string; home: string; away: string; start: number; open: boolean };

  const matches: MatchDef[] = [
    // ── 6 月 24 日 ──
    { name: "世界杯小组赛", home: "葡萄牙", away: "乌兹别克斯坦", start: Date.UTC(2026, 5, 23, 17, 0, 0) / 1000, open: true },
    { name: "世界杯小组赛", home: "英格兰", away: "加纳",       start: Date.UTC(2026, 5, 23, 20, 0, 0) / 1000, open: true },
    { name: "世界杯小组赛", home: "巴拿马", away: "克罗地亚",   start: Date.UTC(2026, 5, 23, 23, 0, 0) / 1000, open: true },
    { name: "世界杯小组赛", home: "哥伦比亚", away: "刚果（金）", start: Date.UTC(2026, 5, 24,  2, 0, 0) / 1000, open: true },
    // ── 6 月 25 日 ──
    { name: "世界杯小组赛", home: "瑞士", away: "加拿大",       start: Date.UTC(2026, 5, 24, 19, 0, 0) / 1000, open: false },
    { name: "世界杯小组赛", home: "波黑", away: "卡塔尔",       start: Date.UTC(2026, 5, 24, 19, 0, 0) / 1000, open: false },
    { name: "世界杯小组赛", home: "苏格兰", away: "巴西",       start: Date.UTC(2026, 5, 24, 22, 0, 0) / 1000, open: false },
    { name: "世界杯小组赛", home: "摩洛哥", away: "海地",       start: Date.UTC(2026, 5, 24, 22, 0, 0) / 1000, open: false },
    { name: "世界杯小组赛", home: "南非", away: "韩国",         start: Date.UTC(2026, 5, 25,  1, 0, 0) / 1000, open: false },
    { name: "世界杯小组赛", home: "捷克", away: "墨西哥",       start: Date.UTC(2026, 5, 25,  1, 0, 0) / 1000, open: false },
  ];

  const bjTime = (ts: number) => new Date(ts * 1000).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });

  console.log(`\n  共 ${matches.length} 场比赛 → 其中 ${matches.filter(m=>m.open).length} 场会开放投注\n`);

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const deadline = m.start - 600; // 开赛前 10 分钟
    const mn = ethers.encodeBytes32String(m.name);
    const ht = ethers.encodeBytes32String(m.home);
    const at = ethers.encodeBytes32String(m.away);

    console.log(`  #${i + 1} ${m.home} vs ${m.away}`);
    console.log(`     开赛 ${bjTime(m.start)}  截止 ${bjTime(deadline)}  ${m.open ? "→ 开放投注" : ""}`);

    const tx = await contract.createMatch(mn, ht, at, m.start, deadline, minBet, maxBet, allowDraw);
    const r = await tx.wait();
    await txInfo(r, `createMatch #${i + 1}`);

    if (m.open) {
      const txOpen = await contract.openMatch(i + 1);
      const rOpen = await txOpen.wait();
      await txInfo(rOpen, `openMatch #${i + 1}`);
    }
  }

  // ══════════════════════════════════════════════════════════════
  hr("完成");
  // ══════════════════════════════════════════════════════════════
  const cnt = await contract.matchCounter();
  console.log(`  ✓  共创建 ${cnt} 场比赛`);
  console.log(`  ✓  其中 ${matches.filter(m=>m.open).length} 场已开放投注`);
  console.log(`  ✓  其余比赛处于"已创建"状态，管理员可在后台手动开放`);
  console.log(`  ✓  比赛名称使用 bytes32 存储，支持中英文双向翻译`);
  console.log();
}

main()
  .then(() => process.exit(0))
  .catch(async (error: Error) => {
    console.error("\n╔" + "═".repeat(52) + "╗");
    console.error("║  创建失败".padEnd(52) + "║");
    console.error("╚" + "═".repeat(52) + "╝");
    console.error(error);
    process.exit(1);
  });
