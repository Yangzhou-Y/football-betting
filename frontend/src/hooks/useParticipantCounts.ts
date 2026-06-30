"use client";

import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePublicClient, useBlockNumber } from "wagmi";
import { getContractEvents } from "viem/actions";
import { useDeploymentConfig } from "@/lib/config";
import { getLastScannedBlock, saveScannedBlock, clearEventScanCache, stringifyWithBigInt, parseWithBigInt } from "@/lib/eventScanCache";
import FootballBettingABI from "@/lib/abi/FootballBetting.json";

const BLOCK_CHUNK = 100_000n;
const CACHE_KEY = "participantCounts_events";

/**
 * ============================================================================
 * 参与人数 Hook — 扫描 BetPlaced 事件，统计每场比赛的去重参与地址数
 * ============================================================================
 *
 * 【为什么用事件而非合约查询？】
 *   合约 Match 结构体没有 participantCount 字段（避免重新部署）。
 *   每场比赛的参与人数 = 该场 BetPlaced 事件中出现过的去重用户地址数。
 *
 * 【实现方式 — 增量扫描】
 *   ① 首次加载：扫描全量 BetPlaced 事件，缓存到 localStorage
 *   ② 后续加载：从缓存恢复 + 只扫描新块（增量）
 *   ③ 按 matchId 聚合，对 user 去重计数
 *   ④ 返回 Map<matchId(number), 参与人数>
 *
 * 【近似性说明】
 *   用户若投注后取消（cancelBet 不发事件），仍会被计入。
 *   作为卡片展示的近似指标可接受；如需精确值需链上记录或链下索引。
 *
 * 【缓存策略】
 *   - staleTime: 60s，避免页面切换重复扫描
 *   - localStorage：仅存储 BetPlaced 事件，大小管理上限 200k 条
 *   - 增量扫描：每小时新块约 300 个，从 ~30s 降至 ~1s
 */
export function useParticipantCounts() {
  const { contractAddress, deployBlock } = useDeploymentConfig();
  const client = usePublicClient();
  const { data: currentBlock } = useBlockNumber();

  const fromBlock = deployBlock ? BigInt(deployBlock) : null;

  // 从 localStorage 恢复缓存事件
  const getCachedEvents = useCallback(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY)
        ? parseWithBigInt<Array<{
            matchId: bigint;
            user: string;
          }>>(localStorage.getItem(CACHE_KEY)!)
        : [];
      return cached;
    } catch {
      return [];
    }
  }, []);

  // 保存事件到 localStorage
  const saveCachedEvents = useCallback((events: Array<{ matchId: bigint; user: string }>, lastBlock: number) => {
    try {
      // 大小管理：超过 200k 条则清空
      if (events.length > 200_000) {
        localStorage.removeItem(CACHE_KEY);
        clearEventScanCache(contractAddress ?? "", "participantCounts");
      } else {
        localStorage.setItem(CACHE_KEY, stringifyWithBigInt(events));
        saveScannedBlock(contractAddress ?? "", "participantCounts", lastBlock);
      }
    } catch (err) {
      // localStorage 满或被禁用，静默失败
      console.debug("Cache save failed:", err);
    }
  }, [contractAddress]);

  const { data } = useQuery({
    queryKey: ["participantCounts", contractAddress, fromBlock?.toString()],
    queryFn: async () => {
      const counts = new Map<number, number>();
      if (!client || !contractAddress || !currentBlock || !fromBlock) return counts;

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // ① 恢复历史缓存事件
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      const cachedEvents = getCachedEvents();
      const lastScannedBlock = getLastScannedBlock(contractAddress, "participantCounts");

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // ② 计算增量扫描范围
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      let startBlock = fromBlock;
      const allEvents = [...cachedEvents];

      if (lastScannedBlock !== null) {
        if (lastScannedBlock > Number(currentBlock)) {
          // 链回滚，清空缓存
          clearEventScanCache(contractAddress, "participantCounts");
          allEvents.length = 0;
        } else if (lastScannedBlock >= Number(fromBlock)) {
          startBlock = BigInt(lastScannedBlock + 1);
        }
      }

      // 若已扫到最新，直接返回
      if (startBlock >= currentBlock) {
        const sets = new Map<number, Set<string>>();
        for (const { matchId, user } of allEvents) {
          const mid = Number(matchId);
          let set = sets.get(mid);
          if (!set) {
            set = new Set<string>();
            sets.set(mid, set);
          }
          set.add(user.toLowerCase());
        }
        for (const [mid, set] of sets) counts.set(mid, set.size);
        return counts;
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // ③ 增量扫描新块
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      for (let from = startBlock; from < currentBlock; from += BLOCK_CHUNK) {
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
          allEvents.push({ matchId, user: user.toLowerCase() });
        }
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // ④ 保存到缓存并计算
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      saveCachedEvents(allEvents, Number(currentBlock));

      // 按 matchId 聚合，去重计数
      const sets = new Map<number, Set<string>>();
      for (const { matchId, user } of allEvents) {
        const mid = Number(matchId);
        let set = sets.get(mid);
        if (!set) {
          set = new Set<string>();
          sets.set(mid, set);
        }
        set.add(user);
      }

      for (const [mid, set] of sets) counts.set(mid, set.size);
      return counts;
    },
    enabled: !!client && !!contractAddress && !!currentBlock && !!fromBlock,
    staleTime: 60_000,
  });

  return data ?? new Map<number, number>();
}
