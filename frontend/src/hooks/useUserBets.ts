"use client";

import { useReadContract } from "wagmi";
import { useAccount } from "wagmi";
import { useDeploymentConfig } from "@/lib/config";
import FootballBettingABI from "@/lib/abi/FootballBetting.json";

/** 获取当前连接用户的所有投注 */
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
 * 获取用户在指定比赛的投注详情
 * 合约 returns (amount, betOn, timestamp, reward, claimed)
 * 简单 tuple 无 components，viem 解码为数组 [amount, betOn, timestamp, reward, claimed]
 * 此处转换为带名称的对象，方便组件使用
 */
export interface UserBetData {
  amount: bigint;
  betOn: number;
  timestamp: bigint;
  reward: bigint;
  claimed: boolean;
  /** 是否有有效投注（amount > 0） */
  hasBet: boolean;
}

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

  // viem 将简单 tuple 解码为数组 [amount, betOn, timestamp, reward, claimed]
  const data = raw
    ? {
        amount: (raw as any)[0] as bigint,
        betOn: (raw as any)[1] as number,
        timestamp: (raw as any)[2] as bigint,
        reward: (raw as any)[3] as bigint,
        claimed: (raw as any)[4] as boolean,
        hasBet: ((raw as any)[0] as bigint) > 0n,
      } as UserBetData
    : undefined;

  return { data, ...rest };
}

/** 预览用户在指定比赛的应得奖励 */
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
