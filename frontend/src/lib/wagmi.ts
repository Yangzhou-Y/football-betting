import { defineChain } from "viem";

// ============================================================================
// 链定义 — Hardhat 本地链 + Conflux eSpace 主网/测试网
// ============================================================================

/** Hardhat 本地开发链（chainId=31337） */
export const hardhatLocal = defineChain({
  id: 31337,
  name: "Hardhat Local",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["http://127.0.0.1:8545"] },
  },
});

/** Conflux eSpace 测试网（chainId=71） */
export const confluxTestnet = defineChain({
  id: 71,
  name: "Conflux eSpace Testnet",
  nativeCurrency: { name: "CFX", symbol: "CFX", decimals: 18 },
  rpcUrls: {
    default: { http: ["/rpc/conflux-testnet"] },
  },
  blockExplorers: {
    default: { name: "ConfluxScan", url: "https://evmtestnet.confluxscan.io" },
  },
  fees: {
    // Conflux eSpace 使用 1559 兼容模式，gas 价格通常较高
    // 设置合理的默认值避免 MetaMask 估算异常
    maxFeePerGas: 100_000_000_000n, // 100 Gwei 上限
    maxPriorityFeePerGas: 3_000_000_000n, // 3 Gwei tip
  },
});

/** Conflux eSpace 主网（chainId=1030） */
export const confluxMainnet = defineChain({
  id: 1030,
  name: "Conflux eSpace",
  nativeCurrency: { name: "CFX", symbol: "CFX", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://evm.confluxrpc.com"] },
  },
  blockExplorers: {
    default: { name: "ConfluxScan", url: "https://confluxscan.io" },
  },
  fees: {
    maxFeePerGas: 100_000_000_000n,
    maxPriorityFeePerGas: 3_000_000_000n,
  },
});

const ENABLE_LOCAL = typeof window !== "undefined" && new URL(window.location.href).searchParams.get("local") === "true";

/** 所有支持的网络（主网暂未启用，本地链需 URL 加 ?local=true 才显示） */
export const supportedChains = [
  ...(ENABLE_LOCAL ? [hardhatLocal] : []),
  confluxTestnet,
  // confluxMainnet, // 主网暂未启用
] as const;

/** chainId → 网络名称映射（用于查找部署记录文件） */
export const CHAIN_ID_TO_DEPLOY_FILE: Record<number, string> = {
  31337: "localhost",
  71: "confluxTestnet",
  1030: "confluxMainnet",
};
