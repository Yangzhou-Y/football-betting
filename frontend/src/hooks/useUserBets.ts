/**
 * ============================================================================
 * 用户投注数据 Hooks — 链上只读查询当前用户的投注记录
 * ============================================================================
 *
 * 【三个 hook 的分工】
 *   useUserAllBets()   → getUserAllBets(user) 一次性获取用户所有投注（5 个并行数组）
 *   useUserBet(id)     → getUserBet(matchId, user) 获取单场投注详情（含 hasBet 标记）
 *   usePreviewReward(id) → previewReward(matchId, user) 预览预期奖励（不实际领取）
 *
 * 【getUserAllBets 的复杂度】
 *   该函数遍历所有比赛（matchCounter 次），每次检查 bets[i][user].amount > 0。
 *   时间复杂度 = O(matchCounter)，纯 eth_call 不消耗用户 Gas，
 *   但 RPC 节点可能对 eth_call 有 gas limit 限制。若比赛总数超过数千场，
 *   可能需要改为链下索引方案。
 *
 * 【previewReward vs claimReward 的区别】
 *   previewReward 是只读函数，返回计算后的奖励金额但不修改任何状态。
 *   claimReward  是写入函数，标记已领取 + 执行 USDT 转账。
 *   前端在比赛详情页调用 previewReward 显示可领取金额，
 *   用户点击"领取"后才调用 claimReward。
 */
"use client";

import { useReadContract } from "wagmi";
import { useAccount } from "wagmi";
import { useDeploymentConfig } from "@/lib/config";
import type { UserBetData, UserAllBetsTuple } from "@/lib/types";
import FootballBettingABI from "@/lib/abi/FootballBetting.json";

export { type UserBetData, type UserAllBetsTuple };

/** 获取当前用户在所有比赛中的投注记录（返回 5 个并行数组） */
export function useUserAllBets() {
  const { address } = useAccount();
  const { contractAddress, isReady, chainId } = useDeploymentConfig();

  return useReadContract({
    address: contractAddress!,
    abi: FootballBettingABI.abi,
    functionName: "getUserAllBets",
    args: address ? [address] : undefined,
    chainId,
    query: { enabled: isReady && !!contractAddress && !!address },
  });
}

/**
 * 获取当前用户在指定比赛中的投注详情
 *
 * @returns data 包含 amount/betOn/timestamp/reward/claimed 以及派生的 hasBet 标记
 *          hasBet 用于快速判断用户是否参与了该比赛（amount > 0）
 */
export function useUserBet(matchId: number) {
  const { address } = useAccount();
  const { contractAddress, isReady, chainId } = useDeploymentConfig();

  const { data: raw, ...rest } = useReadContract({
    address: contractAddress!,
    abi: FootballBettingABI.abi,
    functionName: "getUserBet",
    args: address && matchId > 0 ? [matchId, address] : undefined,
    chainId,
    query: { enabled: isReady && !!contractAddress && !!address && matchId > 0 },
  });

  // getUserBet 返回元组 [amount, betOn, timestamp, reward, claimed]
  // 映射为命名字段便于组件使用
  const arr = raw as [bigint, number, bigint, bigint, boolean] | undefined;
  const data = arr
    ? {
        amount: arr[0],
        betOn: arr[1],
        timestamp: arr[2],
        reward: arr[3],
        claimed: arr[4],
        hasBet: arr[0] > 0n,  // 派生字段：快速判断是否有投注
      } satisfies UserBetData
    : undefined;

  return { data, ...rest };
}

/** 预览当前用户在指定比赛中的预期奖励（纯计算，不消耗 Gas） */
export function usePreviewReward(matchId: number) {
  const { address } = useAccount();
  const { contractAddress, isReady, chainId } = useDeploymentConfig();

  return useReadContract({
    address: contractAddress!,
    abi: FootballBettingABI.abi,
    functionName: "previewReward",
    args: address && matchId > 0 ? [matchId, address] : undefined,
    chainId,
    query: { enabled: isReady && !!contractAddress && !!address && matchId > 0 },
  });
}
