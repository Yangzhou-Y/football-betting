/**
 * ============================================================================
 * 管理后台 — 赛事创建 + 比赛管理 + 紧急暂停 + 提取手续费
 * ============================================================================
 *
 * 【权限控制】
 *   入口检查：isConnected → isAdminLoading → isAdmin
 *   非管理员直接被红色"无管理员权限"提示拦截，不渲染任何管理界面。
 *
 * 【页面功能分区】
 *   ① 创建赛事表单（CreateMatchForm）
 *      - 输入：赛事名称、主客队名、开赛时间(decimal-local)、截止时间、最低/最高投注、是否可选平局
 *      - 校验：截止时间 < 开赛时间（前端预检 + 合约校验两层保护）
 *      - 编码：中文队名 → bytes32（encodeTeamName，最多 10 个中文字）
 *
 *   ② 赛事管理表格（MatchManagement）
 *      - 列出所有有效比赛（startTime > 0）
 *      - 每行显示当前状态 + 对应操作按钮：
 *        Created → [开放] [删除]
 *        Open    → [关闭]
 *        Closed  → [录入比分]
 *      - 录入比分使用 Portal 弹窗：第一步选比分 → 第二步确认（含不可撤销警告）
 *      - 删除操作使用 ConfirmDialog 二次确认（含警告文案）
 *
 *   ③ 紧急暂停/恢复面板（PausePanel）
 *      - 显示当前合约暂停状态（🔴 已暂停 / 🟢 运行中）
 *      - 按钮文案随状态切换：运行中 → "暂停" / 已暂停 → "恢复"
 *
 *   ④ 平台手续费提取面板（FeePanel）
 *      - 显示可提取的 USDT 手续费余额
 *      - 余额为 0 时按钮禁用
 *
 * 【为什么录入比分的弹窗用 createPortal？】
 *   弹窗需要覆盖整个页面（z-index: 9999），直接渲染在父元素内可能受
 *   overflow: hidden 或 z-index stacking context 影响。
 *   createPortal 将弹窗挂载到 document.body，确保始终在顶层。
 *
 * 【比分录入两步确认的设计原因】
 *   recordResult 是合约中最不可逆的操作之一——一旦提交，比分永久写入链上。
 *   两步流程（选择比分 → 核对确认）减少误操作概率。
 *   第二步明确显示："⚠ 提交后不可撤销！请仔细核对比分"
 */
"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { useTxToast } from "@/components/shared/TxToast";
import { useWaitForTxAndRefresh } from "@/hooks/useWaitForTx";
import { useAllMatches } from "@/hooks/useMatches";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useMounted } from "@/hooks/useMounted";
import { useDeploymentConfig } from "@/lib/config";
import { TeamNameDisplay } from "@/components/shared/TeamNameDisplay";
import { MatchStatusBadge } from "@/components/shared/MatchStatusBadge";
import { AmountDisplay } from "@/components/shared/AmountDisplay";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { MatchStatus, RESULT_KEYS, Result } from "@/lib/constants";
import type { MatchStruct } from "@/lib/types";
import { encodeTeamName, decodeTeamName, parseUSDT, formatUSDT, formatTime } from "@/lib/utils";
import { translateName } from "@/lib/nameMap";
import { parseContractError } from "@/lib/errors";
import { useT, useLang } from "@/lib/i18n";
import FootballBettingABI from "@/lib/abi/FootballBetting.json";

export default function AdminPage() {
  const t = useT();
  const mounted = useMounted();
  const { isConnected } = useAccount();
  const { isAdmin, isLoading: isAdminLoading } = useIsAdmin();
  const mgmtSectionRef = useRef<HTMLHeadingElement>(null);
  const { contractAddress, chainId } = useDeploymentConfig();

  if (!mounted) {
    return <div className="text-center py-20 text-slate-400">{t("common.loading")}</div>;
  }
  if (!isConnected) {
    return <div className="text-center py-20 text-slate-500">{t("common.connectWallet")}</div>;
  }
  if (isAdminLoading) {
    return <div className="text-center py-20 text-slate-400">{t("common.checkingPermission")}</div>;
  }
  if (!isAdmin) {
    return <div className="text-center py-20 text-red-500">{t("common.noPermission")}</div>;
  }

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-bold">{t("admin.title")}</h1>

      <section>
        <h2 className="text-lg font-semibold mb-3">{t("admin.createMatch")}</h2>
        <CreateMatchForm contractAddress={contractAddress!} />
      </section>

      <section>
        <h2 ref={mgmtSectionRef} className="text-lg font-semibold mb-3 scroll-mt-16">{t("admin.matchMgmt")}</h2>
        <MatchManagement contractAddress={contractAddress!} mgmtSectionRef={mgmtSectionRef} />
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <PausePanel contractAddress={contractAddress!} chainId={chainId} />
        <FeePanel contractAddress={contractAddress!} chainId={chainId} />
      </section>
    </div>
  );
}

function CreateMatchForm({ contractAddress }: { contractAddress: string }) {
  const t = useT();
  const [matchName, setMatchName] = useState("");
  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const [startTime, setStartTime] = useState(() => {
    const d = new Date(Date.now() + 24 * 3600_000);
    return toDatetimeLocal(d);
  });
  const [deadlineTime, setDeadlineTime] = useState(() => {
    const d = new Date(Date.now() + 23 * 3600_000);
    return toDatetimeLocal(d);
  });
  const [minBet, setMinBet] = useState("0.01");
  const [maxBet, setMaxBet] = useState("");
  const [allowDraw, setAllowDraw] = useState(false);

  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, error: receiptError } = useWaitForTxAndRefresh(hash);

  const toast = useTxToast();
  const prevPending = useRef(false);
  const prevConfirming = useRef(false);
  const cmPendingId = useRef(0);
  useEffect(() => {
    if (isPending && !prevPending.current) {
      cmPendingId.current = toast.show(t("toast.createSubmitted"), "pending");
    }
    if (isConfirming && !prevConfirming.current) toast.show(t("toast.createSuccess"), "success");
    if (error) {
      const msg = (error as Error)?.message || "";
      const parsed = parseContractError(error as Error | null);
      toast.show(parsed ? t(parsed) : (msg.includes("rejected") ? t("toast.txCancelled") : t("toast.createFailed")), "error");
    }
    if (!isPending && !isConfirming && !error && prevPending.current) {
      toast.dismiss(cmPendingId.current);
    }
    prevPending.current = isPending;
    prevConfirming.current = isConfirming;
  }, [isPending, isConfirming, error]);

  const handleCreate = () => {
    if (!matchName || !homeTeam || !awayTeam || !startTime || !deadlineTime) return;
    const start = Math.floor(new Date(startTime).getTime() / 1000);
    const deadline = Math.floor(new Date(deadlineTime).getTime() / 1000);
    if (deadline >= start) {
      alert(t("admin.deadlineHint"));
      return;
    }
    let mn: `0x${string}`, ht: `0x${string}`, at: `0x${string}`;
    try {
      mn = encodeTeamName(matchName);
      ht = encodeTeamName(homeTeam);
      at = encodeTeamName(awayTeam);
    } catch (e: any) {
      alert(e.message || t("admin.nameEncodeError"));
      return;
    }

    writeContract({
      address: contractAddress as `0x${string}`,
      abi: FootballBettingABI.abi,
      functionName: "createMatch",
      args: [mn, ht, at,
        start,
        deadline,
        parseUSDT(minBet),
        maxBet ? parseUSDT(maxBet) : 0n,
        allowDraw,
      ],
    });
  };

  const loading = isPending || isConfirming;
  const displayError = error || receiptError;

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
        <div className="sm:col-span-2">
          <label className="block text-xs text-slate-500 mb-1">{t("admin.matchName")}</label>
          <input
            className="w-full px-3 py-2 border rounded-lg text-sm" placeholder={t("admin.ph.matchName")}
            value={matchName} onChange={(e) => setMatchName(e.target.value)} disabled={loading}
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">{t("admin.homeTeam")}</label>
          <input
            className="w-full px-3 py-2 border rounded-lg text-sm" placeholder={t("admin.ph.homeTeam")}
            value={homeTeam} onChange={(e) => setHomeTeam(e.target.value)} disabled={loading}
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">{t("admin.awayTeam")}</label>
          <input
            className="w-full px-3 py-2 border rounded-lg text-sm" placeholder={t("admin.ph.awayTeam")}
            value={awayTeam} onChange={(e) => setAwayTeam(e.target.value)} disabled={loading}
          />
        </div>
        <div className="min-w-0">
          <label className="block text-xs text-slate-500 mb-1">{t("admin.startTime")}</label>
          <input
            className="w-full px-1.5 sm:px-3 py-2 border rounded-lg text-xs sm:text-sm" type="datetime-local"
            value={startTime} onChange={(e) => setStartTime(e.target.value)} disabled={loading}
          />
        </div>
        <div className="min-w-0">
          <label className="block text-xs text-slate-500 mb-1">{t("admin.deadline")}</label>
          <input
            className="w-full px-1.5 sm:px-3 py-2 border rounded-lg text-xs sm:text-sm" type="datetime-local"
            value={deadlineTime} onChange={(e) => setDeadlineTime(e.target.value)} disabled={loading}
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">{t("admin.minBet")}</label>
          <input
            className="w-full px-3 py-2 border rounded-lg text-sm" placeholder={t("admin.ph.minBet")}
            value={minBet} onChange={(e) => setMinBet(e.target.value)} disabled={loading}
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">{t("admin.maxBet")}</label>
          <input
            className="w-full px-3 py-2 border rounded-lg text-sm" placeholder={t("admin.ph.maxBet")}
            value={maxBet} onChange={(e) => setMaxBet(e.target.value)} disabled={loading}
          />
        </div>
      </div>

      <div className="my-3">
        <p className="text-xs text-slate-500 mb-1">{t("admin.allowDraw")}</p>
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={allowDraw}
            onChange={(e) => setAllowDraw(e.target.checked)}
            disabled={loading}
            className="w-4 h-4 rounded accent-blue-600"
          />
          {t("admin.allowDrawHint")}
        </label>
      </div>

      {displayError && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-xs text-red-700 font-medium">{t("admin.errorTitle")}</p>
          <p className="text-xs text-red-500 mt-0.5">
            {(() => {
              const parsed = parseContractError(displayError as Error);
              return parsed ? t(parsed) : displayError.message?.slice(0, 200);
            })()}
          </p>
        </div>
      )}

      <button
        onClick={handleCreate}
        disabled={loading || !matchName || !homeTeam || !awayTeam || !startTime || !deadlineTime}
        className="mt-4 w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition"
      >
        {loading ? t("common.processing") : t("admin.createButton")}
      </button>
      <p className="text-xs text-slate-400 mt-2">
        {t("admin.createHint")}
      </p>
    </div>
  );
}

function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function MatchManagement({ contractAddress, mgmtSectionRef }: { contractAddress: string; mgmtSectionRef: { current: HTMLHeadingElement | null } }) {
  const t = useT();
  const { lang } = useLang();
  const { data: matches } = useAllMatches();
  const matchList: MatchStruct[] = (matches as MatchStruct[]) ?? [];
  const [mgmtPage, setMgmtPage] = useState(0);
  const [mgmtSortNewest, setMgmtSortNewest] = useState(true);
  const [filterDate, setFilterDate] = useState("");
  const [filterTeam, setFilterTeam] = useState("");
  const [mgmtJumpInput, setMgmtJumpInput] = useState("");

  const { writeContract, data: adminHash, isPending: isAdminPending, error: adminError } = useWriteContract();
  const { isSuccess: adminConfirmed } = useWaitForTxAndRefresh(adminHash);

  const validMatches = matchList
    .map((m, i) => ({ match: m, id: i + 1 }))
    .filter(({ match }) => match.startTime > 0n)
    .filter(({ match: m }) => {
      // Date filter
      if (filterDate) {
        const matchDate = new Date(Number(m.startTime) * 1000);
        const matchDateStr = matchDate.toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" });
        const filterDateStr = new Date(filterDate + "T00:00:00+08:00").toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" });
        if (matchDateStr !== filterDateStr) return false;
      }
      // Team name filter (bilingual)
      if (filterTeam.trim()) {
        const q = filterTeam.trim().toLowerCase();
        const homeRaw = decodeTeamName(m.homeTeam ?? "");
        const awayRaw = decodeTeamName(m.awayTeam ?? "");
        const homes = [homeRaw.toLowerCase(), translateName(homeRaw, "zh").toLowerCase(), translateName(homeRaw, "en").toLowerCase()];
        const aways = [awayRaw.toLowerCase(), translateName(awayRaw, "zh").toLowerCase(), translateName(awayRaw, "en").toLowerCase()];
        if (!homes.some((h) => h.includes(q)) && !aways.some((a) => a.includes(q))) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const cmp = Number(a.match.startTime - b.match.startTime);
      return mgmtSortNewest ? -cmp : cmp;
    });

  // 分页：每页最多 15 条
  const MGMT_PAGE_SIZE = 15;
  const mgmtTotalPages = Math.max(1, Math.ceil(validMatches.length / MGMT_PAGE_SIZE));
  const safeMgmtPage = Math.min(mgmtPage, mgmtTotalPages - 1);
  const pagedMatches = validMatches.slice(safeMgmtPage * MGMT_PAGE_SIZE, safeMgmtPage * MGMT_PAGE_SIZE + MGMT_PAGE_SIZE);

  useEffect(() => { mgmtSectionRef.current?.scrollIntoView({ behavior: "smooth" }); }, [safeMgmtPage]);

  const mtToast = useTxToast();
  const prevAdminPending = useRef(false);
  const prevAdminConfirmed = useRef(false);
  const adminPendingId = useRef(0);
  useEffect(() => {
    if (isAdminPending && !prevAdminPending.current) {
      adminPendingId.current = mtToast.show(t("toast.adminSubmitted"), "pending");
    }
    if (adminConfirmed && !prevAdminConfirmed.current) mtToast.show(t("toast.adminSuccess"), "success");
    if (adminError) {
      const msg = (adminError as Error)?.message || "";
      const parsed = parseContractError(adminError as Error | null);
      mtToast.show(parsed ? t(parsed) : (msg.includes("rejected") ? t("toast.txCancelled") : t("toast.adminFailed")), "error");
    }
    if (!isAdminPending && !adminConfirmed && !adminError && prevAdminPending.current) {
      mtToast.dismiss(adminPendingId.current);
    }
    prevAdminPending.current = isAdminPending;
    prevAdminConfirmed.current = adminConfirmed;
  }, [isAdminPending, adminConfirmed, adminError]);

  const adminAction = (func: string, args: any[]) => {
    writeContract({ address: contractAddress as `0x${string}`, abi: FootballBettingABI.abi, functionName: func, args });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 flex-wrap gap-2">
        {/* Filter bar: date + team search */}
        <div className="flex gap-2 flex-wrap items-center">
          <label className="flex items-center gap-1.5 text-[10px] sm:text-xs text-slate-500">
            <span>{t("filter.date")}</span>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => { setFilterDate(e.target.value); setMgmtPage(0); }}
              className="px-2 py-1 rounded border border-slate-200 text-[10px] sm:text-xs bg-white focus:outline-none focus:border-blue-400 transition"
            />
            {filterDate && (
              <button
                onClick={() => { setFilterDate(""); setMgmtPage(0); }}
                className="text-[10px] text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </label>
          <label className="flex items-center gap-1.5 text-[10px] sm:text-xs text-slate-500">
            <span>{t("filter.team")}</span>
            <input
              type="text"
              value={filterTeam}
              onChange={(e) => { setFilterTeam(e.target.value); setMgmtPage(0); }}
              className="px-2 py-1 rounded border border-slate-200 text-[10px] sm:text-xs bg-white w-28 sm:w-36 focus:outline-none focus:border-blue-400 transition"
            />
            {filterTeam && (
              <button
                onClick={() => { setFilterTeam(""); setMgmtPage(0); }}
                className="text-[10px] text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </label>
        </div>
        <button
          onClick={() => { setMgmtSortNewest((v) => !v); setMgmtPage(0); }}
          className="px-2 py-1 rounded-full text-[10px] sm:text-xs bg-slate-50 text-slate-600 border border-slate-200 hover:border-blue-300 transition"
        >
          {mgmtSortNewest ? t("sort.newest") : t("sort.oldest")} ⇅
        </button>
      </div>
      <div key={`mgmt-${safeMgmtPage}-${String(mgmtSortNewest)}-${filterDate}-${filterTeam}`} className="overflow-x-auto animate-page-enter">
        <table className="w-full text-xs sm:text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-1.5 sm:px-3 py-1.5 sm:py-2">#</th>
              <th className="text-left px-1.5 sm:px-3 py-1.5 sm:py-2">{t("admin.table.match")}</th>
              <th className="text-center px-1.5 sm:px-3 py-1.5 sm:py-2">{t("admin.table.status")}</th>
              <th className="text-right px-1.5 sm:px-3 py-1.5 sm:py-2">{t("admin.table.actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pagedMatches.map(({ match: m, id: mid }) => (
              <tr key={mid} className="hover:bg-slate-50">
                <td className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-slate-400">{mid}</td>
                <td className="px-1.5 sm:px-3 py-1.5 sm:py-2">
                  {m.matchName && m.matchName !== "0x0000000000000000000000000000000000000000000000000000000000000000" && (
                    <div className="text-[8px] sm:text-[10px] text-slate-400">{translateName(decodeTeamName(m.matchName), lang)}</div>
                  )}
                  <span className="inline-flex items-center gap-1 sm:gap-1.5"><TeamNameDisplay hex={m.homeTeam} /><span className="text-slate-400 text-[10px] sm:text-xs">VS</span><TeamNameDisplay hex={m.awayTeam} flagAfter /></span>
                  <div className="text-[8px] sm:text-[10px] text-slate-400 mt-0.5">{formatTime(m.startTime)}</div>
                </td>
                <td className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-center"><MatchStatusBadge status={m.status} deadline={m.deadline} /></td>
                <td className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-right">
                  <div className="flex gap-0.5 sm:gap-1 justify-end">
                    {m.status === MatchStatus.Created && (
                      <>
                        <Btn onClick={() => adminAction("openMatch", [mid])} label={t("admin.open")} variant="green" disabled={isAdminPending} />
                        <DeleteBtn contractAddress={contractAddress} matchId={mid} matchName={m.matchName} homeTeam={m.homeTeam} awayTeam={m.awayTeam} />
                      </>
                    )}
                    {m.status === MatchStatus.Open && (
                      <Btn onClick={() => adminAction("closeMatch", [mid])} label={t("admin.close")} variant="yellow" disabled={isAdminPending} />
                    )}
                    {m.status === MatchStatus.Closed && (
                      <RecordBtn contractAddress={contractAddress} matchId={mid} matchName={m.matchName} homeTeam={m.homeTeam} awayTeam={m.awayTeam} />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {mgmtTotalPages > 1 && (
        <div className="flex items-center justify-center gap-2 py-3 border-t border-slate-100">
          <button
            onClick={() => setMgmtPage(0)}
            disabled={safeMgmtPage === 0}
            aria-label={t("page.first")}
            className="px-3 py-2 rounded-lg text-base border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            title={t("page.first")}
          >
            «
          </button>
          <button
            onClick={() => setMgmtPage((p) => Math.max(0, p - 1))}
            disabled={safeMgmtPage === 0}
            aria-label={t("page.prev")}
            className="px-4 py-2 rounded-lg text-base border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            ←
          </button>
          <span className="text-sm text-slate-500 tabular-nums min-w-[80px] text-center">
            {safeMgmtPage + 1} / {mgmtTotalPages}
          </span>
          <button
            onClick={() => setMgmtPage((p) => Math.min(mgmtTotalPages - 1, p + 1))}
            disabled={safeMgmtPage >= mgmtTotalPages - 1}
            aria-label={t("page.next")}
            className="px-4 py-2 rounded-lg text-base border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            →
          </button>
          <button
            onClick={() => setMgmtPage(mgmtTotalPages - 1)}
            disabled={safeMgmtPage >= mgmtTotalPages - 1}
            aria-label={t("page.last")}
            className="px-3 py-2 rounded-lg text-base border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            title={t("page.last")}
          >
            »
          </button>
          <span className="text-sm text-slate-400 mx-1">{t("page.jumpTo")}</span>
          <input
            type="number"
            min={1}
            max={mgmtTotalPages}
            value={mgmtJumpInput}
            onChange={(e) => setMgmtJumpInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const n = parseInt(mgmtJumpInput);
                if (n >= 1 && n <= mgmtTotalPages) { setMgmtPage(n - 1); setMgmtJumpInput(""); }
              }
            }}
            placeholder={`1-${mgmtTotalPages}`}
            className="w-16 px-2 py-1.5 rounded-lg border border-slate-200 text-sm text-center bg-white focus:outline-none focus:border-blue-400 transition"
          />
          <button
            onClick={() => {
              const n = parseInt(mgmtJumpInput);
              if (n >= 1 && n <= mgmtTotalPages) { setMgmtPage(n - 1); setMgmtJumpInput(""); }
            }}
            disabled={!mgmtJumpInput}
            className="px-3 py-1.5 rounded-lg text-sm border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {t("page.go")}
          </button>
        </div>
      )}
      {validMatches.some(({ match: m }) => m.status === MatchStatus.Created) && (
        <p className="text-xs text-slate-400 px-3 py-2 bg-slate-50 border-t border-slate-100">{t("admin.deleteHint")}</p>
      )}
    </div>
  );
}

function Btn({ onClick, label, variant, disabled }: { onClick: () => void; label: string; variant: "green" | "yellow" | "blue"; disabled?: boolean }) {
  const cls =
    variant === "green" ? "bg-emerald-600 hover:bg-emerald-700" :
    variant === "yellow" ? "bg-amber-500 hover:bg-amber-600" :
    "bg-blue-600 hover:bg-blue-700";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs text-white ${cls} transition disabled:opacity-50`}
    >
      {disabled ? "..." : label}
    </button>
  );
}

function RecordBtn({ contractAddress, matchId, matchName, homeTeam, awayTeam }: { contractAddress: string; matchId: number; matchName: string; homeTeam: string; awayTeam: string }) {
  const t = useT();
  const { lang } = useLang();
  const [show, setShow] = useState(false);
  const [home, setHome] = useState<number | ''>('');
  const [away, setAway] = useState<number | ''>('');
  const [step, setStep] = useState<1 | 2>(1);
  const { writeContract, isPending, data: recordHash, error: recordError } = useWriteContract();
  const { isSuccess: recordDone } = useWaitForTxAndRefresh(recordHash);

  const recToast = useTxToast();
  const prevRecPending = useRef(false);
  const prevRecDone = useRef(false);
  const recPendingId = useRef(0);
  useEffect(() => {
    if (isPending && !prevRecPending.current) {
      recPendingId.current = recToast.show(t("toast.recordSubmitted"), "pending");
    }
    if (recordDone && !prevRecDone.current) recToast.show(t("toast.recordSuccess"), "success");
    if (recordError) {
      const msg = (recordError as Error)?.message || "";
      const parsed = parseContractError(recordError as Error | null);
      recToast.show(parsed ? t(parsed) : (msg.includes("rejected") ? t("toast.txCancelled") : t("toast.recordFailed")), "error");
    }
    if (!isPending && !recordDone && !recordError && prevRecPending.current) {
      recToast.dismiss(recPendingId.current);
    }
    prevRecPending.current = isPending;
    prevRecDone.current = recordDone;
  }, [isPending, recordDone, recordError]);

  const close = () => { setShow(false); setStep(1); setHome(''); setAway(''); };

  const goNext = () => {
    if (home === '' || away === '') return;
    const h = Number(home);
    const a = Number(away);
    if (h < 0 || h > 999 || a < 0 || a > 999) {
      alert(t("admin.scoreError"));
      return;
    }
    setStep(2);
  };

  const submit = () => {
    writeContract({
      address: contractAddress as `0x${string}`,
      abi: FootballBettingABI.abi,
      functionName: "recordResult",
      args: [matchId, home as number, away as number],
    });
    close();
  };

  const resultKey =
    home !== '' && away !== ''
      ? Number(home) > Number(away) ? RESULT_KEYS[Result.HomeWin] : Number(home) === Number(away) ? RESULT_KEYS[Result.Draw] : RESULT_KEYS[Result.AwayWin]
      : '';

  return (
    <>
      <button onClick={() => setShow(true)} className="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs text-white bg-blue-600 hover:bg-blue-700">
        {t("admin.record")}
      </button>
      {show && createPortal(
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[9999] p-4" style={{ animation: "fadeIn 0.15s ease-out" }} onClick={close}>
          <div className="bg-white rounded-xl p-6 shadow-lg max-w-sm w-full mx-auto overflow-y-auto max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
            {matchName && matchName !== "0x0000000000000000000000000000000000000000000000000000000000000000" && (
              <p className="text-xs text-slate-500 text-center mb-1">{translateName(decodeTeamName(matchName), lang)}</p>
            )}
            <h3 className="flex items-center gap-2 font-semibold text-lg mb-1">
              <span className="flex-1 min-w-0 text-right"><TeamNameDisplay hex={homeTeam} /></span>
              <span className="text-slate-400 text-sm shrink-0">VS</span>
              <span className="flex-1 min-w-0 text-left"><TeamNameDisplay hex={awayTeam} /></span>
            </h3>
            <p className="text-xs text-slate-400 text-center">{t("common.matchNum")}{matchId}</p>

            {step === 1 ? (
              <>
                <div className="flex items-center justify-center gap-3 mb-4">
                  <div className="text-center">
                    <p className="text-xs text-slate-500 mb-1">{t("admin.homeTeam")} (<TeamNameDisplay hex={homeTeam} />)</p>
                    <input type="number" min={0} max={999} className="w-24 px-3 py-2 border rounded text-center text-lg"
                      value={home} onChange={(e) => setHome(e.target.value === '' ? '' : Number(e.target.value))} />
                  </div>
                  <span className="text-xl font-bold text-slate-400 mt-5">:</span>
                  <div className="text-center">
                    <p className="text-xs text-slate-500 mb-1">{t("admin.awayTeam")} (<TeamNameDisplay hex={awayTeam} flagAfter />)</p>
                    <input type="number" min={0} max={999} className="w-24 px-3 py-2 border rounded text-center text-lg"
                      value={away} onChange={(e) => setAway(e.target.value === '' ? '' : Number(e.target.value))} />
                  </div>
                </div>
                <button onClick={goNext} disabled={home === '' || away === ''}
                  className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition">
                  {t("common.nextStep")}
                </button>
              </>
            ) : (
              <>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-center">
                  <p className="text-sm text-amber-800 font-semibold">
                    <TeamNameDisplay hex={homeTeam} /> {home} : {away} <TeamNameDisplay hex={awayTeam} flagAfter />
                  </p>
                  <p className="text-xs text-amber-600 mt-1">{t("admin.resultLabel")}{resultKey ? t(resultKey) : ""}</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-2 mb-4 text-center">
                  <p className="text-xs text-red-600 font-medium">{t("admin.irreversibleWarning")}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setStep(1)}
                    className="flex-1 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition">
                    {t("common.back")}
                  </button>
                  <button onClick={submit} disabled={isPending}
                    className="flex-1 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition">
                    {isPending ? t("common.submitting") : t("admin.confirmSubmit")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

function DeleteBtn({ contractAddress, matchId, matchName, homeTeam, awayTeam }: { contractAddress: string; matchId: number; matchName: string; homeTeam: string; awayTeam: string }) {
  const t = useT();
  const { lang } = useLang();
  const [show, setShow] = useState(false);
  const { writeContract, isPending, data: deleteHash, error: deleteError } = useWriteContract();
  const { isSuccess: deleteDone } = useWaitForTxAndRefresh(deleteHash);

  const delToast = useTxToast();
  const prevDelPending = useRef(false);
  const prevDelDone = useRef(false);
  const delPendingId = useRef(0);
  useEffect(() => {
    if (isPending && !prevDelPending.current) {
      delPendingId.current = delToast.show(t("toast.deleteSubmitted"), "pending");
    }
    if (deleteDone && !prevDelDone.current) delToast.show(t("toast.deleteSuccess"), "success");
    if (deleteError) {
      const msg = (deleteError as Error)?.message || "";
      const parsed = parseContractError(deleteError as Error | null);
      delToast.show(parsed ? t(parsed) : (msg.includes("rejected") ? t("toast.txCancelled") : t("toast.deleteFailed")), "error");
    }
    if (!isPending && !deleteDone && !deleteError && prevDelPending.current) {
      delToast.dismiss(delPendingId.current);
    }
    prevDelPending.current = isPending;
    prevDelDone.current = deleteDone;
  }, [isPending, deleteDone, deleteError]);

  const handleDelete = () => {
    writeContract({
      address: contractAddress as `0x${string}`,
      abi: FootballBettingABI.abi,
      functionName: "deleteMatch",
      args: [matchId],
    });
    setShow(false);
  };

  return (
    <>
      <button onClick={() => setShow(true)} className="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs text-white bg-red-500 hover:bg-red-600 transition">
        {t("admin.delete")}
      </button>
      {show && (
        <ConfirmDialog
          open={show}
          title={t("admin.deleteTitle")}
          confirmLabel={t("admin.delete")}
          confirmVariant="red"
          loading={isPending}
          onConfirm={handleDelete}
          onCancel={() => setShow(false)}
        >
          <div className="space-y-3">
            <p>{t("admin.deleteConfirm")}</p>
            <div className="bg-slate-100 rounded-lg p-3 text-center">
              {matchName && matchName !== "0x0000000000000000000000000000000000000000000000000000000000000000" && (
                <p className="text-xs text-slate-500">{translateName(decodeTeamName(matchName), lang)}</p>
              )}
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <span className="flex-1 min-w-0 text-right"><TeamNameDisplay hex={homeTeam} /></span>
                <span className="text-slate-400 text-xs shrink-0">VS</span>
                <span className="flex-1 min-w-0 text-left"><TeamNameDisplay hex={awayTeam} flagAfter /></span>
              </p>
              <p className="text-xs text-slate-400">{t("common.matchNum")}{matchId}</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 text-center">
              <p className="text-xs text-red-600 font-medium">{t("admin.deleteWarning")}</p>
            </div>
          </div>
        </ConfirmDialog>
      )}
    </>
  );
}

function PausePanel({ contractAddress, chainId }: { contractAddress: string; chainId: number }) {
  const t = useT();
  const { data: paused, isLoading: isPausedLoading } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: FootballBettingABI.abi,
    functionName: "paused",
    chainId,
  });

  const { writeContract, isPending, data: toggleHash, error: pauseError } = useWriteContract();
  const { isSuccess: pauseDone } = useWaitForTxAndRefresh(toggleHash);
  const pauseToast = useTxToast();
  const prevPausePending = useRef(false);
  const prevPauseDone = useRef(false);
  const pausePendingId = useRef(0);
  useEffect(() => {
    if (isPending && !prevPausePending.current) {
      pausePendingId.current = pauseToast.show(t("toast.pauseSubmitted"), "pending");
    }
    if (pauseDone && !prevPauseDone.current) pauseToast.show(isPaused ? t("toast.resumed") : t("toast.paused"), "success");
    if (pauseError) {
      const msg = (pauseError as Error)?.message || "";
      const parsed = parseContractError(pauseError as Error | null);
      pauseToast.show(parsed ? t(parsed) : (msg.includes("rejected") ? t("toast.txCancelled") : t("toast.adminFailed")), "error");
    }
    if (!isPending && !pauseDone && !pauseError && prevPausePending.current) {
      pauseToast.dismiss(pausePendingId.current);
    }
    prevPausePending.current = isPending;
    prevPauseDone.current = pauseDone;
  }, [isPending, pauseDone, pauseError]);
  const isPaused = (paused as boolean) ?? false;

  const toggle = () => {
    writeContract({
      address: contractAddress as `0x${string}`,
      abi: FootballBettingABI.abi,
      functionName: isPaused ? "unpause" : "pause",
    });
  };

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
      <h3 className="font-semibold mb-2">{t("admin.pause")}</h3>
      <p className="text-sm text-slate-500 mb-3">
        {t("admin.pauseStatus")} {isPausedLoading ? t("admin.pauseLoading") : isPaused ? t("admin.pauseIndicator") : t("admin.runningIndicator")}
      </p>
      <button
        onClick={toggle}
        disabled={isPending || isPausedLoading}
        className={`w-full py-2 rounded-lg font-medium text-white transition ${
          isPaused ? "bg-green-600 hover:bg-green-700" : "bg-red-500 hover:bg-red-600"
        }`}
      >
        {isPaused ? t("admin.resume") : t("admin.pauseBtn")}
      </button>
    </div>
  );
}

function FeePanel({ contractAddress, chainId }: { contractAddress: string; chainId: number }) {
  const t = useT();
  const { data: balance } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: FootballBettingABI.abi,
    functionName: "platformBalance",
    chainId,
  });

  const { writeContract, isPending, data: feeHash, error: feeError } = useWriteContract();
  const { isSuccess: feeDone } = useWaitForTxAndRefresh(feeHash);
  const feeToast = useTxToast();
  const prevFeePending = useRef(false);
  const prevFeeDone = useRef(false);
  const feePendingId = useRef(0);
  useEffect(() => {
    if (isPending && !prevFeePending.current) {
      feePendingId.current = feeToast.show(t("toast.feeSubmitted"), "pending");
    }
    if (feeDone && !prevFeeDone.current) feeToast.show(t("toast.feeSuccess"), "success");
    if (feeError) {
      const msg = (feeError as Error)?.message || "";
      const parsed = parseContractError(feeError as Error | null);
      feeToast.show(parsed ? t(parsed) : (msg.includes("rejected") ? t("toast.txCancelled") : t("toast.feeFailed")), "error");
    }
    if (!isPending && !feeDone && !feeError && prevFeePending.current) {
      feeToast.dismiss(feePendingId.current);
    }
    prevFeePending.current = isPending;
    prevFeeDone.current = feeDone;
  }, [isPending, feeDone, feeError]);

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
      <h3 className="font-semibold mb-2">{t("admin.fee")}</h3>
      <p className="text-sm text-slate-500 mb-3">
        {t("admin.feePending")} <span className="font-bold text-slate-800">{formatUSDT((balance as bigint) ?? 0n)} USDT</span>
      </p>
      <button
        onClick={() => writeContract({
          address: contractAddress as `0x${string}`,
          abi: FootballBettingABI.abi,
          functionName: "withdrawFee",
        })}
        disabled={isPending || !balance || (balance as bigint) === 0n}
        className="w-full py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 transition"
      >
        {t("admin.withdraw")}
      </button>
    </div>
  );
}
