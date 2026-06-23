"use client";

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
import { formatUSDT, decodeTeamName } from "@/lib/utils";
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

  return (
    <div className="space-y-6" key={address}>
      <h1 className="text-xl font-bold">{t("myBets.title")}</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label={t("myBets.totalBets")} value={String(matchIds.length)} />
        <StatCard label={t("myBets.wins")} value={String(winCount)} />
        <StatCard label={t("myBets.winRate")} value={matchIds.length > 0 ? `${((winCount / matchIds.length) * 100).toFixed(1)}%` : "-"} />
        <StatCard
          label={t("myBets.profit")}
          value={`${totalWon > totalWagered ? "+" : ""}${formatUSDT(totalWon > totalWagered ? totalWon - totalWagered : totalWagered - totalWon)} USDT`}
          color={totalWon >= totalWagered ? "text-green-600" : "text-red-500"}
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
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
              {matchIds.map((mid, i) => {
                const match = matchList.find((_m, j) => j + 1 === Number(mid));
                return (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      {match && (match.startTime ?? 0n) > 0n ? (
                        <Link href={`/matches/${mid}`} className="text-blue-600 hover:underline">
                          {match.matchName && match.matchName !== "0x0000000000000000000000000000000000000000000000000000000000000000" && (
                            <div className="text-[10px] text-slate-400">{translateName(decodeTeamName(match.matchName), lang)}</div>
                          )}
                          <span className="inline-flex items-center gap-1.5"><TeamNameDisplay hex={match.homeTeam} /><span className="text-slate-400 text-xs">VS</span><TeamNameDisplay hex={match.awayTeam} flagAfter /></span>
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
                            ? <span className="text-green-500 text-lg">💰</span>
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
