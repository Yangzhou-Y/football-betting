"use client";

import { useReadContract } from "wagmi";
import { useAccount } from "wagmi";
import { useDeploymentConfig } from "@/lib/config";
import FootballBettingABI from "@/lib/abi/FootballBetting.json";

/** 判断当前连接的钱包是否为合约管理员 */
export function useIsAdmin() {
  const { address } = useAccount();
  const { contractAddress, isReady, chainId } = useDeploymentConfig();

  const { data: owner } = useReadContract({
    address: contractAddress!,
    abi: FootballBettingABI.abi,
    functionName: "owner",
    chainId,
    query: { enabled: isReady && contractAddress !== null },
  });

  return {
    isAdmin: !!(isReady && address && owner && (address as string).toLowerCase() === (owner as string).toLowerCase()),
    isLoading: !isReady || (isReady && owner === undefined),
  };
}
