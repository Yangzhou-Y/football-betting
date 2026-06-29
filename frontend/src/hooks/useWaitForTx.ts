"use client";

import { useEffect } from "react";
import { useWaitForTransactionReceipt } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";

/**
 * 等待交易确认 + 自动刷新所有合约查询
 * 用法同 useWaitForTransactionReceipt，但在确认后自动 invalidateQueries
 */
export function useWaitForTxAndRefresh(hash: `0x${string}` | undefined) {
  const queryClient = useQueryClient();
  const receipt = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (receipt.isSuccess) {
      // Scope to contract-data queries only, not app-wide (avoids expensive leaderboard / participantCounts re-scan)
      queryClient.invalidateQueries({ predicate: (query) => Array.isArray(query.queryKey) && query.queryKey[0] !== "leaderboard" && query.queryKey[0] !== "participantCounts" });
    }
  }, [receipt.isSuccess, queryClient]);

  return receipt;
}
