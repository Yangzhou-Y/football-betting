"use client";

import { useAccount } from "wagmi";
// 自动导入部署记录（deploy.ts 会同步写入这些文件）
import localhostData from "./deployments/localhost.json";
import confluxTestnetData from "./deployments/confluxTestnet.json";
// ============================================================================
// 部署记录 — 由 deploy.ts 自动写入，无需手动修改
// ============================================================================

export interface DeploymentRecord {
  contractAddress: `0x${string}`;
  usdtAddress: `0x${string}`;
  platformFeeRate: number;
  deployBlock?: number;
}

const DEPLOYMENTS: Record<number, DeploymentRecord> = {
  31337: localhostData as DeploymentRecord,
  71: confluxTestnetData as DeploymentRecord,
};

/**
 * Hook: 根据当前钱包连接的链 ID 返回合约配置
 */
export function useDeploymentConfig() {
  const { chain } = useAccount();
  // 未连接钱包时回退到受支持链中的第一个（本地开发→31337, 测试网→71）
  const chainId = chain?.id ?? (DEPLOYMENTS[31337] ? 31337 : 71);
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
