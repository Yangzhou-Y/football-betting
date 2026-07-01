/**
 * ============================================================================
 * 排行榜页 — 链上事件聚合的全局投注排行榜
 * ============================================================================
 *
 * 【排名算法】
 *   ① 盈亏（profit = 总奖励 - 总投注）降序排列
 *   ② 盈亏相同时，胜率降序
 *   ③ 取前 100 名（TOP_N = 100）
 *
 * 【排名标识】
 *   前三名显示奖牌：🏅(金) / 🥈(银) / 🥉(铜)
 *   当前用户所在行高亮（蓝色背景 + "YOU" 标签）
 *
 * 【数据来源】
 *   扫描链上 BetPlaced 和 RewardClaimed 事件，
 *   在前端进行用户级聚合。具体见 useLeaderboard hook。
 *
 * 【响应式展示】
 *   桌面端（sm+）：完整数据表格（排名/地址/投注场次/猜中/胜率/累计投注/盈亏）
 *   移动端（<sm）：卡片列表（排名/地址/盈亏 + 胜率/场次）
 *
 * 【刷新机制】
 *   排行榜数据不会随交易自动刷新（已排除在 invalidateQueries 之外），
 *   因为每次投注都重扫全量事件成本太高。用户切换页面或手动刷新时重新获取。
 */
"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import { useMounted } from "@/hooks/useMounted";
import { TableSkeleton, CardListSkeleton } from "@/components/shared/Skeleton";
import { formatUSDT } from "@/lib/utils";
import { useT } from "@/lib/i18n";

const PAGE_SIZE = 20;

/** 前三名奖牌图标（index 0=第1名金牌, 1=第2名银牌, 2=第3名铜牌） */
const MEDAL_ICONS: Record<number, string> = {
  0: "1",
  1: "2",
  2: "3",
};

/** 盈亏显示组件 — 正数绿色 + 前缀，负数红色 - 前缀，零为灰色 */
function ProfitDisplay({ profit }: { profit: bigint }) {
  if (profit > 0n) {
    return <span className="text-green-600 font-medium">+{formatUSDT(profit)}</span>;
  }
  if (profit < 0n) {
    return <span className="text-red-500 font-medium">-{formatUSDT(-profit)}</span>;
  }
  return <span className="text-slate-400">0.00</span>;
}

function RankBadge({ rank }: { rank: number }) {
  if (rank < 3) {
    return (
      <span
        className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-white text-xs font-bold ${
          rank === 0 ? "bg-yellow-500" : rank === 1 ? "bg-slate-400" : "bg-amber-600"
        }`}
      >
        {MEDAL_ICONS[rank]}
      </span>
    );
  }
  return <span className="text-slate-500 text-sm">{rank + 1}</span>;
}

export default function LeaderboardPage() {
  const t = useT();
  const mounted = useMounted();
  const { address } = useAccount();
  const { leaderboard, settledMatches, isLoading, isError, error, scanProgress } = useLeaderboard();
  const [page, setPage] = useState(0);
  const [jumpInput, setJumpInput] = useState("");

  useEffect(() => { window.scrollTo({ top: 0, behavior: "smooth" }); }, [page]);

  if (!mounted) {
    return <div className="text-center py-20 text-slate-400">{t("common.loading")}</div>;
  }

  const totalPages = Math.max(1, Math.ceil(leaderboard.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pagedLeaderboard = leaderboard.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t("leaderboard.title")}</h1>
      </div>

      <p className="text-sm text-slate-500">
        {t("leaderboard.dataFromChain")
          .replace("{count}", String(settledMatches.length))
          .replace("{users}", String(leaderboard.length))}
      </p>

      {isError && (
        <div className="text-center py-16 text-slate-400">
          <p className="text-red-500 text-lg">{t("leaderboard.loading")}</p>
          <p className="text-sm mt-1">{(error as Error)?.message || ""}</p>
        </div>
      )}

      {!isError && isLoading && (
        <div className="space-y-6">
          {scanProgress.total > 1 && (
            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
              <p className="text-sm text-slate-600 mb-2">{t("leaderboard.scanning")} ({scanProgress.current}/{scanProgress.total})</p>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-300"
                  style={{ width: `${Math.round((scanProgress.current / scanProgress.total) * 100)}%` }}
                />
              </div>
            </div>
          )}
          <TableSkeleton rows={6} cols={7} />
          <div className="sm:hidden">
            <CardListSkeleton count={4} />
          </div>
        </div>
      )}

      {!isLoading && settledMatches.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <p className="text-lg">{t("leaderboard.noSettledMatches")}</p>
        </div>
      )}

      {!isLoading && settledMatches.length > 0 && leaderboard.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <p className="text-lg">{t("leaderboard.noData")}</p>
        </div>
      )}

      {!isLoading && leaderboard.length > 0 && (
        <>
          {/* Desktop table */}
          <div key={`d-${safePage}`} className="hidden sm:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-page-enter">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-center px-4 py-3 w-12">#</th>
                  <th className="text-left px-4 py-3">{t("leaderboard.address")}</th>
                  <th className="text-center px-3 py-3">{t("leaderboard.totalBets")}</th>
                  <th className="text-center px-3 py-3">{t("leaderboard.wins")}</th>
                  <th className="text-center px-3 py-3 hidden md:table-cell">{t("leaderboard.winRate")}</th>
                  <th className="text-right px-3 py-3 hidden md:table-cell">{t("leaderboard.wagered")}</th>
                  <th className="text-right px-3 py-3">{t("leaderboard.profit")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pagedLeaderboard.map((entry, i) => {
                  const globalRank = safePage * PAGE_SIZE + i;
                  const isMe = address && entry.address === address.toLowerCase();
                  return (
                    <tr
                      key={entry.address}
                      className={`${isMe ? "bg-blue-50" : i % 2 === 0 ? "bg-white" : "bg-slate-50/50"} hover:bg-slate-100 transition-colors`}
                    >
                      <td className="text-center px-4 py-3"><RankBadge rank={globalRank} /></td>
                      <td className="px-4 py-3">
                        <span className={`font-mono text-xs ${isMe ? "text-blue-700 font-semibold" : "text-slate-700"}`}>
                          {entry.shortAddress}
                        </span>
                        {isMe && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-200 text-blue-700 font-medium">YOU</span>}
                      </td>
                      <td className="text-center px-3 py-3 text-slate-600">{entry.totalBets}</td>
                      <td className="text-center px-3 py-3"><span className="font-medium text-slate-700">{entry.wins}</span></td>
                      <td className="text-center px-3 py-3 hidden md:table-cell">
                        <span className={`${entry.winRate >= 50 ? "text-green-600" : entry.winRate > 0 ? "text-orange-500" : "text-slate-400"}`}>{entry.winRate}%</span>
                      </td>
                      <td className="text-right px-3 py-3 text-slate-600 hidden md:table-cell">{formatUSDT(entry.totalWagered)}</td>
                      <td className="text-right px-3 py-3 font-mono text-xs"><ProfitDisplay profit={entry.profit} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div key={`m-${safePage}`} className="sm:hidden space-y-2 animate-page-enter">
            {pagedLeaderboard.map((entry, i) => {
              const globalRank = safePage * PAGE_SIZE + i;
              const isMe = address && entry.address === address.toLowerCase();
              return (
                <div key={entry.address} className={`rounded-xl p-3 border ${isMe ? "bg-blue-50 border-blue-200" : "bg-white border-slate-200"}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <RankBadge rank={globalRank} />
                      <span className={`font-mono text-xs ${isMe ? "text-blue-700 font-semibold" : "text-slate-700"}`}>
                        {entry.shortAddress}
                      </span>
                      {isMe && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-200 text-blue-700 font-medium">YOU</span>}
                    </div>
                    <ProfitDisplay profit={entry.profit} />
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                    <span>{t("leaderboard.totalBets")}: <b className="text-slate-700">{entry.totalBets}</b></span>
                    <span>{t("leaderboard.wins")}: <b className="text-slate-700">{entry.wins}</b></span>
                    <span>{t("leaderboard.winRate")}: <b className={entry.winRate >= 50 ? "text-green-600" : entry.winRate > 0 ? "text-orange-500" : "text-slate-400"}>{entry.winRate}%</b></span>
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 py-4">
              <button
                onClick={() => setPage(0)}
                disabled={safePage === 0}
                aria-label={t("page.first")}
                className="px-3 py-2 rounded-lg text-base border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                title={t("page.first")}
              >
                &laquo;
              </button>
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={safePage === 0}
                aria-label={t("page.prev")}
                className="px-4 py-2 rounded-lg text-base border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                &larr;
              </button>
              <span className="text-sm text-slate-500 tabular-nums min-w-[80px] text-center">
                {safePage + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={safePage >= totalPages - 1}
                aria-label={t("page.next")}
                className="px-4 py-2 rounded-lg text-base border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                &rarr;
              </button>
              <button
                onClick={() => setPage(totalPages - 1)}
                disabled={safePage >= totalPages - 1}
                aria-label={t("page.last")}
                className="px-3 py-2 rounded-lg text-base border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                title={t("page.last")}
              >
                &raquo;
              </button>
              <span className="text-sm text-slate-400 mx-1">{t("page.jumpTo")}</span>
              <input
                type="number"
                min={1}
                max={totalPages}
                value={jumpInput}
                onChange={(e) => setJumpInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const n = parseInt(jumpInput);
                    if (n >= 1 && n <= totalPages) { setPage(n - 1); setJumpInput(""); }
                  }
                }}
                placeholder={`1-${totalPages}`}
                className="w-16 px-2 py-1.5 rounded-lg border border-slate-200 text-sm text-center bg-white focus:outline-none focus:border-blue-400 transition"
              />
              <button
                onClick={() => {
                  const n = parseInt(jumpInput);
                  if (n >= 1 && n <= totalPages) { setPage(n - 1); setJumpInput(""); }
                }}
                disabled={!jumpInput}
                className="px-3 py-1.5 rounded-lg text-sm border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                {t("page.go")}
              </button>
            </div>
          )}

          <p className="text-xs text-slate-400 text-center mt-4">{t("leaderboard.rankingBy")}</p>
        </>
      )}

      <div className="bg-blue-50 rounded-xl p-5 border border-blue-200">
        <p className="text-sm text-blue-700">{t("leaderboard.mvpHint")}</p>
      </div>
    </div>
  );
}
