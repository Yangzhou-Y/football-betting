"use client";

import { useAccount } from "wagmi";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import type { LeaderboardEntry } from "@/hooks/useLeaderboard";
import { useMounted } from "@/hooks/useMounted";
import { formatUSDT } from "@/lib/utils";
import { useT } from "@/lib/i18n";

const MEDAL_ICONS: Record<number, string> = {
  0: "1",
  1: "2",
  2: "3",
};

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
  const { address, isConnected } = useAccount();
  const { leaderboard, settledMatches, isLoading, isError, error } = useLeaderboard() as any;

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
          <p className="text-sm mt-1">{(error as any)?.shortMessage || ""}</p>
        </div>
      )}

      {!isError && isLoading && (
        <div className="text-center py-20 text-slate-400">
          <div className="animate-spin inline-block w-6 h-6 border-2 border-slate-300 border-t-blue-600 rounded-full mb-2" />
          <p>{t("leaderboard.loading")}</p>
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
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-center px-4 py-3 w-12">#</th>
                    <th className="text-left px-4 py-3">{t("leaderboard.address")}</th>
                    <th className="text-center px-3 py-3 hidden sm:table-cell">{t("leaderboard.totalBets")}</th>
                    <th className="text-center px-3 py-3">{t("leaderboard.wins")}</th>
                    <th className="text-center px-3 py-3 hidden md:table-cell">{t("leaderboard.winRate")}</th>
                    <th className="text-right px-3 py-3 hidden md:table-cell">{t("leaderboard.wagered")}</th>
                    <th className="text-right px-3 py-3">{t("leaderboard.profit")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leaderboard.map((entry: LeaderboardEntry, i: number) => {
                    const isMe = address && entry.address === address.toLowerCase();
                    return (
                      <tr
                        key={entry.address}
                        className={`${isMe ? "bg-blue-50" : i % 2 === 0 ? "bg-white" : "bg-slate-50/50"} hover:bg-slate-100 transition-colors`}
                      >
                        <td className="text-center px-4 py-3">
                          <RankBadge rank={i} />
                        </td>
                        <td className="px-4 py-3">
                          <span className={`font-mono text-xs ${isMe ? "text-blue-700 font-semibold" : "text-slate-700"}`}>
                            {entry.shortAddress}
                          </span>
                          {isMe && (
                            <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-200 text-blue-700 font-medium">
                              YOU
                            </span>
                          )}
                        </td>
                        <td className="text-center px-3 py-3 text-slate-600 hidden sm:table-cell">
                          {entry.totalBets}
                        </td>
                        <td className="text-center px-3 py-3">
                          <span className="font-medium text-slate-700">{entry.wins}</span>
                        </td>
                        <td className="text-center px-3 py-3 hidden md:table-cell">
                          <span className={`${entry.winRate >= 50 ? "text-green-600" : entry.winRate > 0 ? "text-orange-500" : "text-slate-400"}`}>
                            {entry.winRate}%
                          </span>
                        </td>
                        <td className="text-right px-3 py-3 text-slate-600 hidden md:table-cell">
                          {formatUSDT(entry.totalWagered)}
                        </td>
                        <td className="text-right px-3 py-3 font-mono text-xs">
                          <ProfitDisplay profit={entry.profit} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-xs text-slate-400 text-center">{t("leaderboard.rankingBy")}</p>
        </>
      )}

      <div className="bg-blue-50 rounded-xl p-5 border border-blue-200">
        <p className="text-sm text-blue-700">{t("leaderboard.mvpHint")}</p>
      </div>
    </div>
  );
}
