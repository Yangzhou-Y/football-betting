"use client";

import { useQuery } from "@tanstack/react-query";
import { usePublicClient, useBlockNumber } from "wagmi";
import { getContractEvents } from "viem/actions";
import { useDeploymentConfig } from "@/lib/config";
import FootballBettingABI from "@/lib/abi/FootballBetting.json";

const BLOCK_CHUNK = 100_000n;

/**
 * ============================================================================
 * 参与人数 Hook — 扫描 BetPlaced 事件，统计每场比赛的去重参与地址数
 * ============================================================================
 *
 * 【为什么用事件而非合约查询？】
 *   合约 Match 结构体没有 participantCount 字段（避免重新部署）。
 *   每场比赛的参与人数 = 该场 BetPlaced 事件中出现过的去重用户地址数。
 *
 * 【实现方式】
 *   ① 一次性扫描全量 BetPlaced 事件（按 100k 块分片，复用排行榜同款逻辑）
 *   ② 按 matchId 聚合，对 user 去重计数
 *   ③ 返回 Map<matchId(number), 参与人数>
 *
 * 【近似性说明】
 *   用户若投注后取消（cancelBet 不发事件），仍会被计入。
 *   作为卡片展示的近似指标可接受；如需精确值需链上记录或链下索引。
 *
 * 【缓存】
 *   staleTime 60s，避免页面切换重复扫描。
 */
export function useParticipantCounts() {
  const { contractAddress, deployBlock } = useDeploymentConfig();
  const client = usePublicClient();
  const { data: currentBlock } = useBlockNumber();

  const fromBlock = deployBlock ? BigInt(deployBlock) : 0n;

  const { data } = useQuery({
    queryKey: ["participantCounts", contractAddress, fromBlock.toString()],
    queryFn: async () => {
      const counts = new Map<number, number>();
      if (!client || !contractAddress || !currentBlock) return counts;

      const sets = new Map<number, Set<string>>();
      for (let from = fromBlock; from < currentBlock; from += BLOCK_CHUNK) {
        const to = from + BLOCK_CHUNK - 1n > currentBlock ? currentBlock : from + BLOCK_CHUNK - 1n;
        const logs = await getContractEvents(client, {
          address: contractAddress,
          abi: FootballBettingABI.abi,
          eventName: "BetPlaced",
          fromBlock: from,
          toBlock: to,
        });
        for (const log of logs) {
          const { matchId, user } = (log as unknown as { args: { matchId: bigint; user: string } }).args;
          const mid = Number(matchId);
          let set = sets.get(mid);
          if (!set) {
            set = new Set<string>();
            sets.set(mid, set);
          }
          set.add(user.toLowerCase());
        }
      }

      for (const [mid, set] of sets) counts.set(mid, set.size);
      return counts;
    },
    enabled: !!client && !!contractAddress && !!currentBlock,
    staleTime: 60_000,
  });

  return data ?? new Map<number, number>();
}
