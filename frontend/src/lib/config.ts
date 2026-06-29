/**
 * ============================================================================
 * 合约部署配置 Hook — 根据钱包连接的链 ID 自动选择正确的合约地址
 * ============================================================================
 *
 * 【多链支持机制】
 *   项目支持两个网络：
 *   - chainId 31337 → Hardhat Local（本地开发，local host.json）
 *   - chainId 71    → Conflux eSpace Testnet（confluxTestnet.json）
 *
 *   部署记录由 deploy.ts 在部署后自动写入以下两个文件：
 *   - frontend/src/lib/deployments/localhost.json
 *   - frontend/src/lib/deployments/confluxTestnet.json
 *
 *   前端通过静态 import 直接导入这些 JSON 文件（TypeScript resolveJsonModule），
 *   构建时被打包进 JS bundle，无需运行时 fetch。
 *
 * 【chainId 回退逻辑】
 *   ① 优先使用钱包当前连接的 chain.id
 *   ② 若钱包未连接（chain 为 undefined），回退到测试网（71）
 *      - 测试网 RPC（Conflux eSpace Testnet）是公开可用的 HTTPS 端点
 *      - 本地 Hardhat 节点（31337）仅在开发者连接 MetaMask 时使用
 *   这确保 Vercel 部署环境未连接钱包也能正常加载赛事数据。
 *
 * 【isReady 标记的作用】
 *   isReady 为 true 时才发起合约调用，避免在钱包未连接时产生 RPC 错误。
 *   所有使用 useDeploymentConfig 的 hook 都将 isReady 作为 query enabled 的前置条件。
 */
"use client";

import { useAccount } from "wagmi";
// 部署记录由 deploy.ts 自动同步写入，无需手动修改
import localhostData from "./deployments/localhost.json";
import confluxTestnetData from "./deployments/confluxTestnet.json";

export interface DeploymentRecord {
  contractAddress: `0x${string}`;
  usdtAddress: `0x${string}`;
  platformFeeRate: number;
  deployBlock: number;  // 部署时的区块号，用于排行榜和参与人数事件扫描的起始块（必填，避免全链扫描）
}

/** chainId → 部署记录映射表 */
const DEPLOYMENTS: Record<number, DeploymentRecord> = {
  31337: localhostData as DeploymentRecord,
  71: confluxTestnetData as DeploymentRecord,
};

export function useDeploymentConfig() {
  const { chain } = useAccount();
  // 未连接钱包时默认使用测试网（71），因为测试网 RPC 公开可用，本地 Hardhat 仅开发时运行
  const chainId = chain?.id ?? 71;
  const record = DEPLOYMENTS[chainId];

  return {
    contractAddress: record?.contractAddress ?? null,
    usdtAddress: record?.usdtAddress ?? null,
    platformFeeRate: record?.platformFeeRate ?? 200,
    deployBlock: record?.deployBlock,
    chainId,
    isReady: !!record,
  } as const;
}
