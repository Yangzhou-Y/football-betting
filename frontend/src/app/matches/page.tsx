/**
 * ============================================================================
 * 赛事列表页 — 筛选 + 分页（客户端分页，每页 12 场）
 * ============================================================================
 *
 * 【筛选功能】
 *   全部 / 已投注（当前用户）/ 投注中（Open）/ 已封盘（Closed）/ 已开奖（Settled）
 *   日期筛选 + 球队名称搜索，切换任一筛选器均自动重置到第 1 页
 *
 * 【分页策略 — 客户端分页】
 *   从 getAllMatches() 获取全部比赛，在前端通过 .slice() 实现分页。
 *   选择此方案而非合约层面的 getMatchesPaginated 的原因：
 *   ① 不改合约字节码（避免重新部署）
 *   ② 比赛数量少（<100 场），全量数据一次 RPC 调用即可获取
 *   ③ 切换页码无需额外 RPC，即时响应
 *
 *   若未来比赛数增长到数百场以上，应在合约中添加 getMatchesPaginated
 *   返回 count + 分页参数，或在链下建立索引服务。
 *
 * 【排序规则】
 *   ① 已投注的排在前面（个人相关度优先）
 *   ② 同组内按开赛时间升序
 *
 * 【紧急暂停横幅】
 *   从合约读取 paused 状态，如合约已暂停则在全页面顶部显示红色警告横幅
 */
"use client";

import { useState, useEffect } from "react";
import { useAccount, useReadContract } from "wagmi";
import { useAllMatches } from "@/hooks/useMatches";
import { useUserAllBets } from "@/hooks/useUserBets";
import { useParticipantCounts } from "@/hooks/useParticipantCounts";
import { useMounted } from "@/hooks/useMounted";
import { MatchCard } from "@/components/match/MatchCard";
import { MatchCardGridSkeleton } from "@/components/shared/Skeleton";
import { MatchStatus } from "@/lib/constants";
import { useDeploymentConfig } from "@/lib/config";
import type { MatchStruct, UserAllBetsTuple } from "@/lib/types";
import { useT, useLang } from "@/lib/i18n";
import { decodeTeamName } from "@/lib/utils";
import { translateName } from "@/lib/nameMap";
import FootballBettingABI from "@/lib/abi/FootballBetting.json";

/** 每页显示的赛事卡片数 */
const PAGE_SIZE = 12;

export default function MatchesPage() {
  const t = useT();
  const { lang } = useLang();
  const mounted = useMounted();
  const { address, isConnected } = useAccount();
  const FILTERS = [
    { key: "all", label: t("filter.all"), match: () => true },
    { key: "my", label: t("filter.my"), match: () => true },
    { key: "open", label: t("filter.open"), match: (m: MatchStruct) => m.status === MatchStatus.Open },
    { key: "closed", label: t("filter.closed"), match: (m: MatchStruct) => m.status === MatchStatus.Closed },
    { key: "settled", label: t("filter.settled"), match: (m: MatchStruct) => m.status === MatchStatus.Settled },
  ];
  const { contractAddress, isReady, chainId } = useDeploymentConfig();
  const { data: paused } = useReadContract({
    address: contractAddress!,
    abi: FootballBettingABI.abi,
    functionName: "paused",
    chainId,
    query: { enabled: !!contractAddress },
  });
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [sortNewest, setSortNewest] = useState(true);
  const [sortMode, setSortMode] = useState<"time" | "pool">("time");
  const [filterDate, setFilterDate] = useState("");
  const [filterTeam, setFilterTeam] = useState("");
  const [jumpInput, setJumpInput] = useState("");

  useEffect(() => { window.scrollTo({ top: 0, behavior: "smooth" }); }, [page]);

  const { data: matches, isLoading, isError, error } = useAllMatches();
  const { data: betsRaw } = useUserAllBets();
  const participantCounts = useParticipantCounts();

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
        <p className="text-sm text-slate-400 mt-1">{(error as Error)?.message || ""}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse bg-slate-200 rounded h-7 w-24" />
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-slate-200 rounded-full h-8 w-16" />
          ))}
        </div>
        <MatchCardGridSkeleton count={6} />
      </div>
    );
  }

  const matchList: MatchStruct[] = (matches as MatchStruct[]) ?? [];

  // Build full list of valid matches with their IDs
  const allValid = matchList
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

  // Apply filter to the full list
  const filtered = allValid.filter(({ match: m, id }) => {
    if (filter === "my") return betIds.has(BigInt(id));
    if (!(FILTERS.find((f) => f.key === filter)?.match(m) ?? true)) return false;
    // Date filter: match startTime falls on the selected date (UTC+8)
    if (filterDate) {
      const matchDate = new Date(Number(m.startTime) * 1000);
      const matchDateStr = matchDate.toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" });
      const filterDateStr = new Date(filterDate + "T00:00:00+08:00").toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" });
      if (matchDateStr !== filterDateStr) return false;
    }
    // Team name filter (case-insensitive, searches homeTeam and awayTeam)
    // homeTeam/awayTeam are stored as bytes32 hex, must decode before comparison
    // Also check translated variants so users can search in both Chinese and English
    if (filterTeam.trim()) {
      const q = filterTeam.trim().toLowerCase();
      const homeRaw = decodeTeamName(m.homeTeam ?? "");
      const awayRaw = decodeTeamName(m.awayTeam ?? "");
      const homes = [homeRaw.toLowerCase(), translateName(homeRaw, "zh").toLowerCase(), translateName(homeRaw, "en").toLowerCase()];
      const aways = [awayRaw.toLowerCase(), translateName(awayRaw, "zh").toLowerCase(), translateName(awayRaw, "en").toLowerCase()];
      if (!homes.some((h) => h.includes(q)) && !aways.some((a) => a.includes(q))) return false;
    }
    return true;
  });

  filtered.sort((a, b) => {
    let cmp: number;
    if (sortMode === "pool") {
      cmp = Number(a.match.totalPool - b.match.totalPool);
      if (cmp === 0) cmp = Number(a.match.startTime - b.match.startTime);
    } else {
      cmp = Number(a.match.startTime - b.match.startTime);
    }
    return sortNewest ? -cmp : cmp;
  });

  // Client-side pagination: slice the filtered list
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const paged = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="space-y-6" key={address}>
      <h1 className="text-xl font-bold">{t("matches.title")}</h1>

      {(paused as boolean) && (
        <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 text-center">
          <p className="text-red-700 font-semibold">{t("section.contractPaused")}</p>
          <p className="text-sm text-red-500 mt-0.5">{t("section.pausedHint")}</p>
        </div>
      )}

      <div className="space-y-3">
        {/* Row 1: status filters + sort */}
        <div className="flex gap-2 flex-wrap items-center">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => { setFilter(f.key); setPage(0); }}
              className={`px-4 py-1.5 rounded-full text-sm transition ${
                filter === f.key
                  ? "bg-blue-600 text-white"
                  : "bg-white text-slate-600 border border-slate-200 hover:border-blue-300"
              }`}
            >
              {f.label}
            </button>
          ))}
          <div className="flex-1" />
          <div className="flex items-center gap-1.5">
            {/* sort mode selector */}
            <div className="flex rounded-full bg-white border border-slate-200 overflow-hidden">
              <button
                onClick={() => { setSortMode("time"); setPage(0); }}
                className={`px-2.5 py-1.5 text-xs transition ${sortMode === "time" ? "bg-blue-600 text-white" : "text-slate-500 hover:text-slate-700"}`}
              >
                {t("sort.byTime")}
              </button>
              <button
                onClick={() => { setSortMode("pool"); setPage(0); }}
                className={`px-2.5 py-1.5 text-xs transition border-l border-slate-200 ${sortMode === "pool" ? "bg-blue-600 text-white" : "text-slate-500 hover:text-slate-700"}`}
              >
                {t("sort.byPool")}
              </button>
            </div>
            {/* direction toggle */}
            <button
              onClick={() => { setSortNewest((v) => !v); setPage(0); }}
              className="px-2.5 py-1.5 rounded-full text-xs bg-white text-slate-600 border border-slate-200 hover:border-blue-300 transition"
              title={sortNewest ? t("sort.desc") : t("sort.asc")}
            >
              {sortNewest ? t("sort.desc") : t("sort.asc")} ⇅
            </button>
          </div>
        </div>

        {/* Row 2: date filter + team search */}
        <div className="flex gap-3 flex-wrap items-center">
          <label className="flex items-center gap-2 text-sm text-slate-500">
            <span>{t("filter.date")}</span>
            <input
              type="date"
              required
              value={filterDate}
              onChange={(e) => { setFilterDate(e.target.value); setPage(0); }}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:border-blue-400 transition"
            />
            {filterDate && (
              <button
                onClick={() => { setFilterDate(""); setPage(0); }}
                className="ml-1 w-7 h-7 flex items-center justify-center rounded-full text-sm text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
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
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm bg-white w-40 focus:outline-none focus:border-blue-400 transition"
            />
            {filterTeam && (
              <button
                onClick={() => { setFilterTeam(""); setPage(0); }}
                className="ml-1 w-7 h-7 flex items-center justify-center rounded-full text-sm text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                ✕
              </button>
            )}
          </label>
        </div>
      </div>

      {paged.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p>{t("section.noMatches")}</p>
        </div>
      ) : (
        <div key={`${safePage}-${String(sortNewest)}-${sortMode}-${filter}-${filterDate}-${filterTeam}`} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-page-enter">
          {paged.map(({ match: m, id }) => {
            const mid = BigInt(id);
            const hasBet = betIds.has(mid);
            const won = hasBet ? m.result === betOnMap.get(mid) : undefined;
            const claimed = hasBet ? claimedMap.get(mid) : undefined;
            return (
              <MatchCard key={id} match={m} matchId={id} hasBet={hasBet} won={won} claimed={claimed} participantCount={participantCounts.get(id)} />
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 py-4">
          <button
            onClick={() => setPage(0)}
            disabled={safePage === 0}
            aria-label={t("page.first")}
            className="px-3 py-2 rounded-lg text-base border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            title={t("page.first")}
          >
            «
          </button>
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={safePage === 0}
            aria-label={t("page.prev")}
            className="px-4 py-2 rounded-lg text-base border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            ←
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
            →
          </button>
          <button
            onClick={() => setPage(totalPages - 1)}
            disabled={safePage >= totalPages - 1}
            aria-label={t("page.last")}
            className="px-3 py-2 rounded-lg text-base border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            title={t("page.last")}
          >
            »
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
    </div>
  );
}
