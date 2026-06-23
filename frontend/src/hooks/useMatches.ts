"use client";

import { useReadContract, useReadContracts } from "wagmi";
import { useDeploymentConfig } from "@/lib/config";
import FootballBettingABI from "@/lib/abi/FootballBetting.json";

/** 比赛数据的 TypeScript 类型（匹配合约 Match struct） */
export interface MatchData {
  matchName: string;
  homeTeam: string;
  awayTeam: string;
  poolHome: bigint;
  poolDraw: bigint;
  poolAway: bigint;
  totalPool: bigint;
  minBet: bigint;
  maxBet: bigint;
  startTime: bigint;
  deadline: bigint;
  result: number;
  status: number;
  homeScore: number;
  awayScore: number;
  settled: boolean;
  allowDraw: boolean;
}

/** 获取单场比赛详情 */
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

/** 获取所有比赛列表 */
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

/** 获取比赛总数 */
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

/** 批量获取合约基本信息 */
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
