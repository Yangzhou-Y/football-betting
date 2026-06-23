"use client";

import { useWriteContract } from "wagmi";
import { useWaitForTxAndRefresh } from "@/hooks/useWaitForTx";
import { useDeploymentConfig } from "@/lib/config";
import FootballBettingABI from "@/lib/abi/FootballBetting.json";

/** 取消投注 Hook — 仅在比赛 Open 状态且未到截止时间可用 */
export function useCancelBet(matchId: number) {
  const { contractAddress } = useDeploymentConfig();

  const {
    writeContract: cancel,
    data: cancelHash,
    isPending: isCancelling,
    error: cancelError,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isCancelled } =
    useWaitForTxAndRefresh(cancelHash);

  const handleCancel = () => {
    if (!contractAddress) return;
    cancel({
      address: contractAddress,
      abi: FootballBettingABI.abi,
      functionName: "cancelBet",
      args: [matchId],
    });
  };

  return {
    handleCancel,
    isCancelling,
    isConfirming,
    isCancelled,
    cancelHash,
    cancelError,
  };
}
