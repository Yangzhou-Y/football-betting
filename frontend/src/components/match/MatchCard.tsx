"use client";

import Link from "next/link";
import { TeamNameDisplay } from "@/components/shared/TeamNameDisplay";
import { MatchStatusBadge } from "@/components/shared/MatchStatusBadge";
import { MatchStatus, RESULT_KEYS, Result } from "@/lib/constants";
import { formatUSDT, formatTime, decodeTeamName, calcOdds } from "@/lib/utils";
import { translateName } from "@/lib/nameMap";
import { useDeploymentConfig } from "@/lib/config";
import { useT, useLang } from "@/lib/i18n";
import type { MatchStruct } from "@/lib/types";

/**
 * ============================================================================
 * MatchCard — 赛事卡片组件，用于首页、赛事列表、我的竞猜等多处展示
 * ============================================================================
 *
 * 【显示内容】
 *   - 状态徽章（MatchStatusBadge）+ 可领取/已投注 动画徽章
 *   - 比赛名称（自动中英翻译）+ 开赛时间
 *   - 主队名 + VS + 客队名（含国旗）
 *   - 已开奖赛事：显示比分
 *   - 奖池总额 + 三选项比例条（主胜/平局/客胜）
 *   - 底部状态提示（投注 / 已截止 / 等待开奖 / 查看详情）
 *
 * 【交互】
 *   整个卡片是一个 <Link>，点击跳转到 /matches/{matchId} 详情页。
 *   hover 时有边框变蓝 + 阴影效果。
 *
 * 【视觉设计】
 *   - 可领取徽章：绿色 + emoji 💰 + animate-claim（pulse 动画）
 *   - 已投注徽章：橙色 + emoji 🔥 + animate-fire
 *   - 比例条：蓝(主胜)/灰(平局)/红(客胜)，宽度由奖池占比决定
 */
export function MatchCard({ match, matchId, hasBet, won, claimed, participantCount }: { match: MatchStruct; matchId: number; hasBet?: boolean; won?: boolean; claimed?: boolean; participantCount?: number }) {
  const t = useT();
  const { lang } = useLang();
  const { platformFeeRate } = useDeploymentConfig();
  const { status, result, matchName, homeTeam, awayTeam, poolHome, poolDraw, poolAway, totalPool, startTime } = match;
  const decodedName = translateName(decodeTeamName(matchName), lang);

  const homeOdds = calcOdds(poolHome, totalPool, platformFeeRate);
  const drawOdds = calcOdds(poolDraw, totalPool, platformFeeRate);
  const awayOdds = calcOdds(poolAway, totalPool, platformFeeRate);

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
        <span className="text-xs text-slate-400 shrink-0">{formatTime(startTime, lang)}</span>
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
        <div className="text-center text-2xl font-bold mb-2 tabular-nums">
          {String(match.homeScore)}∶{String(match.awayScore)}
        </div>
      )}

      <div className="flex items-center justify-center gap-2 text-sm text-slate-500 mb-2 whitespace-nowrap">
        <span>{t("pool.label")} <span className="font-medium text-slate-700 tabular-nums">{formatUSDT(totalPool)} USDT</span></span>
        {participantCount != null && participantCount > 0 && (
          <span className="text-xs text-slate-400">· {participantCount} {t("card.participants")}</span>
        )}
      </div>

      {totalPool > 0n && (
        <>
          <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
            <div className="bg-blue-500" style={{ width: `${homePct}%` }} title={`${t("result.homeWin")} ${homePct}%`} />
            {match.allowDraw !== false && (
              <div className="bg-gray-400" style={{ width: `${drawPct}%` }} title={`${t("result.draw")} ${drawPct}%`} />
            )}
            <div className="bg-red-400" style={{ width: `${awayPct}%` }} title={`${t("result.awayWin")} ${awayPct}%`} />
          </div>
          <div className={`grid ${match.allowDraw !== false ? "grid-cols-3" : "grid-cols-2"} gap-1 mt-1.5 text-[10px]`}>
            <span className="text-center text-blue-500">{t(RESULT_KEYS[Result.HomeWin])} {homeOdds ?? "-"}</span>
            {match.allowDraw !== false && <span className="text-center text-slate-400">{t(RESULT_KEYS[Result.Draw])} {drawOdds ?? "-"}</span>}
            <span className="text-center text-red-400">{t(RESULT_KEYS[Result.AwayWin])} {awayOdds ?? "-"}</span>
          </div>
        </>
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
