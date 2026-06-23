// ============================================================================
// 常量定义 — 与合约枚举同步
// ============================================================================

/** 比赛结果枚举（对应合约 Result enum） */
export enum Result {
  Pending = 0,
  HomeWin = 1,
  Draw = 2,
  AwayWin = 3,
}

/** 比赛状态枚举（对应合约 MatchStatus enum） */
export enum MatchStatus {
  Created = 0,
  Open = 1,
  Closed = 2,
  Settled = 3,
}

/** 比赛结果 → i18n key 映射 */
export const RESULT_KEYS: Record<Result, string> = {
  [Result.Pending]: "result.pending",
  [Result.HomeWin]: "result.homeWin",
  [Result.Draw]: "result.draw",
  [Result.AwayWin]: "result.awayWin",
};

/** @deprecated 使用 RESULT_KEYS + t() 代替 */
export const RESULT_LABELS: Record<Result, string> = {
  [Result.Pending]: "待定",
  [Result.HomeWin]: "主队胜",
  [Result.Draw]: "平局",
  [Result.AwayWin]: "客队胜",
};

/** 比赛状态 → i18n key 映射 */
export const STATUS_KEYS: Record<MatchStatus, string> = {
  [MatchStatus.Created]: "match.status.created",
  [MatchStatus.Open]: "match.status.open",
  [MatchStatus.Closed]: "match.status.closed",
  [MatchStatus.Settled]: "match.status.settled",
};

/** USDT 小数位数（Faucet USDT 为 18 位） */
export const USDT_DECIMALS = 18;

/** 平台手续费率（从合约查询，此处仅作后备） */
export const DEFAULT_FEE_RATE = 200; // 2%

/** 手续费率分母（基点） */
export const FEE_DENOMINATOR = 10000;
