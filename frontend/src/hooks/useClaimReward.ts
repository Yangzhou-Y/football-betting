"use client";

import { useWriteContract } from "wagmi";
import { useWaitForTxAndRefresh } from "@/hooks/useWaitForTx";
import { useDeploymentConfig } from "@/lib/config";
import FootballBettingABI from "@/lib/abi/FootballBetting.json";

/** 领取奖励 Hook */
export function useClaimReward(matchId: number) {
  const { contractAddress } = useDeploymentConfig();

  const { writeContract: claim, data: claimHash, isPending: isClaiming, error: claimError } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isClaimed } = useWaitForTxAndRefresh(
    claimHash,
  );

  const handleClaim = () => {
    if (!contractAddress) return;
    claim({
      address: contractAddress,
      abi: FootballBettingABI.abi,
      functionName: "claimReward",
      args: [matchId],
    });
  };

  return { handleClaim, isClaiming, isConfirming, isClaimed, claimHash, claimError };
}
