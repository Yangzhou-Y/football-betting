/**
 * ============================================================================
 * 取消投注 Hook — 调用 cancelBet(matchId)，退回全部 USDT
 * ============================================================================
 *
 * 【合约行为说明】
 *   cancelBet 从奖池中移除用户的全部投注金额，删除投注记录，退回 USDT。
 *   仅在比赛处于 Open 状态且未到截止时间时可调用。
 *
 *   结算公式（合约内部）：
 *     ① _removeFromPool(m, betOn, amount) → 从对应奖池减去金额
 *     ② delete bets[matchId][user]           → 清除投注记录
 *     ③ usdt.transfer(user, amount)          → 退回全额 USDT
 *
 *   Gas 退款：delete 操作释放存储槽，每释放一个槽返还 ~15,000 gas。
 *
 * 【返回值的状态机】
 *   isCancelling  → true（MetaMask 弹窗等待用户签名）
 *   isConfirming  → true（交易已广播，等待区块确认）
 *   isCancelled   → true（交易已确认 + 所有合约查询已自动刷新）
 *   cancelError   → 非 null（用户拒绝签名或合约 revert）
 *
 * 【用法示例】
 *   const { handleCancel, isCancelling, isConfirming, isCancelled } = useCancelBet(matchId);
 *   // 在按钮 onClick 中调用 handleCancel()
 */
"use client";

import { useWriteContract } from "wagmi";
import { useWaitForTxAndRefresh } from "@/hooks/useWaitForTx";
import { useDeploymentConfig } from "@/lib/config";
import FootballBettingABI from "@/lib/abi/FootballBetting.json";

export function useCancelBet(matchId: number) {
  const { contractAddress } = useDeploymentConfig();

  // useWriteContract 返回 writeContract 函数 + 交易哈希 + pending/error 状态
  const {
    writeContract: cancel,
    data: cancelHash,
    isPending: isCancelling,
    error: cancelError,
  } = useWriteContract();

  // 等待交易确认 + 自动刷新 TanStack Query 缓存
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
