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

import { useState } from "react";
import { useAccount } from "wagmi";
import { useUserAllBets } from "@/hooks/useUserBets";
import { useAllMatches } from "@/hooks/useMatches";
import { useMounted } from "@/hooks/useMounted";
import { TeamNameDisplay } from "@/components/shared/TeamNameDisplay";
import { AmountDisplay } from "@/components/shared/AmountDisplay";
import { MatchStatusBadge } from "@/components/shared/MatchStatusBadge";
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
  const { data: betsRaw } = useUserAllBets();
  const { data: matches } = useAllMatches();
  const [page, setPage] = useState(0);

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

  // 分页：每页最多 15 条，按 startTime 降序（最近发生的比赛排在最前）
  const PAGE_SIZE = 15;
  const order = matchIds.map((_, i) => i).sort((a, b) => {
    const matchA = matchList.find((_m, j) => j + 1 === Number(matchIds[a]));
    const matchB = matchList.find((_m, j) => j + 1 === Number(matchIds[b]));
    const timeA = matchA ? matchA.startTime : 0n;
    const timeB = matchB ? matchB.startTime : 0n;
    return Number(timeB - timeA);
  });
  const totalPages = Math.max(1, Math.ceil(order.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageOrder = order.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="space-y-6" key={address}>
      <h1 className="text-xl font-bold">{t("myBets.title")}</h1>

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

      {/* Desktop table */}
      <div key={`d-${safePage}`} className="hidden sm:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-page-enter">
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
                        : match?.settled
                          ? betOns[i] === match.result
                            ? <span className="text-green-500 text-lg">{"💰"}</span>
                            : "✅"
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
      <div key={`m-${safePage}`} className="sm:hidden space-y-3 animate-page-enter">
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
                    : match?.settled
                      ? betOns[i] === match.result
                        ? <span className="text-green-500">{"💰"}</span>
                        : "✅"
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
