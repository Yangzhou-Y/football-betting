"use client";

import { useState, useEffect, useRef } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { useWaitForTxAndRefresh } from "@/hooks/useWaitForTx";
import { parseUSDT } from "@/lib/utils";
import { useDeploymentConfig } from "@/lib/config";
import FootballBettingABI from "@/lib/abi/FootballBetting.json";
import MockERC20ABI from "@/lib/abi/MockERC20.json";

/**
 * 投注流程 Hook：
 * 1. 检查 USDT allowance（等待加载完成后再显示操作按钮）
 * 2. allowance 不足 → 显示"授权 USDT"
 * 3. allowance 充足 → 显示"确认投注"
 */
export function usePlaceBet(matchId: number) {
  const { address } = useAccount();
  const { contractAddress, usdtAddress, isReady, chainId } = useDeploymentConfig();

  const [betAmount, setBetAmount] = useState("");
  const [selectedResult, setSelectedResult] = useState<1 | 2 | 3>(1);

  const amountInUnits = betAmount ? parseUSDT(betAmount) : 0n;

  // 检查 USDT 余额
  const { data: usdtBalance, isLoading: isBalanceLoading } = useReadContract({
    address: usdtAddress!,
    abi: MockERC20ABI.abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId,
    query: { enabled: isReady && !!usdtAddress && !!address },
  });

  // 检查 allowance
  const { data: allowance, isLoading: isAllowanceLoading, refetch: refetchAllowance } = useReadContract({
    address: usdtAddress!,
    abi: MockERC20ABI.abi,
    functionName: "allowance",
    args: address && usdtAddress ? [address, contractAddress!] : undefined,
    chainId,
    query: { enabled: isReady && !!usdtAddress && !!address },
  });

  // 余额不足
  const insufficientBalance =
    !isBalanceLoading &&
    usdtBalance != null &&
    amountInUnits > 0n &&
    (usdtBalance as bigint) < amountInUnits;

  // allowance 加载中不判断；加载完成后若不足则需要授权
  const needsApproval =
    !insufficientBalance &&
    !isAllowanceLoading &&
    allowance != null &&
    amountInUnits > 0n &&
    (allowance as bigint) < amountInUnits;

  // approve 交易
  const {
    writeContract: approve,
    data: approveHash,
    isPending: isApproving,
    error: approveError,
  } = useWriteContract();

  const { isLoading: isApproveConfirming, isSuccess: isApproved } = useWaitForTxAndRefresh(
    approveHash,
  );

  // placeBet 交易
  const {
    writeContract: placeBet,
    data: betHash,
    isPending: isBetting,
    error: betError,
  } = useWriteContract();

  const { isLoading: isBetConfirming, isSuccess: isBetSuccessRaw } = useWaitForTxAndRefresh(
    betHash,
  );

  // 记录投注成功的账户，切换账户时隐藏成功提示
  const lastBetAccount = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (isBetSuccessRaw && address) lastBetAccount.current = address;
  }, [isBetSuccessRaw, address]);
  const isBetSuccess = isBetSuccessRaw && lastBetAccount.current === address;

  const handleApprove = () => {
    if (!usdtAddress || !contractAddress || amountInUnits <= 0n) return;
    approve({
      address: usdtAddress,
      abi: MockERC20ABI.abi,
      functionName: "approve",
      args: [contractAddress, amountInUnits],
    });
  };

  const handlePlaceBet = () => {
    if (!contractAddress || amountInUnits <= 0n) return;
    placeBet({
      address: contractAddress,
      abi: FootballBettingABI.abi,
      functionName: "placeBet",
      args: [matchId, selectedResult, amountInUnits],
    });
  };

  return {
    betAmount,
    setBetAmount,
    selectedResult,
    setSelectedResult,
    amountInUnits,
    allowance: allowance as bigint | undefined,
    isAllowanceLoading,
    isBalanceLoading,
    insufficientBalance,
    needsApproval,
    handleApprove,
    handlePlaceBet,
    // 交易状态
    isApproving,
    isApproveConfirming,
    isApproved,
    isBetting,
    isBetConfirming,
    isBetSuccess,
    approveHash,
    betHash,
    approveError,
    betError,
    refetchAllowance,
  };
}
