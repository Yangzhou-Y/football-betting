/**
 * ============================================================================
 * 首页 — 统计概览 + 热门赛事 + 即将开赛
 * ============================================================================
 *
 * 【页面结构】
 *   ① 三栏统计卡片：赛事总数 / 累计奖池 / 投注中数量
 *   ② 热门赛事区：奖池 > 0 的 Open 赛事，按总奖池降序取前 3 名
 *   ③ 即将开赛区：Created/Open 状态，按开赛时间排序取前 6 场
 *   ④ 空状态提示：无赛事时引导管理员创建
 *
 * 【数据依赖】
 *   useAllMatches() → 全量比赛列表
 *   useUserAllBets() → 当前用户的全部投注（用于在卡片上标记"已投注"）
 *   useDeploymentConfig() → 检测是否在支持网络上
 *
 * 【性能注意】
 *   getAllMatches 返回所有比赛，首页用 filter 筛选"热门"和"即将开赛"，
 *   不额外调用合约。比赛数量在数十场内时，客户端计算开销可忽略。
 */
"use client";

import { useAllMatches } from "@/hooks/useMatches";
import { useUserAllBets } from "@/hooks/useUserBets";
import { useDeploymentConfig } from "@/lib/config";
import { MatchCard } from "@/components/match/MatchCard";
import { MatchStatus } from "@/lib/constants";
import { formatUSDT } from "@/lib/utils";
import type { MatchStruct, UserAllBetsTuple } from "@/lib/types";
import { useAccount } from "wagmi";
import { useT } from "@/lib/i18n";

export default function HomePage() {
  const t = useT();
  const { address, isConnected } = useAccount();
  const { data: matches, isLoading, isError, error } = useAllMatches();
  const { data: betsRaw } = useUserAllBets();
  const { isReady } = useDeploymentConfig();

  if (!isReady) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500 text-lg">{isConnected ? t("config.unsupportedNetwork") : t("config.connectPrompt")}</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-20">
        <p className="text-red-500 text-lg">{t("common.loading")}</p>
        <p className="text-sm text-slate-400 mt-1">{(error as Error)?.message || ""}</p>
      </div>
    );
  }

  if (isLoading) {
    return <div className="text-center py-20 text-slate-400">{t("common.loading")}</div>;
  }

  const matchList: MatchStruct[] = (matches as MatchStruct[]) ?? [];

  const validMatches = matchList
    .map((m, i) => ({ match: m, id: i + 1 }))
    .filter(({ match }) => match.startTime > 0n);

  const betIds = new Set<bigint>();
  const betOnMap = new Map<bigint, number>();
  const claimedMap = new Map<bigint, boolean>();
  if (isConnected && betsRaw) {
    const bets = betsRaw as UserAllBetsTuple;
    for (let i = 0; i < bets[0].length; i++) {
      betIds.add(bets[0][i]);
      betOnMap.set(bets[0][i], bets[2][i]);
      claimedMap.set(bets[0][i], bets[4][i]);
    }
  }

  const getBetInfo = (mid: number) => {
    const midBig = BigInt(mid);
    const hb = betIds.has(midBig);
    const m = matchList[mid - 1];
    return {
      hasBet: hb,
      won: hb && m ? m.result === betOnMap.get(midBig) : undefined,
      claimed: hb ? claimedMap.get(midBig) : undefined,
    };
  };

  const totalPool = validMatches.reduce((sum, { match }) => sum + match.totalPool, 0n);
  const openMatches = validMatches.filter(({ match }) => match.status === MatchStatus.Open);
  const upcomingMatches = validMatches
    .filter(({ match }) => match.status === MatchStatus.Created || match.status === MatchStatus.Open)
    .sort((a, b) => Number(a.match.startTime - b.match.startTime));

  return (
    <div className="space-y-8 relative" key={address}>
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <StatCard label={t("stats.totalMatches")} value={String(validMatches.length)} />
        <StatCard label={t("stats.totalPool")} value={`${formatUSDT(totalPool)} USDT`} color="text-blue-600" />
        <StatCard label={t("stats.openMatches")} value={`${openMatches.length}`} color="text-green-600" />
      </div>

      {(() => {
        const hotMatches = openMatches.filter(({ match }) => match.totalPool > 0n);
        if (hotMatches.length === 0) return null;
        return (
          <section>
            <h2 className="text-lg font-semibold mb-3">{t("section.hot")}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...hotMatches]
                .sort((a, b) => Number(b.match.totalPool - a.match.totalPool))
                .slice(0, 3)
                .map(({ match, id }) => (
                  <MatchCard key={id} match={match} matchId={id} {...getBetInfo(id)} />
                ))}
            </div>
          </section>
        );
      })()}

      {upcomingMatches.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">{t("section.upcoming")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcomingMatches.slice(0, 6).map(({ match, id }) => (
              <MatchCard key={id} match={match} matchId={id} {...getBetInfo(id)} />
            ))}
          </div>
        </section>
      )}

      {validMatches.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <p className="text-lg">{t("section.noMatches")}</p>
          <p className="text-sm mt-1">{t("section.noMatchesHint")}</p>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color = "text-slate-800" }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-white rounded-xl p-3 sm:p-5 shadow-sm border border-slate-200">
      <p className="text-xs sm:text-sm text-slate-500">{label}</p>
      <p className={`text-base sm:text-2xl font-bold mt-0.5 sm:mt-1 tabular-nums ${color}`}>{value}</p>
    </div>
  );
}
