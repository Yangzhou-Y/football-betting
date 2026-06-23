"use client";

import Link from "next/link";
import { TeamNameDisplay } from "@/components/shared/TeamNameDisplay";
import { MatchStatusBadge } from "@/components/shared/MatchStatusBadge";
import { MatchStatus } from "@/lib/constants";
import { formatUSDT, formatTime, decodeTeamName } from "@/lib/utils";
import { translateName } from "@/lib/nameMap";
import { useT, useLang } from "@/lib/i18n";
import type { MatchStruct } from "@/lib/types";

export function MatchCard({ match, matchId, hasBet, won, claimed }: { match: MatchStruct; matchId: number; hasBet?: boolean; won?: boolean; claimed?: boolean }) {
  const t = useT();
  const { lang } = useLang();
  const { status, result, matchName, homeTeam, awayTeam, poolHome, poolDraw, poolAway, totalPool, startTime } = match;
  const decodedName = translateName(decodeTeamName(matchName), lang);

  const settled = status === MatchStatus.Settled;
  const showClaimable = hasBet && settled && won && !claimed;
  const showBetBadge = hasBet && !settled;
  const now = BigInt(Math.floor(Date.now() / 1000));
  const deadlinePassed = status === MatchStatus.Open && match.deadline > 0n && now >= match.deadline;

  const total = totalPool > 0n ? totalPool : 1n;
  const homePct = Number((poolHome * 100n) / total);
  const drawPct = Number((poolDraw * 100n) / total);
  const awayPct = Number((poolAway * 100n) / total);

  return (
    <Link
      href={`/matches/${matchId}`}
      className="block bg-white rounded-xl p-4 shadow-sm border border-slate-200 hover:shadow-md hover:border-blue-300 transition"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <MatchStatusBadge status={status} deadline={match.deadline} />
          {showClaimable && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500 text-white font-bold animate-claim">💰 {t("badge.claimable")}</span>
          )}
          {showBetBadge && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-500 text-white font-bold animate-fire">🔥 {t("badge.bet")}</span>
          )}
        </div>
        <span className="text-xs text-slate-400">{formatTime(startTime, lang)}</span>
      </div>

      {decodedName && (
        <p className="text-xs text-slate-500 mb-2 text-center">{decodedName}</p>
      )}

      <div className="flex items-center justify-center gap-2 mb-3">
        <TeamNameDisplay hex={homeTeam} className="font-semibold" />
        <span className="text-xs sm:text-sm text-slate-400 font-medium shrink-0">VS</span>
        <TeamNameDisplay hex={awayTeam} flagAfter className="font-semibold" />
      </div>

      {status === MatchStatus.Settled && (
        <div className="text-center text-2xl font-bold mb-2">
          {String(match.homeScore)} : {String(match.awayScore)}
        </div>
      )}

      <div className="text-center text-sm text-slate-500 mb-2">
        {t("pool.label")} <span className="font-medium text-slate-700">{formatUSDT(totalPool)} USDT</span>
      </div>

      {totalPool > 0n && (
        <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
          <div className="bg-blue-500" style={{ width: `${homePct}%` }} title={`${t("result.homeWin")} ${homePct}%`} />
          {match.allowDraw !== false && (
            <div className="bg-gray-400" style={{ width: `${drawPct}%` }} title={`${t("result.draw")} ${drawPct}%`} />
          )}
          <div className="bg-red-400" style={{ width: `${awayPct}%` }} title={`${t("result.awayWin")} ${awayPct}%`} />
        </div>
      )}

      <div className="mt-3 text-center">
        {status === MatchStatus.Open && !deadlinePassed && (
          <span className="text-sm text-blue-600 font-medium">🎯 {t("bet.bet")}</span>
        )}
        {status === MatchStatus.Open && deadlinePassed && (
          <span className="text-sm text-orange-500">{t("match.status.deadlinePassed")}</span>
        )}
        {status === MatchStatus.Closed && (
          <span className="text-sm text-yellow-600">{t("common.waitingForResult")}</span>
        )}
        {status === MatchStatus.Settled && (
          <span className="text-sm text-slate-500">{t("common.viewDetails")}</span>
        )}
      </div>
    </Link>
  );
}
