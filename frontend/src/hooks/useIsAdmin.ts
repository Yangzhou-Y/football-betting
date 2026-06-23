"use client";

import { useReadContracts } from "wagmi";
import { useAccount } from "wagmi";
import { useDeploymentConfig } from "@/lib/config";
import FootballBettingABI from "@/lib/abi/FootballBetting.json";

export function useIsAdmin() {
  const { address } = useAccount();
  const { contractAddress, isReady, chainId } = useDeploymentConfig();
  const { data, isLoading } = useReadContracts({
    contracts: [
      {
        address: contractAddress!,
        abi: FootballBettingABI.abi,
        functionName: "owner",
        chainId,
      },
      {
        address: contractAddress!,
        abi: FootballBettingABI.abi,
        functionName: "admins",
        args: address ? [address] : undefined,
        chainId,
      },
    ],
    query: { enabled: isReady && contractAddress !== null && !!address },
  });

  const owner = (data?.[0]?.result as string) ?? undefined;
  const isInAdmins = (data?.[1]?.result as boolean) ?? false;
  const isOwner = !!(address && owner && address.toLowerCase() === owner.toLowerCase());
  const stateLoading = isReady && !data;

  return {
    isAdmin: isOwner || isInAdmins,
    isLoading: !isReady || stateLoading,
  };
}
