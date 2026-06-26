/**
 * ============================================================================
 * 领取奖励 Hook — 调用 claimReward(matchId)，领取中奖 USDT
 * ============================================================================
 *
 * 【合约行为说明】
 *   claimReward 使用 Parimutuel（同注分彩）公式计算奖励：
 *     reward = userBet.amount * (totalPool - fee) / winningPool
 *
 *   领奖条件：
 *   ① 比赛已结算（settled = true）
 *   ② 用户有投注且猜中（userBet.betOn == match.result）
 *   ③ 尚未领取（userBet.claimed = false）
 *
 *   未猜中的用户调用 claimReward 也会成功，但返回 0 reward（claimed 标记为 true）。
 *   这是合约为清理存储设计的"伪领奖"机制——用户花一次 Gas 清理自己的 Bet 数据。
 *
 * 【资金流】
 *   奖池中的 USDT 在结算时并未实际转出，而是记在合约余额中。
 *   claimReward 调用 usdt.transfer(user, rewardAmount) 完成实际出账。
 *   这是"Pull"模式（用户自付 Gas 提款），而非"Push"模式（合约主动转账）。
 *
 * 【用法示例】
 *   const { handleClaim, isClaiming, isConfirming, isClaimed } = useClaimReward(matchId);
 */
"use client";

import { useWriteContract } from "wagmi";
import { useWaitForTxAndRefresh } from "@/hooks/useWaitForTx";
import { useDeploymentConfig } from "@/lib/config";
import FootballBettingABI from "@/lib/abi/FootballBetting.json";

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
