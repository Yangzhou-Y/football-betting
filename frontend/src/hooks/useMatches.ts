/**
 * ============================================================================
 * 赛事数据 Hooks — 合约只读查询（view/pure 函数，不消耗 Gas）
 * ============================================================================
 *
 * 【数据流】
 *   useDeploymentConfig() → 获取当前链的合约地址
 *        ↓
 *   useReadContract()     → wagmi 封装的 viem readContract
 *        ↓
 *   TanStack Query        → 自动缓存、去重、后台刷新
 *
 * 【TanStack Query 缓存策略】
 *   - staleTime: 默认 0（每次挂载都重新获取）
 *   - 交易确认后通过 useWaitForTxAndRefresh 的 invalidateQueries 触发刷新
 *   - 多个组件同时使用同一个 hook（如 useAllMatches）时，
 *     TanStack Query 自动去重，只发一次 RPC 请求
 *
 * 【为什么所有 hook 都有 isReady 守卫？】
 *   useDeploymentConfig 依赖 useAccount().chain，在钱包未连接时 chain 为 undefined。
 *   enabled: isReady && ... 确保在合约地址确定之前不发 RPC 请求，
 *   避免浪费 RPC 配额和产生无意义的错误日志。
 */
"use client";

import { useReadContract, useReadContracts } from "wagmi";
import { useDeploymentConfig } from "@/lib/config";
import type { MatchStruct } from "@/lib/types";
import FootballBettingABI from "@/lib/abi/FootballBetting.json";

export { type MatchStruct };

/** 获取单场比赛的完整信息（Match struct 全部字段） */
export function useMatch(matchId: number) {
  const { contractAddress, isReady, chainId } = useDeploymentConfig();

  return useReadContract({
    address: contractAddress!,
    abi: FootballBettingABI.abi,
    functionName: "getMatch",
    args: [matchId],
    chainId,
    query: { enabled: isReady && contractAddress !== null && matchId > 0 },
  });
}

/**
 * 获取所有比赛列表（Match[] 完整数组）
 *
 * 【性能说明】
 *   getAllMatches() 一次性返回所有比赛的 Match struct 数组。
 *   每个 Match struct 约 7 个存储槽（SLOAD），100 场比赛 ≈ 700 次 SLOAD。
 *   SLOAD 冷读每次 2100 gas，热读（同交易内）100 gas，eth_call 不消耗 gas 但有 RPC 超时风险。
 *
 *   前端分页策略：此 hook 返回全部数据，页面组件通过 .slice() 实现客户端分页，
 *   避免多次 RPC 调用的网络开销。参见 matches/page.tsx 的 PAGE_SIZE 和分页逻辑。
 */
export function useAllMatches() {
  const { contractAddress, isReady, chainId } = useDeploymentConfig();

  return useReadContract({
    address: contractAddress!,
    abi: FootballBettingABI.abi,
    functionName: "getAllMatches",
    chainId,
    query: { enabled: isReady && contractAddress !== null },
  });
}

/** 获取比赛总数（matchCounter 的值） */
export function useMatchCount() {
  const { contractAddress, isReady, chainId } = useDeploymentConfig();

  return useReadContract({
    address: contractAddress!,
    abi: FootballBettingABI.abi,
    functionName: "getMatchCount",
    chainId,
    query: { enabled: isReady && contractAddress !== null },
  });
}

/**
 * 批量获取合约元信息（owner + feeRate + platformBalance + matchCounter）
 *
 * 【为什么用 useReadContracts（复数）而非 4 个独立 useReadContract？】
 *   wagmi 的 useReadContracts 内部调用 viem 的 multicall3，
 *   将 4 个 eth_call 打包进一次 RPC 请求，节省网络往返。
 *   适合获取多个彼此无关的小数据字段。
 */
export function useContractInfo() {
  const { contractAddress, isReady, chainId } = useDeploymentConfig();

  return useReadContracts({
    contracts: [
      { address: contractAddress!, abi: FootballBettingABI.abi, functionName: "owner", chainId },
      { address: contractAddress!, abi: FootballBettingABI.abi, functionName: "platformFeeRate", chainId },
      { address: contractAddress!, abi: FootballBettingABI.abi, functionName: "platformBalance", chainId },
      { address: contractAddress!, abi: FootballBettingABI.abi, functionName: "matchCounter", chainId },
    ],
    query: { enabled: isReady && contractAddress !== null },
  });
}
