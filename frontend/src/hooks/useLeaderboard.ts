"use client";

import { useMemo, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePublicClient, useBlockNumber } from "wagmi";
import { getContractEvents } from "viem/actions";
import { useDeploymentConfig } from "@/lib/config";
import { useAllMatches } from "@/hooks/useMatches";
import type { MatchStruct } from "@/lib/types";
import FootballBettingABI from "@/lib/abi/FootballBetting.json";
import { MatchStatus } from "@/lib/constants";
import { shortAddress } from "@/lib/utils";

const TOP_N = 100;
const BLOCK_CHUNK = 100_000n;

export interface LeaderboardEntry {
  address: string;
  shortAddress: string;
  totalBets: number;
  wins: number;
  totalWagered: bigint;
  totalRewards: bigint;
  profit: bigint;
  winRate: number;
}

interface RawBetEvent {
  matchId: bigint;
  user: string;
  amount: bigint;
}

interface RawRewardEvent {
  matchId: bigint;
  user: string;
  rewardAmount: bigint;
}

export interface ScanProgress {
  current: number;
  total: number;
}

/**
 * ============================================================================
 * 排行榜 Hook — 链上事件扫描 + 本地聚合统计
 * ============================================================================
 *
 * 【工作原理】
 *   排行榜不是合约内置功能，而是前端通过扫描历史事件（BetPlaced +
 *   RewardClaimed）在本地构建的统计数据。
 *
 *   流程：
 *   ① 确定扫描的区块范围（fromBlock=部署块, toBlock=当前最新块）
 *   ② 将范围切分为 100k 块一组的分片（BLOCK_CHUNK）
 *   ③ 逐片调用 getContractEvents 拉取 BetPlaced + RewardClaimed 事件
 *   ④ 在 aggregateLeaderboard() 中按用户地址聚合 → 盈亏/胜率 → 排序
 *   ⑤ 取前 TOP_N (100) 名返回
 *
 * 【为什么分片？】
 *   多数 RPC 节点对 eth_getLogs 有单次查询的最大区块范围限制（约 100k-500k 块）。
 *   分片 + 顺序执行可避免 RPC 超时和限流。
 *
 * 【缓存策略】
 *   - staleTime: 60_000（1分钟），避免频繁页面切换时重复请求
 *   - 查询键 `["leaderboard", ...]` 被 useWaitForTxAndRefresh 排除，
 *     避免每次投注都重扫全量事件
 *
 * 【排列顺序】
 *   profit（盈亏=总奖励-总投注）降序 → winRate 降序
 */
export function useLeaderboard() {
  const { contractAddress, deployBlock } = useDeploymentConfig() as { contractAddress: `0x${string}` | null; usdtAddress: `0x${string}` | null; platformFeeRate: number; isReady: boolean; deployBlock?: number; chainId: number };
  const { data: matches, isLoading: matchesLoading } = useAllMatches();
  const client = usePublicClient();
  const { data: currentBlock } = useBlockNumber();

  const matchList: MatchStruct[] = (matches as MatchStruct[]) ?? [];

  const fromBlock = deployBlock ? BigInt(deployBlock) : null;

  const [scanProgress, setScanProgress] = useState<ScanProgress>({ current: 0, total: 0 });
  const progressRef = useRef<ScanProgress>({ current: 0, total: 0 });

  const { data: leaderboard, isLoading, isError, error } = useQuery({
    queryKey: ["leaderboard", contractAddress, fromBlock?.toString()],
    queryFn: async () => {
      if (!client || !contractAddress || !currentBlock || !fromBlock) return [];

      // 按块区间分片拉取，避免单次 eth_getLogs 超限
      const chunks: { from: bigint; to: bigint }[] = [];
      for (let from = fromBlock; from < currentBlock; from += BLOCK_CHUNK) {
        const to = from + BLOCK_CHUNK - 1n > currentBlock ? currentBlock : from + BLOCK_CHUNK - 1n;
        chunks.push({ from, to });
      }

      setScanProgress({ current: 0, total: chunks.length });
      progressRef.current = { current: 0, total: chunks.length };

      const allBets: RawBetEvent[] = [];
      const allRewards: RawRewardEvent[] = [];

      // 逐片拉取（顺序执行避免 RPC 限流）
      for (let i = 0; i < chunks.length; i++) {
        const { from, to } = chunks[i];
        const [betLogs, rewardLogs] = await Promise.all([
          getContractEvents(client, {
            address: contractAddress,
            abi: FootballBettingABI.abi,
            eventName: "BetPlaced",
            fromBlock: from,
            toBlock: to,
          }),
          getContractEvents(client, {
            address: contractAddress,
            abi: FootballBettingABI.abi,
            eventName: "RewardClaimed",
            fromBlock: from,
            toBlock: to,
          }),
        ]);

        for (const log of betLogs) {
          const { matchId, user, amount } = (log as unknown as { args: RawBetEvent }).args;
          allBets.push({ matchId, user: user.toLowerCase(), amount });
        }
        for (const log of rewardLogs) {
          const { matchId, user, rewardAmount } = (log as unknown as { args: RawRewardEvent }).args;
          allRewards.push({ matchId, user: user.toLowerCase(), rewardAmount });
        }

        const next = { current: i + 1, total: chunks.length };
        setScanProgress(next);
        progressRef.current = next;
      }

      return aggregateLeaderboard(allBets, allRewards).slice(0, TOP_N);
    },
    enabled: !!client && !!contractAddress && !matchesLoading && !!currentBlock && !!fromBlock,
    staleTime: 60_000,
  });

  const settledMatches = useMemo(
    () => matchList.filter((m) => m.status === MatchStatus.Settled),
    [matchList],
  );

  return { leaderboard: leaderboard ?? [], settledMatches, isLoading: isLoading || matchesLoading || !currentBlock, isError, error, scanProgress };
}

export function aggregateLeaderboard(
  betLogs: RawBetEvent[],
  rewardLogs: RawRewardEvent[],
): LeaderboardEntry[] {
  const userMap = new Map<
    string,
    {
      totalBets: number;
      wins: number;
      totalWagered: bigint;
      totalRewards: bigint;
      betMatchSet: Set<string>;
      winMatchSet: Set<string>;
    }
  >();

  for (const log of betLogs) {
    const key = `${log.matchId}-${log.user}`;
    let entry = userMap.get(log.user);
    if (!entry) {
      entry = {
        totalBets: 0,
        wins: 0,
        totalWagered: 0n,
        totalRewards: 0n,
        betMatchSet: new Set(),
        winMatchSet: new Set(),
      };
      userMap.set(log.user, entry);
    }
    if (!entry.betMatchSet.has(key)) {
      entry.betMatchSet.add(key);
      entry.totalBets++;
    }
    entry.totalWagered += log.amount;
  }

  for (const log of rewardLogs) {
    const key = `${log.matchId}-${log.user}`;
    const entry = userMap.get(log.user);
    if (entry) {
      entry.totalRewards += log.rewardAmount;
      if (log.rewardAmount > 0n && !entry.winMatchSet.has(key)) {
        entry.winMatchSet.add(key);
        entry.wins++;
      }
    }
  }

  const entries: LeaderboardEntry[] = [];
  for (const [address, data] of userMap) {
    const profit = data.totalRewards - data.totalWagered;

    entries.push({
      address,
      shortAddress: shortAddress(address),
      totalBets: data.totalBets,
      wins: data.wins,
      totalWagered: data.totalWagered,
      totalRewards: data.totalRewards,
      profit,
      winRate: data.totalBets > 0 ? Math.round((data.wins / data.totalBets) * 1000) / 10 : 0,
    });
  }

  entries.sort((a, b) => {
    if (a.profit > b.profit) return -1;
    if (a.profit < b.profit) return 1;
    if (a.winRate > b.winRate) return -1;
    if (a.winRate < b.winRate) return 1;
    return 0;
  });

  return entries;
}
