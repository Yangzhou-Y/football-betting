/**
 * ============================================================================
 * 我的竞猜页 — 当前用户的投注历史 + 盈亏统计
 * ============================================================================
 *
 * 【页面结构】
 *   ① 统计数据行：总投注场次 / 猜中场次 / 胜率 / 净盈亏
 *   ② 桌面端：数据表格（赛事名/预测/金额/结果/状态）
 *   ③ 移动端：卡片列表（同数据，紧凑布局）
 *   ④ 空状态：无投注时引导前往赛事列表
 *
 * 【盈亏计算公式】
 *   totalWagered = Σ amounts[i]（所有投注金额之和）
 *   totalWon = Σ rewards[i]（所有已领取奖励之和）
 *   profit = totalWon - totalWagered
 *   profit > 0 → 绿色显示 "+X.XX USDT"
 *   profit < 0 → 红色显示 "-X.XX USDT"
 *
 *   winRate = (winCount / totalBets) × 100%
 *
 * 【赛事删除后的处理】
 *   用户可能投注了已被管理员删除的比赛（match.startTime == 0）。
 *   此时显示"赛事 #N (已删除)"，而不是尝试链接到不存在的详情页。
 *
 * 【响应式表格】
 *   桌面端（sm+）：完整的 HTML table，含表头和列对齐
 *   移动端（<sm）：三个卡片式行，每行显示全部关键信息
 */
"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { useUserAllBets, usePreviewReward } from "@/hooks/useUserBets";
import { useAllMatches } from "@/hooks/useMatches";
import { useMounted } from "@/hooks/useMounted";
import { useClaimReward } from "@/hooks/useClaimReward";
import { TeamNameDisplay } from "@/components/shared/TeamNameDisplay";
import { AmountDisplay } from "@/components/shared/AmountDisplay";
import { MatchStatusBadge } from "@/components/shared/MatchStatusBadge";
import { TableSkeleton, CardListSkeleton } from "@/components/shared/Skeleton";
import { Result } from "@/lib/constants";
import { RESULT_KEYS } from "@/lib/constants";
import type { MatchStruct, UserAllBetsTuple } from "@/lib/types";
import { formatUSDT, formatTime, decodeTeamName } from "@/lib/utils";
import { translateName } from "@/lib/nameMap";
import { useT, useLang } from "@/lib/i18n";
import Link from "next/link";

export default function MyBetsPage() {
  const t = useT();
  const { lang } = useLang();
  const mounted = useMounted();
  const { address, isConnected } = useAccount();
  const { data: betsRaw, isLoading: betsLoading } = useUserAllBets();
  const { data: matches, isLoading: matchesLoading } = useAllMatches();
  const [page, setPage] = useState(0);
  const [sortNewest, setSortNewest] = useState(true);
  const [filterDate, setFilterDate] = useState("");
  const [filterTeam, setFilterTeam] = useState("");

  useEffect(() => { window.scrollTo({ top: 0, behavior: "smooth" }); }, [page]);

  if (!mounted) {
    return <div className="text-center py-20 text-slate-400">{t("common.loading")}</div>;
  }
  if (!isConnected) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500 text-lg">{t("common.connectWallet")}</p>
      </div>
    );
  }

  const bets = betsRaw as UserAllBetsTuple | undefined;
  const matchList: MatchStruct[] = (matches as MatchStruct[]) ?? [];
  const loading = betsLoading || matchesLoading;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse bg-slate-200 rounded h-7 w-28" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-3 shadow-sm border border-slate-200 text-center">
              <div className="animate-pulse bg-slate-200 rounded h-3 w-12 mx-auto mb-1" />
              <div className="animate-pulse bg-slate-200 rounded h-6 w-10 mx-auto" />
            </div>
          ))}
        </div>
        <TableSkeleton rows={5} cols={5} />
        <div className="sm:hidden">
          <CardListSkeleton count={4} />
        </div>
      </div>
    );
  }

  if (!bets || bets[0].length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500 text-lg">{t("myBets.noBets")}</p>
        <Link href="/matches" className="text-blue-600 text-sm mt-2 inline-block">{t("myBets.goBet")}</Link>
      </div>
    );
  }

  const [matchIds, amounts, betOns, rewards, claimed] = bets;

  let totalWagered = 0n;
  let totalWon = 0n;
  let winCount = 0;
  for (let i = 0; i < matchIds.length; i++) {
    totalWagered += amounts[i];
    if (rewards[i] > 0n) {
      totalWon += rewards[i];
      winCount++;
    }
  }

  // 分页：每页最多 15 条，按 startTime 排序
  const PAGE_SIZE = 15;
  const order = matchIds.map((_, i) => i).sort((a, b) => {
    const matchA = matchList.find((_m, j) => j + 1 === Number(matchIds[a]));
    const matchB = matchList.find((_m, j) => j + 1 === Number(matchIds[b]));
    const timeA = matchA ? matchA.startTime : 0n;
    const timeB = matchB ? matchB.startTime : 0n;
    const cmp = Number(timeA - timeB);
    return sortNewest ? -cmp : cmp;
  });
  // Apply date + team filters to the sorted order
  const filteredOrder = order.filter((i) => {
    const mid = matchIds[i];
    const match = matchList.find((_m, j) => j + 1 === Number(mid));
    if (!match) return false; // deleted match
    // Date filter
    if (filterDate) {
      const matchDate = new Date(Number(match.startTime) * 1000);
      const matchDateStr = matchDate.toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" });
      const filterDateStr = new Date(filterDate + "T00:00:00+08:00").toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" });
      if (matchDateStr !== filterDateStr) return false;
    }
    // Team name filter (bilingual)
    if (filterTeam.trim()) {
      const q = filterTeam.trim().toLowerCase();
      const homeRaw = decodeTeamName(match.homeTeam ?? "");
      const awayRaw = decodeTeamName(match.awayTeam ?? "");
      const homes = [homeRaw.toLowerCase(), translateName(homeRaw, "zh").toLowerCase(), translateName(homeRaw, "en").toLowerCase()];
      const aways = [awayRaw.toLowerCase(), translateName(awayRaw, "zh").toLowerCase(), translateName(awayRaw, "en").toLowerCase()];
      if (!homes.some((h) => h.includes(q)) && !aways.some((a) => a.includes(q))) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredOrder.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageOrder = filteredOrder.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="space-y-6" key={address}>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t("myBets.title")}</h1>
        <button
          onClick={() => { setSortNewest((v) => !v); setPage(0); }}
          className="px-3 py-1.5 rounded-full text-xs bg-white text-slate-600 border border-slate-200 hover:border-blue-300 transition"
        >
          {sortNewest ? t("sort.newest") : t("sort.oldest")} ⇅
        </button>
      </div>

      {/* Filter bar: date + team search */}
      <div className="flex gap-3 flex-wrap items-center">
        <label className="flex items-center gap-2 text-sm text-slate-500">
          <span>{t("filter.date")}</span>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => { setFilterDate(e.target.value); setPage(0); }}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:border-blue-400 transition"
          />
          {filterDate && (
            <button
              onClick={() => { setFilterDate(""); setPage(0); }}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          )}
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-500">
          <span>{t("filter.team")}</span>
          <input
            type="text"
            value={filterTeam}
            onChange={(e) => { setFilterTeam(e.target.value); setPage(0); }}
            placeholder={t("filter.teamPlaceholder")}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm bg-white w-40 focus:outline-none focus:border-blue-400 transition"
          />
          {filterTeam && (
            <button
              onClick={() => { setFilterTeam(""); setPage(0); }}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          )}
        </label>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <StatCard label={t("myBets.totalBets")} value={String(matchIds.length)} />
        <StatCard label={t("myBets.wins")} value={String(winCount)} />
        <StatCard label={t("myBets.winRate")} value={matchIds.length > 0 ? `${((winCount / matchIds.length) * 100).toFixed(1)}%` : "-"} />
        <StatCard
          label={t("myBets.profit")}
          value={`${totalWon > totalWagered ? "+" : ""}${formatUSDT(totalWon > totalWagered ? totalWon - totalWagered : totalWagered - totalWon)} USDT`}
          color={totalWon >= totalWagered ? "text-green-600" : "text-red-500"}
        />
      </div>

      {/* Claim All banner — shows total claimable rewards */}
      {(() => {
        const claimable: number[] = [];
        for (let i = 0; i < matchIds.length; i++) {
          if (claimed[i]) continue;
          const match = matchList.find((_m, j) => j + 1 === Number(matchIds[i]));
          if (match && match.settled && betOns[i] === match.result) {
            claimable.push(i);
          }
        }
        if (claimable.length === 0) return null;
        return (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="text-green-800 font-semibold">{t("myBets.claimableTotal")}</p>
                <p className="text-xs text-green-600 mt-0.5">{t("myBets.claimableHint").replace("{count}", String(claimable.length))}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {claimable.map((i) => (
                <ClaimButton key={Number(matchIds[i])} matchId={Number(matchIds[i])} />
              ))}
            </div>
          </div>
        );
      })()}

      {/* Desktop table */}
      <div key={`d-${safePage}-${String(sortNewest)}-${filterDate}-${filterTeam}`} className="hidden sm:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-page-enter">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-4 py-3">{t("myBets.table.match")}</th>
                <th className="text-left px-4 py-3">{t("myBets.table.prediction")}</th>
                <th className="text-right px-4 py-3">{t("myBets.table.amount")}</th>
                <th className="text-right px-4 py-3">{t("myBets.table.result")}</th>
                <th className="text-center px-4 py-3">{t("myBets.table.status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageOrder.map((i) => {
                const mid = matchIds[i];
                const match = matchList.find((_m, j) => j + 1 === Number(mid));
                return (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      {match && match.startTime > 0n ? (
                        <Link href={`/matches/${mid}`} className="text-blue-600 hover:underline">
                          {match.matchName && match.matchName !== "0x0000000000000000000000000000000000000000000000000000000000000000" && (
                            <div className="text-[10px] text-slate-400">{translateName(decodeTeamName(match.matchName), lang)}</div>
                          )}
                          <span className="inline-flex items-center gap-1.5"><TeamNameDisplay hex={match.homeTeam} /><span className="text-slate-400 text-xs">VS</span><TeamNameDisplay hex={match.awayTeam} flagAfter /></span>
                          <div className="text-[10px] text-slate-400 mt-0.5">{formatTime(match.startTime)}</div>
                        </Link>
                      ) : (
                        <span className="text-slate-400">{t("common.matchNum")}{String(mid)} {match ? t("myBets.deleted") : ""}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{t(RESULT_KEYS[betOns[i] as Result])}</td>
                    <td className="px-4 py-3 text-right"><AmountDisplay amount={amounts[i]} /></td>
                    <td className="px-4 py-3 text-right">
                      {(() => {
                        if (claimed[i]) {
                          return rewards[i] > 0n
                            ? <span className="text-green-600">+<AmountDisplay amount={rewards[i]} /></span>
                            : <span className="text-red-500">-<AmountDisplay amount={amounts[i]} /></span>;
                        }
                        if (match && match.settled) {
                          return betOns[i] === match.result
                            ? <span className="text-green-600 font-medium">{t("common.correct")}</span>
                            : <span className="text-red-500 font-medium">{t("common.incorrect")}</span>;
                        }
                        return <span className="text-slate-400">-</span>;
                      })()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {claimed[i] ? "✅"
                        : match?.settled && betOns[i] === match.result
                          ? <ClaimButton matchId={Number(mid)} />
                          : match?.settled
                            ? "✅"
                            : "⏳"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile card list */}
      <div key={`m-${safePage}-${String(sortNewest)}-${filterDate}-${filterTeam}`} className="sm:hidden space-y-3 animate-page-enter">
        {pageOrder.map((i) => {
          const mid = matchIds[i];
          const match = matchList.find((_m, j) => j + 1 === Number(mid));
          const deleted = !match || match.startTime === 0n;
          return (
            <div key={i} className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {!deleted ? (
                    <Link href={`/matches/${mid}`} className="text-blue-600 hover:underline text-sm">
                      <span className="inline-flex items-center gap-1.5">
                        <TeamNameDisplay hex={match!.homeTeam} />
                        <span className="text-slate-400 text-xs">VS</span>
                        <TeamNameDisplay hex={match!.awayTeam} flagAfter />
                      </span>
                      <div className="text-[10px] text-slate-400 mt-0.5">{formatTime(match!.startTime)}</div>
                    </Link>
                  ) : (
                    <span className="text-slate-400 text-sm">{t("common.matchNum")}{String(mid)} {match ? t("myBets.deleted") : ""}</span>
                  )}
                </div>
                <div className="text-xs">
                  {claimed[i] ? "✅"
                    : match?.settled && betOns[i] === match.result
                      ? <ClaimButton matchId={Number(mid)} />
                      : match?.settled
                        ? "✅"
                        : "⏳"}
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>{t("myBets.table.prediction")}: <b>{t(RESULT_KEYS[betOns[i] as Result])}</b></span>
                <AmountDisplay amount={amounts[i]} />
              </div>
              {match && (
                <div className="mt-1 text-xs text-slate-500">
                  {match.settled && (
                    betOns[i] === match.result
                      ? <span className="text-green-600">{t("common.correct")}</span>
                      : <span className="text-red-500">{t("common.incorrect")}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 py-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={safePage === 0}
            aria-label={t("page.prev")}
            className="px-4 py-2 rounded-lg text-base border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            ←
          </button>
          <span className="text-sm text-slate-500 tabular-nums">
            {safePage + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={safePage >= totalPages - 1}
            aria-label={t("page.next")}
            className="px-4 py-2 rounded-lg text-base border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color = "text-slate-800" }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-200 text-center">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-lg font-bold mt-0.5 ${color}`}>{value}</p>
    </div>
  );
}

/** Claim button that uses previewReward to show the actual claimable amount */
function ClaimButton({ matchId }: { matchId: number }) {
  const t = useT();
  const { data: preview } = usePreviewReward(matchId);
  const { handleClaim, isClaiming, isConfirming, isClaimed } = useClaimReward(matchId);
  const reward = (preview as bigint) ?? 0n;

  if (isClaimed || reward <= 0n) {
    return <span className="text-green-600 text-xs">✅ {t("claim.alreadyClaimed")}</span>;
  }

  return (
    <button
      onClick={handleClaim}
      disabled={isClaiming || isConfirming}
      className="px-2 py-1 text-xs rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition"
    >
      {isClaiming ? t("claim.claiming") : isConfirming ? t("bet.confirming") : `${t("claim.reward")} ${formatUSDT(reward)}`}
    </button>
  );
}
