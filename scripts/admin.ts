/**
 * 管理员管理脚本 — 添加/移除/查看管理员（仅 owner 可操作）
 *
 * 用法：
 *   npx hardhat run scripts/admin.ts --network confluxTestnet
 *
 * 先在 .env 里设置：
 *   ADMIN_ACTION=add     # add | remove | list
 *   ADMIN_ADDRESS=0x...   # 要添加/移除的地址
 */
import { ethers } from "hardhat";
import { FootballBetting__factory } from "../typechain-types";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config();

function loadContractAddress(): string {
  const network = process.env.HARDHAT_NETWORK || "localhost";
  const deployDir = path.join(__dirname, "..", "deployments");
  const networkFile = path.join(deployDir, `${network}.json`);
  if (fs.existsSync(networkFile)) {
    return JSON.parse(fs.readFileSync(networkFile, "utf-8")).address;
  }
  throw new Error("未找到部署记录");
}

async function main() {
  const [signer] = await ethers.getSigners();
  const contractAddr = loadContractAddress();
  const contract = FootballBetting__factory.connect(contractAddr, signer);

  const action = process.env.ADMIN_ACTION || "list";
  const targetAddr = process.env.ADMIN_ADDRESS || "";

  console.log("合约:", contractAddr);
  console.log("操作者:", signer.address);

  if (action === "list") {
    const owner = await contract.owner();
    console.log("Owner:", owner);
    if (targetAddr) {
      const isAdmin = await contract.admins(targetAddr);
      console.log(`${targetAddr} → admin: ${isAdmin}`);
    }
  } else if (action === "add") {
    if (!targetAddr) throw new Error("请在 .env 设置 ADMIN_ADDRESS");
    console.log("添加管理员:", targetAddr);
    const tx = await contract.addAdmin(targetAddr);
    await tx.wait();
    console.log("完成. Tx:", tx.hash);
  } else if (action === "remove") {
    if (!targetAddr) throw new Error("请在 .env 设置 ADMIN_ADDRESS");
    console.log("移除管理员:", targetAddr);
    const tx = await contract.removeAdmin(targetAddr);
    await tx.wait();
    console.log("完成. Tx:", tx.hash);
  }
}

main().catch(console.error);
