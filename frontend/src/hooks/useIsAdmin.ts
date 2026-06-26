/**
 * ============================================================================
 * 管理员身份检测 Hook — 判断当前钱包是否为合约管理员
 * ============================================================================
 *
 * 【权限检查逻辑】
 *   合约有两种管理员身份：
 *   ① owner — 合约部署者，拥有最高权限（addAdmin/removeAdmin）
 *   ② admins — 由 owner 添加的管理员，拥有日常管理权限（createMatch/openMatch 等）
 *
 *   此 hook 同时查询 owner() 和 admins[user]，若当前用户满足任一条件
 *   即返回 isAdmin = true。前端据此显示/隐藏"管理"菜单和后台页面。
 *
 *   注意：owner 自身不在 admins mapping 中（除非 owner 手动 addAdmin 自己），
 *   所以两个查询都做才能覆盖"owner 本人即是管理员"这一情况。
 *
 * 【Gas 成本】
 *   这两个都是 view 函数，通过 eth_call 执行，不消耗用户 Gas。
 *   owner 是 immutable 字段（读取免 SLOAD），admins 是普通 mapping。
 *
 * 【用法示例】
 *   const { isAdmin, isLoading } = useIsAdmin();
 *   if (isLoading) return <Spinner />;
 *   if (!isAdmin) return <NoPermission />;
 */
"use client";

import { useReadContracts } from "wagmi";
import { useAccount } from "wagmi";
import { useDeploymentConfig } from "@/lib/config";
import FootballBettingABI from "@/lib/abi/FootballBetting.json";

export function useIsAdmin() {
  const { address } = useAccount();
  const { contractAddress, isReady, chainId } = useDeploymentConfig();

  // 批量查询 owner 和 admins[user]，一次 RPC 往返（multicall）
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

  // data[0].result → owner 地址 (string)
  // data[1].result → admins[user] (bool)
  const owner = (data?.[0]?.result as string) ?? undefined;
  const isInAdmins = (data?.[1]?.result as boolean) ?? false;
  const isOwner = !!(address && owner && address.toLowerCase() === owner.toLowerCase());
  // 在配置就绪但数据尚未返回时显示 loading
  const stateLoading = isReady && !data;

  return {
    isAdmin: isOwner || isInAdmins,
    isLoading: !isReady || stateLoading,
  };
}
