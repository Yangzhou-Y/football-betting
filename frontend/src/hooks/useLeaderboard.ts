"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePublicClient, useBlockNumber } from "wagmi";
import { getContractEvents } from "viem/actions";
import { useDeploymentConfig } from "@/lib/config";
import { useAllMatches } from "@/hooks/useMatches";
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

export function useLeaderboard() {
  const { contractAddress, deployBlock } = useDeploymentConfig() as { contractAddress: `0x${string}` | null; usdtAddress: `0x${string}` | null; platformFeeRate: number; isReady: boolean; deployBlock?: number; chainId: number };
  const { data: matches, isLoading: matchesLoading } = useAllMatches();
  const client = usePublicClient();
  const { data: currentBlock } = useBlockNumber();

  const matchList = (matches as any[]) ?? [];

  const fromBlock = deployBlock ? BigInt(deployBlock) : 0n;

  const { data: leaderboard, isLoading, isError, error } = useQuery({
    queryKey: ["leaderboard", contractAddress, fromBlock.toString()],
    queryFn: async () => {
      if (!client || !contractAddress || !currentBlock) return [];

      // 按块区间分片拉取，避免单次 eth_getLogs 超限
      const chunks: { from: bigint; to: bigint }[] = [];
      for (let from = fromBlock; from < currentBlock; from += BLOCK_CHUNK) {
        const to = from + BLOCK_CHUNK - 1n > currentBlock ? currentBlock : from + BLOCK_CHUNK - 1n;
        chunks.push({ from, to });
      }

      const allBets: RawBetEvent[] = [];
      const allRewards: RawRewardEvent[] = [];

      // 逐片拉取（顺序执行避免 RPC 限流）
      for (const { from, to } of chunks) {
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

        for (const log of betLogs as any[]) {
          allBets.push({
            matchId: BigInt(log.args.matchId),
            user: (log.args.user as string).toLowerCase(),
            amount: BigInt(log.args.amount),
          });
        }
        for (const log of rewardLogs as any[]) {
          allRewards.push({
            matchId: BigInt(log.args.matchId),
            user: (log.args.user as string).toLowerCase(),
            rewardAmount: BigInt(log.args.rewardAmount),
          });
        }
      }

      return aggregateLeaderboard(allBets, allRewards).slice(0, TOP_N);
    },
    enabled: !!client && !!contractAddress && !matchesLoading && !!currentBlock,
    staleTime: 60_000,
  });

  const settledMatches = useMemo(
    () => matchList.filter((m: any) => m.status === MatchStatus.Settled),
    [matchList],
  );

  return { leaderboard: leaderboard ?? [], settledMatches, isLoading: isLoading || matchesLoading, isError, error };
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
