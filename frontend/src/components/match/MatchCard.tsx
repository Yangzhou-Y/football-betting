"use client";

import { useState, useEffect } from "react";
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

  // Countdown to deadline (updates every second)
  const [countdown, setCountdown] = useState("");
  useEffect(() => {
    if (status !== MatchStatus.Open || match.deadline <= 0n) return;
    const tick = () => {
      const remaining = Number(match.deadline) - Math.floor(Date.now() / 1000);
      if (remaining <= 0) { setCountdown(""); return; }
      const h = Math.floor(remaining / 3600);
      const m = Math.floor((remaining % 3600) / 60);
      const s = remaining % 60;
      setCountdown(h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [status, match.deadline]);

  const total = totalPool > 0n ? totalPool : 1n;
  const homePct = Number((poolHome * 100n) / total);
  const drawPct = Number((poolDraw * 100n) / total);
  const awayPct = Number((poolAway * 100n) / total);

  return (
    <Link
      href={`/matches/${matchId}`}
      className="block bg-white rounded-xl p-4 shadow-sm border border-slate-200 hover:shadow-md hover:border-blue-300 transition"
    >
      <div className="flex items-center justify-between mb-3">
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

      <div className="flex items-center justify-center gap-2 sm:gap-3 mb-1.5">
        <TeamNameDisplay hex={homeTeam} className="font-bold text-lg sm:text-xl" />
        <span className="text-xs sm:text-sm text-slate-300 font-semibold shrink-0">VS</span>
        <TeamNameDisplay hex={awayTeam} flagAfter className="font-bold text-lg sm:text-xl" />
      </div>

      {decodedName && (
        <p className="text-[10px] sm:text-xs text-slate-400 mb-2.5 text-center">{decodedName}</p>
      )}

      {status === MatchStatus.Settled && (
        <div className="text-center text-2xl font-bold mb-2 tabular-nums">
          {String(match.homeScore)}∶{String(match.awayScore)}
        </div>
      )}

      <div className="text-center mb-2">
        <span className="text-lg font-semibold text-slate-800 tabular-nums">{formatUSDT(totalPool)} USDT</span>
        {participantCount != null && participantCount > 0 && (
          <span className="text-xs text-slate-400 ml-1.5">· {participantCount} {t("card.participants")}</span>
        )}
      </div>

      {totalPool > 0n && (
        <>
          <div className="flex h-3 sm:h-4 rounded-full overflow-hidden gap-0.5 mb-1.5">
            <div className="relative bg-blue-500 flex items-center justify-center" style={{ width: `${homePct}%` }}>
              {homePct >= 8 && <span className="text-[8px] sm:text-[10px] text-white font-bold pointer-events-none">{homePct}%</span>}
            </div>
            {match.allowDraw !== false && (
              <div className="relative bg-gray-400 flex items-center justify-center" style={{ width: `${drawPct}%` }}>
                {drawPct >= 8 && <span className="text-[8px] sm:text-[10px] text-white font-bold pointer-events-none">{drawPct}%</span>}
              </div>
            )}
            <div className="relative bg-red-400 flex items-center justify-center" style={{ width: `${awayPct}%` }}>
              {awayPct >= 8 && <span className="text-[8px] sm:text-[10px] text-white font-bold pointer-events-none">{awayPct}%</span>}
            </div>
          </div>
          <div className={`grid ${match.allowDraw !== false ? "grid-cols-3" : "grid-cols-2"} gap-1 text-xs`}>
            <span className="text-center text-blue-600 font-medium">{t(RESULT_KEYS[Result.HomeWin])} {homeOdds ?? "-"}</span>
            {match.allowDraw !== false && <span className="text-center text-slate-500 font-medium">{t(RESULT_KEYS[Result.Draw])} {drawOdds ?? "-"}</span>}
            <span className="text-center text-red-500 font-medium">{t(RESULT_KEYS[Result.AwayWin])} {awayOdds ?? "-"}</span>
          </div>
        </>
      )}

      <div className="mt-3 text-center">
        {status === MatchStatus.Open && !deadlinePassed && countdown && (
          <span className="inline-block text-sm font-medium text-orange-700 bg-orange-50 px-3 py-1 rounded-full">⏳ {countdown}</span>
        )}
        {status === MatchStatus.Open && !deadlinePassed && !countdown && (
          <span className="text-sm text-blue-600 font-medium">🎯 {t("bet.bet")}</span>
        )}
        {status === MatchStatus.Open && deadlinePassed && (
          <span className="text-sm text-orange-500 font-medium">{t("match.status.deadlinePassed")}</span>
        )}
        {status === MatchStatus.Closed && (
          <span className="text-sm text-yellow-600 font-medium">{t("common.waitingForResult")}</span>
        )}
        {status === MatchStatus.Settled && (
          <span className="text-sm text-slate-500 font-medium">{t("common.viewDetails")} →</span>
        )}
      </div>
    </Link>
  );
}
