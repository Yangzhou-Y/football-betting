"use client";

import { useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { useAllMatches } from "@/hooks/useMatches";
import { useUserAllBets } from "@/hooks/useUserBets";
import { useMounted } from "@/hooks/useMounted";
import { MatchCard } from "@/components/match/MatchCard";
import { MatchStatus } from "@/lib/constants";
import { useDeploymentConfig } from "@/lib/config";
import { useT } from "@/lib/i18n";
import FootballBettingABI from "@/lib/abi/FootballBetting.json";

export default function MatchesPage() {
  const t = useT();
  const mounted = useMounted();
  const { address, isConnected } = useAccount();
  const FILTERS = [
    { key: "all", label: t("filter.all"), match: () => true },
    { key: "my", label: t("filter.my"), match: () => true },
    { key: "open", label: t("filter.open"), match: (m: any) => m.status === MatchStatus.Open },
    { key: "closed", label: t("filter.closed"), match: (m: any) => m.status === MatchStatus.Closed },
    { key: "settled", label: t("filter.settled"), match: (m: any) => m.status === MatchStatus.Settled },
  ];
  const { contractAddress, isReady, chainId } = useDeploymentConfig();
  const { data: paused } = useReadContract({
    address: contractAddress!,
    abi: FootballBettingABI.abi,
    functionName: "paused",
    chainId,
    query: { enabled: !!contractAddress },
  });
  const { data: matches, isLoading, isError, error } = useAllMatches();
  const { data: betsRaw } = useUserAllBets();
  const [filter, setFilter] = useState("all");

  if (!mounted) {
    return <div className="text-center py-20 text-slate-400">{t("common.loading")}</div>;
  }

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
        <p className="text-sm text-slate-400 mt-1">{(error as any)?.shortMessage || (error as Error)?.message || ""}</p>
      </div>
    );
  }

  if (isLoading) {
    return <div className="text-center py-20 text-slate-400">{t("common.loading")}</div>;
  }

  const matchList = (matches as any[]) ?? [];

  // 过滤已删除的比赛（startTime === 0n），保留正确 matchId
  const validMatches = matchList
    .map((m: any, i: number) => ({ match: m, id: i + 1 }))
    .filter(({ match }: any) => (match.startTime ?? 0n) > 0n);

  const betIds = new Set<bigint>();
  const betOnMap = new Map<bigint, number>();
  const claimedMap = new Map<bigint, boolean>();
  if (isConnected && betsRaw) {
    const bets = betsRaw as [bigint[], bigint[], number[], bigint[], boolean[]];
    for (let i = 0; i < bets[0].length; i++) {
      betIds.add(bets[0][i]);
      betOnMap.set(bets[0][i], bets[2][i]);
      claimedMap.set(bets[0][i], bets[4][i]);
    }
  }

  const filtered = validMatches.filter(({ match: m, id }: any) => {
    if (filter === "my") return betIds.has(BigInt(id));
    return FILTERS.find((f) => f.key === filter)?.match(m) ?? true;
  });

  filtered.sort((a: any, b: any) => {
    const aBet = betIds.has(BigInt(a.id)) ? 0 : 1;
    const bBet = betIds.has(BigInt(b.id)) ? 0 : 1;
    if (aBet !== bBet) return aBet - bBet;
    return Number(a.match.startTime - b.match.startTime);
  });

  return (
    <div className="space-y-6" key={address}>
      <h1 className="text-xl font-bold">{t("matches.title")}</h1>

      {(paused as boolean) && (
        <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 text-center">
          <p className="text-red-700 font-semibold">{t("section.contractPaused")}</p>
          <p className="text-sm text-red-500 mt-0.5">{t("section.pausedHint")}</p>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-1.5 rounded-full text-sm transition ${
              filter === f.key
                ? "bg-blue-600 text-white"
                : "bg-white text-slate-600 border border-slate-200 hover:border-blue-300"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p>{t("section.noMatches")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(({ match: m, id }: any) => {
            const mid = BigInt(id);
            const hasBet = betIds.has(mid);
            const won = hasBet ? m.result === betOnMap.get(mid) : undefined;
            const claimed = hasBet ? claimedMap.get(mid) : undefined;
            return (
              <MatchCard key={id} match={m} matchId={id} hasBet={hasBet} won={won} claimed={claimed} />
            );
          })}
        </div>
      )}
    </div>
  );
}
