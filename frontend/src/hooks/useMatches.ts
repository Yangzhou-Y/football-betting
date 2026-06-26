"use client";

import { useReadContract, useReadContracts } from "wagmi";
import { useDeploymentConfig } from "@/lib/config";
import type { MatchStruct } from "@/lib/types";
import FootballBettingABI from "@/lib/abi/FootballBetting.json";

export { type MatchStruct };

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

/** 分页获取比赛列表（page 从 0 开始） */
export function useMatchesPaginated(page: number, pageSize: number) {
  const { contractAddress, isReady, chainId } = useDeploymentConfig();

  return useReadContract({
    address: contractAddress!,
    abi: FootballBettingABI.abi,
    functionName: "getMatchesPaginated",
    args: [page, pageSize],
    chainId,
    query: { enabled: isReady && contractAddress !== null && page >= 0 && pageSize > 0 },
  });
}

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
