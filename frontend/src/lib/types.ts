// ============================================================================
// Contract return types — matching FootballBetting.sol structs
// ============================================================================

/** Matches getMatch / getAllMatches return (ABI has named components) */
export interface MatchStruct {
  matchName: string;
  homeTeam: string;
  awayTeam: string;
  poolHome: bigint;
  poolDraw: bigint;
  poolAway: bigint;
  totalPool: bigint;
  minBet: bigint;
  maxBet: bigint;
  startTime: bigint;
  deadline: bigint;
  result: number;
  status: number;
  homeScore: number;
  awayScore: number;
  settled: boolean;
  allowDraw: boolean;
}

/** getUserBet returns tuple [amount, betOn, timestamp, reward, claimed] */
export type UserBetTuple = [bigint, number, bigint, bigint, boolean];

/** Used in components — UserBetTuple mapped to named fields + hasBet */
export interface UserBetData {
  amount: bigint;
  betOn: number;
  timestamp: bigint;
  reward: bigint;
  claimed: boolean;
  hasBet: boolean;
}

/** getUserAllBets returns tuple [matchIds, amounts, betOns, rewards, claimed] */
export type UserAllBetsTuple = [bigint[], bigint[], number[], bigint[], boolean[]];
