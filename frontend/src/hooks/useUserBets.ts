"use client";

import { useReadContract } from "wagmi";
import { useAccount } from "wagmi";
import { useDeploymentConfig } from "@/lib/config";
import type { UserBetData, UserAllBetsTuple } from "@/lib/types";
import FootballBettingABI from "@/lib/abi/FootballBetting.json";

export { type UserBetData, type UserAllBetsTuple };

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

  const arr = raw as [bigint, number, bigint, bigint, boolean] | undefined;
  const data = arr
    ? {
        amount: arr[0],
        betOn: arr[1],
        timestamp: arr[2],
        reward: arr[3],
        claimed: arr[4],
        hasBet: arr[0] > 0n,
      } satisfies UserBetData
    : undefined;

  return { data, ...rest };
}

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
