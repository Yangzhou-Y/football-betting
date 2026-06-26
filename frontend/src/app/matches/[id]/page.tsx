"use client";

import { useRef, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useMatch } from "@/hooks/useMatches";
import { useUserBet, usePreviewReward } from "@/hooks/useUserBets";
import { usePlaceBet } from "@/hooks/usePlaceBet";
import { useCancelBet } from "@/hooks/useCancelBet";
import { useClaimReward } from "@/hooks/useClaimReward";
import { useAccount, useReadContract } from "wagmi";
import { useDeploymentConfig } from "@/lib/config";
import FootballBettingABI from "@/lib/abi/FootballBetting.json";
import { TeamNameDisplay } from "@/components/shared/TeamNameDisplay";
import { MatchStatusBadge } from "@/components/shared/MatchStatusBadge";
import { AmountDisplay } from "@/components/shared/AmountDisplay";
import { MatchStatus, RESULT_KEYS, Result } from "@/lib/constants";
import type { MatchStruct, UserBetData } from "@/lib/types";
import { formatUSDT, formatTime, decodeTeamName } from "@/lib/utils";
import { translateName } from "@/lib/nameMap";
import { parseContractError } from "@/lib/errors";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useTxToast } from "@/components/shared/TxToast";
import { useT, useLang } from "@/lib/i18n";

export default function MatchDetailPage() {
  const t = useT();
  const { lang } = useLang();
  const { id } = useParams<{ id: string }>();
  const matchId = Number(id);
  const { address, isConnected } = useAccount();
  const { contractAddress, chainId } = useDeploymentConfig();
  const { data: paused } = useReadContract({
    address: contractAddress!,
    abi: FootballBettingABI.abi,
    functionName: "paused",
    chainId,
    query: { enabled: !!contractAddress },
  });
  const { data: matchRaw } = useMatch(matchId);
  const match = matchRaw as MatchStruct | undefined;

  if (!match || !match.homeTeam) {
    return <div className="text-center py-20 text-slate-400">{t("match.notFound")}</div>;
  }

  const now = BigInt(Math.floor(Date.now() / 1000));
  const deadlinePassed = match.status === MatchStatus.Open && match.deadline > 0n && now >= match.deadline;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-2">
          <MatchStatusBadge status={match.status} deadline={match.deadline} />
          <span className="text-sm text-slate-400">{formatTime(match.startTime, lang)}</span>
        </div>
        {match.matchName && match.matchName !== "0x0000000000000000000000000000000000000000000000000000000000000000" && (
          <p className="text-center text-sm text-slate-500 mb-2">{translateName(decodeTeamName(match.matchName), lang)}</p>
        )}
        <div className="flex items-center gap-3">
          <span className="flex-1 min-w-0 text-right"><TeamNameDisplay hex={match.homeTeam} className="font-semibold" /></span>
          <span className="text-slate-400 text-base sm:text-lg font-medium shrink-0">VS</span>
          <span className="flex-1 min-w-0 text-left"><TeamNameDisplay hex={match.awayTeam} flagAfter className="font-semibold" /></span>
        </div>
        {match.status === MatchStatus.Settled && (
          <div className="text-center mt-3">
            <span className="text-3xl font-bold">{String(match.homeScore)} : {String(match.awayScore)}</span>
            <p className="text-sm text-slate-500 mt-1">
              {t("common.result")}: {t(RESULT_KEYS[match.result as Result])}
            </p>
          </div>
        )}
      </div>

      {match.totalPool > 0n && (
        <PoolBars
          home={match.poolHome}
          draw={match.poolDraw}
          away={match.poolAway}
          total={match.totalPool}
          allowDraw={match.allowDraw !== false}
        />
      )}

      {match.status === MatchStatus.Open && !deadlinePassed && isConnected && (
        <BettingPanel key={`bet-${address}`} matchId={matchId} minBet={match.minBet} maxBet={match.maxBet} paused={paused as boolean} homeTeam={match.homeTeam} awayTeam={match.awayTeam} allowDraw={match.allowDraw !== false} />
      )}
      {match.status === MatchStatus.Open && !deadlinePassed && !isConnected && (
        <div className="bg-white rounded-xl p-6 text-center shadow-sm border border-slate-200">
          <p className="text-slate-500">{t("section.connectToBet")}</p>
        </div>
      )}
      {deadlinePassed && (
        <div className="bg-orange-50 rounded-xl p-6 text-center border border-orange-200">
          <p className="text-orange-600 font-semibold">{t("match.status.deadlinePassed")}</p>
          <p className="text-sm text-orange-500 mt-1">{t("errors.deadlinePassed")}</p>
        </div>
      )}

      {match.status === MatchStatus.Settled && isConnected && (
        <ClaimPanel key={`claim-${address}`} matchId={matchId} paused={paused as boolean} />
      )}

      {isConnected && (
        <MyBetInfo key={`mybet-${address}`} matchId={matchId} result={match.result} settled={match.settled} />
      )}
    </div>
  );
}

function PoolBars({ home, draw, away, total, allowDraw = true }: { home: bigint; draw: bigint; away: bigint; total: bigint; allowDraw?: boolean }) {
  const t = useT();
  const total_ = total > 0n ? total : 1n;
  const hp = Number((home * 100n) / total_);
  const dp = Number((draw * 100n) / total_);
  const ap = Number((away * 100n) / total_);

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
      <h3 className="text-sm font-semibold mb-3">{t("pool.title")} · <AmountDisplay amount={total} /></h3>
      <div className="space-y-2">
        <PoolRow label={t("pool.homeWin")} pct={hp} amount={home} color="bg-blue-500" />
        {allowDraw && <PoolRow label={t("pool.draw")} pct={dp} amount={draw} color="bg-gray-400" />}
        <PoolRow label={t("pool.awayWin")} pct={ap} amount={away} color="bg-red-400" />
      </div>
    </div>
  );
}

function PoolRow({ label, pct, amount, color }: { label: string; pct: number; amount: bigint; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm w-16 text-right">{label}</span>
      <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm w-20 text-right text-slate-500">
        <AmountDisplay amount={amount} /> ({pct}%)
      </span>
    </div>
  );
}

function BettingPanel({ matchId, minBet, maxBet, paused, homeTeam, awayTeam, allowDraw }: { matchId: number; minBet: bigint; maxBet: bigint; paused: boolean; homeTeam: string; awayTeam: string; allowDraw: boolean }) {
  const t = useT();

  if (paused) {
    return (
      <div className="bg-red-50 rounded-xl p-6 text-center border-2 border-red-300">
        <p className="text-red-700 font-semibold text-lg mb-1">{t("section.contractPaused")}</p>
        <p className="text-sm text-red-500">{t("section.pausedHint")}</p>
      </div>
    );
  }

  return <BettingPanelInner matchId={matchId} minBet={minBet} maxBet={maxBet} homeTeam={homeTeam} awayTeam={awayTeam} allowDraw={allowDraw} />;
}

function BettingPanelInner({ matchId, minBet, maxBet, homeTeam, awayTeam, allowDraw }: { matchId: number; minBet: bigint; maxBet: bigint; homeTeam: string; awayTeam: string; allowDraw: boolean }) {
  const t = useT();
  const { lang } = useLang();
  const {
    betAmount, setBetAmount, selectedResult, setSelectedResult,
    isAllowanceLoading, isBalanceLoading, insufficientBalance, needsApproval,
    handleApprove, handlePlaceBet,
    isApproving, isApproveConfirming, isApproved,
    isBetting, isBetConfirming, isBetSuccess,
    approveError, betError,
  } = usePlaceBet(matchId);

  const toast = useTxToast();
  const prevBetting = useRef(false);
  const prevBetSuccess = useRef(false);
  const pendingId = useRef(0);
  useEffect(() => {
    if (isBetting && !prevBetting.current) {
      pendingId.current = toast.show(t("toast.txSubmitted"), "pending");
    }
    if (isBetSuccess && !prevBetSuccess.current) toast.show(t("toast.betSuccess"), "success");
    if (betError) {
      const msg = (betError as Error)?.message || "";
      const parsed = parseContractError(betError as Error | null);
      const friendly = parsed ? t(parsed) : (msg.includes("rejected") ? t("toast.txCancelled") : (msg.slice(0, 60) || t("toast.betFailed")));
      toast.show(friendly, "error");
    }
    if (!isBetting && !isBetSuccess && !betError && prevBetting.current) {
      toast.dismiss(pendingId.current);
    }
    prevBetting.current = isBetting;
    prevBetSuccess.current = isBetSuccess;
  }, [isBetting, isBetSuccess, betError]);

  const prevApproving = useRef(false);
  const prevApproved = useRef(false);
  const approvePendingId = useRef(0);
  useEffect(() => {
    if (isApproving && !prevApproving.current) {
      approvePendingId.current = toast.show(t("toast.approveSubmitted"), "pending");
    }
    if (isApproved && !prevApproved.current) toast.show(t("toast.approveSuccess"), "success");
    if (approveError) {
      const msg = (approveError as Error)?.message || "";
      const parsed = parseContractError(approveError as Error | null);
      toast.show(parsed ? t(parsed) : (msg.includes("rejected") ? t("toast.txCancelled") : t("toast.approveFailed")), "error");
    }
    if (!isApproving && !isApproved && !approveError && prevApproving.current) {
      toast.dismiss(approvePendingId.current);
    }
    prevApproving.current = isApproving;
    prevApproved.current = isApproved;
  }, [isApproving, isApproved, approveError]);

  const { data: existing } = useUserBet(matchId);
  const hasBet = existing?.hasBet ?? false;

  const [confirmType, setConfirmType] = useState<"bet" | "cancel" | null>(null);

  const {
    handleCancel, isCancelling, isConfirming: isCancelConfirming,
    isCancelled, cancelError,
  } = useCancelBet(matchId);

  const prevCancelling = useRef(false);
  const prevCancelled = useRef(false);
  const cancelPendingId = useRef(0);
  useEffect(() => {
    if (isCancelling && !prevCancelling.current) {
      cancelPendingId.current = toast.show(t("toast.cancelSubmitted"), "pending");
    }
    if (isCancelled && !prevCancelled.current) toast.show(t("toast.cancelSuccess"), "success");
    if (cancelError) {
      const msg = (cancelError as Error)?.message || "";
      const parsed = parseContractError(cancelError as Error | null);
      toast.show(parsed ? t(parsed) : (msg.includes("rejected") ? t("toast.txCancelled") : t("toast.cancelFailed")), "error");
    }
    if (!isCancelling && !isCancelled && !cancelError && prevCancelling.current) {
      toast.dismiss(cancelPendingId.current);
    }
    prevCancelling.current = isCancelling;
    prevCancelled.current = isCancelled;
  }, [isCancelling, isCancelled, cancelError]);

  if (isBetSuccess) {
    return (
      <div className="bg-green-50 rounded-xl p-6 text-center border border-green-200">
        <p className="text-green-700 font-semibold text-lg">{t("bet.success")}</p>
        <p className="text-sm text-green-600 mt-1">{t("bet.successDesc")}</p>
      </div>
    );
  }

  if (isCancelled) {
    return (
      <div className="bg-blue-50 rounded-xl p-6 text-center border border-blue-200">
        <p className="text-blue-700 font-semibold text-lg">{t("bet.cancelled")}</p>
        <p className="text-sm text-blue-600 mt-1">{t("bet.cancelledDesc")}</p>
      </div>
    );
  }

  const loading = isApproving || isApproveConfirming || isBetting || isBetConfirming
    || isCancelling || isCancelConfirming;

  const rawApprove = parseContractError(approveError as Error | null);
  const rawBet = parseContractError(betError as Error | null);
  const rawCancel = parseContractError(cancelError as Error | null);
  const friendlyApprove = rawApprove ? t(rawApprove) : null;
  const friendlyBet = rawBet ? t(rawBet) : null;
  const friendlyCancel = rawCancel ? t(rawCancel) : null;

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
      <h3 className="text-sm font-semibold mb-3">{t("bet.bet")}</h3>

      {hasBet && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-blue-700">
            {t("bet.existingBet")} <span className="font-bold">{t(RESULT_KEYS[existing!.betOn as Result])}</span>
            ，<AmountDisplay amount={existing!.amount as bigint} />
          </p>
          <p className="text-xs text-blue-500 mt-1 leading-relaxed">
            {t("bet.existingBetHint")}
          </p>
        </div>
      )}

      <div className={`grid ${allowDraw ? "grid-cols-3" : "grid-cols-2"} gap-2 mb-4`}>
        <BetButton opt={1} label={t("bet.homeWin")} subtitle={translateName(decodeTeamName(homeTeam), lang)} selectedResult={selectedResult} setSelectedResult={setSelectedResult} existingBetOn={existing?.betOn} loading={loading} />
        {allowDraw && (
          <BetButton opt={2} label={t("result.draw")} selectedResult={selectedResult} setSelectedResult={setSelectedResult} existingBetOn={existing?.betOn} loading={loading} />
        )}
        <BetButton opt={3} label={t("bet.awayWin")} subtitle={translateName(decodeTeamName(awayTeam), lang)} selectedResult={selectedResult} setSelectedResult={setSelectedResult} existingBetOn={existing?.betOn} loading={loading} />
      </div>

      <div className="mb-4">
        <label className="text-xs text-slate-500">{t("bet.amount")} (USDT)</label>
        <div className="flex items-center gap-2 mt-1">
          <input
            type="number"
            step="0.01"
            min={formatUSDT(minBet)}
            max={maxBet > 0n ? formatUSDT(maxBet) : undefined}
            value={betAmount}
            onChange={(e) => setBetAmount(e.target.value)}
            disabled={loading}
            placeholder={`${t("bet.minAmount")} ${formatUSDT(minBet)} USDT`}
            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-sm text-slate-500">USDT</span>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          {t("bet.minAmount")} <AmountDisplay amount={minBet} />
          {maxBet > 0n && <span> · {t("bet.maxAmount")} <AmountDisplay amount={maxBet} /></span>}
        </p>
      </div>

      <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
        <p className="text-xs text-amber-700 leading-relaxed">{t("bet.noWinnerHint")}</p>
      </div>

      {friendlyApprove && <ErrorBox message={friendlyApprove} />}
      {friendlyBet && <ErrorBox message={friendlyBet} />}
      {friendlyCancel && <ErrorBox message={friendlyCancel} />}
      {insufficientBalance && <ErrorBox message={t("bet.insufficientBalance")} />}

      <div className="space-y-2">
        {isAllowanceLoading || isBalanceLoading ? (
          <button disabled className="w-full py-2.5 bg-slate-300 text-slate-500 rounded-lg font-medium">
            {t("bet.checkingBalance")}
          </button>
        ) : insufficientBalance ? (
          <button disabled className="w-full py-2.5 bg-slate-300 text-slate-500 rounded-lg font-medium">
            {t("bet.insufficientBalance")}
          </button>
        ) : needsApproval ? (
          <button
            onClick={handleApprove}
            disabled={!betAmount || loading}
            className="w-full py-2.5 bg-amber-500 text-white rounded-lg font-medium disabled:opacity-50 hover:bg-amber-600 transition"
          >
            {isApproving ? t("bet.requestingApproval") : isApproveConfirming ? t("bet.approving") : t("bet.stepApprove")}
          </button>
        ) : !betAmount ? (
          <button disabled className="w-full py-2.5 bg-slate-200 text-slate-400 rounded-lg font-medium cursor-not-allowed">
            {hasBet ? t("bet.enterAmountAdd") : t("bet.enterAmount")}
          </button>
        ) : (
          <button
            onClick={() => setConfirmType("bet")}
            disabled={loading}
            className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50 hover:bg-blue-700 transition"
          >
            {hasBet ? (selectedResult === existing?.betOn ? t("bet.add") : t("bet.switch")) : t("bet.confirm")}
          </button>
        )}

        {hasBet && (
          <button
            onClick={() => setConfirmType("cancel")}
            disabled={loading}
            className="w-full py-2 border border-red-300 text-red-600 rounded-lg font-medium hover:bg-red-50 disabled:opacity-50 transition text-sm"
          >
            {isCancelling ? t("bet.cancelling") : isCancelConfirming ? t("bet.confirming") : t("bet.cancel")}
          </button>
        )}
      </div>

      <ConfirmDialog
        open={confirmType === "bet"}
        title={hasBet ? (selectedResult === existing?.betOn ? t("confirm.addTitle") : t("confirm.switchTitle")) : t("confirm.betTitle")}
        confirmLabel={t("confirm.confirm")}
        confirmVariant="blue"
        loading={isBetting || isBetConfirming}
        onConfirm={() => { handlePlaceBet(); setConfirmType(null); }}
        onCancel={() => setConfirmType(null)}
      >
        <p>{t("confirm.betDetail")}<span className="font-medium">{t(RESULT_KEYS[selectedResult as Result])}</span></p>
        <p>{t("confirm.amountDetail")}<span className="font-medium">{betAmount} USDT</span></p>
        {hasBet && selectedResult !== existing?.betOn && (
          <p className="mt-1 text-xs text-amber-600">{t("confirm.switchHint")}</p>
        )}
        {hasBet && selectedResult === existing?.betOn && (
          <p className="mt-1 text-xs text-slate-400">{t("confirm.addHint")}</p>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmType === "cancel"}
        title={t("confirm.cancelTitle")}
        confirmLabel={t("confirm.confirmCancel")}
        confirmVariant="red"
        loading={isCancelling || isCancelConfirming}
        onConfirm={() => { handleCancel(); setConfirmType(null); }}
        onCancel={() => setConfirmType(null)}
      >
        <p>{t("confirm.cancelMsg")}</p>
        <p className="mt-1">{t("confirm.cancelRefund")} <span className="font-medium">{formatUSDT(existing?.amount ?? 0n)} USDT</span></p>
      </ConfirmDialog>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
      <p className="text-xs text-red-600">{message}</p>
    </div>
  );
}

function BetButton({ opt, label, subtitle, selectedResult, setSelectedResult, existingBetOn, loading }: {
  opt: number; label: string; subtitle?: string;
  selectedResult: number; setSelectedResult: (v: 1 | 2 | 3) => void;
  existingBetOn?: number; loading: boolean;
}) {
  const active = selectedResult === opt;
  const isExisting = existingBetOn === opt;
  return (
    <button
      onClick={() => setSelectedResult(opt as 1 | 2 | 3)}
      disabled={loading}
      className={`py-2 rounded-lg text-sm transition flex flex-col items-center ${
        active
          ? "bg-blue-600 text-white"
          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
      } ${isExisting ? "ring-2 ring-blue-300" : ""}`}
    >
      <span className="font-medium">{label}</span>
      {subtitle && <span className={`text-[10px] ${active ? "text-blue-100" : "text-slate-400"}`}>{subtitle}</span>}
    </button>
  );
}

function ClaimPanel({ matchId, paused }: { matchId: number; paused: boolean }) {
  const t = useT();
  const { data: preview } = usePreviewReward(matchId);
  const { data: betData } = useUserBet(matchId);
  const { handleClaim, isClaiming, isConfirming, isClaimed, claimError } = useClaimReward(matchId);
  const [claimConfirm, setClaimConfirm] = useState(false);

  const cToast = useTxToast();
  const prevClaiming = useRef(false);
  const prevClaimed = useRef(false);
  const claimPendingId = useRef(0);
  useEffect(() => {
    if (isClaiming && !prevClaiming.current) {
      claimPendingId.current = cToast.show(t("toast.claimSubmitted"), "pending");
    }
    if (isClaimed && !prevClaimed.current) cToast.show(t("toast.claimSuccess"), "success");
    if (claimError) {
      const msg = (claimError as Error)?.message || "";
      const parsed = parseContractError(claimError as Error | null);
      cToast.show(parsed ? t(parsed) : (msg.includes("rejected") ? t("toast.txCancelled") : t("toast.claimFailed")), "error");
    }
    if (!isClaiming && !isClaimed && !claimError && prevClaiming.current) {
      cToast.dismiss(claimPendingId.current);
    }
    prevClaiming.current = isClaiming;
    prevClaimed.current = isClaimed;
  }, [isClaiming, isClaimed, claimError]);

  const reward = (preview as bigint) ?? 0n;
  const rawClaim = parseContractError(claimError as Error | null);
  const friendlyClaim = rawClaim ? t(rawClaim) : null;

  if (paused) {
    return (
      <div className="bg-red-50 rounded-xl p-5 border-2 border-red-300 text-center">
        <p className="text-red-700 font-semibold">{t("section.contractPaused")}</p>
        <p className="text-sm text-red-500 mt-0.5">{t("claim.pausedHint")}</p>
      </div>
    );
  }

  if (!betData || betData.amount === 0n) return null;
  if (betData.claimed || isClaimed) {
    return (
      <div className="bg-white rounded-xl p-5 text-center shadow-sm border border-slate-200">
        <p className="text-slate-500">
          {reward > 0n ? `${t("claim.alreadyClaimed")} ${formatUSDT(reward)} USDT` : t("claim.alreadySettled")}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-green-50 rounded-xl p-5 border border-green-200">
      {reward > 0n ? (
        <>
          <p className="text-green-800 font-semibold mb-1">{t("claim.congrats")}</p>
          <p className="text-sm text-green-700 mb-3">
            {t("claim.claimable")}: <span className="font-bold">{formatUSDT(reward)} USDT</span>
          </p>
          {friendlyClaim && <ErrorBox message={friendlyClaim} />}
          <button
            onClick={() => setClaimConfirm(true)}
            disabled={isClaiming || isConfirming}
            className="w-full py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition"
          >
            {isClaiming ? t("claim.claiming") : isConfirming ? t("bet.confirming") : t("claim.reward")}
          </button>
        </>
      ) : (
        <p className="text-slate-500 text-center">{t("claim.noWin")}</p>
      )}

      <ConfirmDialog
        open={claimConfirm}
        title={t("confirm.claimTitle")}
        confirmLabel={t("claim.confirm")}
        confirmVariant="green"
        loading={isClaiming || isConfirming}
        onConfirm={() => { handleClaim(); setClaimConfirm(false); }}
        onCancel={() => setClaimConfirm(false)}
      >
        <p>{t("confirm.claimDetail")}</p>
        <p className="mt-1">{t("confirm.claimAmount")} <span className="font-bold text-green-600">{formatUSDT(reward)} USDT</span></p>
      </ConfirmDialog>
    </div>
  );
}

function MyBetInfo({ matchId, result, settled }: { matchId: number; result: number; settled: boolean }) {
  const t = useT();
  const { data: bet } = useUserBet(matchId);

  if (!bet || bet.amount === 0n) return null;

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
      <h3 className="text-sm font-semibold mb-2">{t("detail.myBet")}</h3>
      <div className="text-sm space-y-1">
        <p>{t("detail.option")} <span className="font-medium">{t(RESULT_KEYS[bet.betOn as Result])}</span></p>
        <p>{t("myBets.table.amount")}: <AmountDisplay amount={bet.amount as bigint} /></p>
        {settled && (
          <p>
            {t("common.result")}: {bet.betOn === result ? `✅ ${t("common.correct")}` : `❌ ${t("common.incorrect")}`}
            {bet.reward > 0n && <span> · {t("leaderboard.reward")} <AmountDisplay amount={bet.reward as bigint} /></span>}
          </p>
        )}
      </div>
    </div>
  );
}
