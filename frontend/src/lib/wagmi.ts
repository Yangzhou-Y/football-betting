import { defineChain } from "viem";

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
    default: { http: ["https://evmtestnet.confluxrpc.com"] },
  },
  blockExplorers: {
    default: { name: "ConfluxScan", url: "https://evmtestnet.confluxscan.io" },
  },
});

/** 所有支持的网络 */
export const supportedChains = [confluxTestnet] as const;

/** chainId → 网络名称映射（用于查找部署记录文件） */
export const CHAIN_ID_TO_DEPLOY_FILE: Record<number, string> = {
  31337: "localhost",
  71: "confluxTestnet",
};
