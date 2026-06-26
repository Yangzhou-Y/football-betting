/**
 * ============================================================================
 * 管理员管理脚本 — 添加/移除/查看管理员（仅 owner 可操作）
 * ============================================================================
 *
 * 【权限模型说明】
 * 合约有两层管理权限：
 *   - owner（合约部署者）：拥有最高权限，可调用 addAdmin/removeAdmin
 *   - admins（由 owner 添加）：拥有日常管理权限（创建赛事、开放/关闭投注等），
 *     但无法添加/移除其他管理员
 *
 * 【用法】
 *   # 查看管理员列表和 owner
 *   ADMIN_ACTION=list npx hardhat run scripts/admin.ts --network confluxTestnet
 *
 *   # 查看指定地址是否为管理员
 *   ADMIN_ACTION=list ADMIN_ADDRESS=0x... npx hardhat run scripts/admin.ts --network confluxTestnet
 *
 *   # 添加管理员
 *   ADMIN_ACTION=add ADMIN_ADDRESS=0x... npx hardhat run scripts/admin.ts --network confluxTestnet
 *
 *   # 移除管理员
 *   ADMIN_ACTION=remove ADMIN_ADDRESS=0x... npx hardhat run scripts/admin.ts --network confluxTestnet
 *
 * 【环境变量】
 *   在 .env 文件中设置：
 *     ADMIN_ACTION=add     # add | remove | list
 *     ADMIN_ADDRESS=0x...   # 要添加/移除/查询的地址
 */
import { ethers } from "hardhat";
import { FootballBetting__factory } from "../typechain-types";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config();

/** 从 deployments/<network>.json 读取已部署合约地址 */
function loadContractAddress(): string {
  const network = process.env.HARDHAT_NETWORK || "localhost";
  const deployDir = path.join(__dirname, "..", "deployments");
  const networkFile = path.join(deployDir, `${network}.json");
  if (fs.existsSync(networkFile)) {
    return JSON.parse(fs.readFileSync(networkFile, "utf-8")).address;
  }
  throw new Error("未找到部署记录");
}

async function main() {
  const [signer] = await ethers.getSigners();
  const contractAddr = loadContractAddress();
  // 使用 typechain-types 生成的类型安全工厂连接合约
  const contract = FootballBetting__factory.connect(contractAddr, signer);

  const action = process.env.ADMIN_ACTION || "list";
  const targetAddr = process.env.ADMIN_ADDRESS || "";

  console.log("合约:", contractAddr);
  console.log("操作者:", signer.address);

  if (action === "list") {
    // 查看 owner 地址
    const owner = await contract.owner();
    console.log("Owner:", owner);
    // 如果传了 ADMIN_ADDRESS，检查该地址是否为管理员
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

main()
  .then(() => process.exit(0))
  .catch((e: Error) => { console.error(e); process.exit(1); });
