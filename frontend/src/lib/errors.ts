/**
 * Maps contract revert reasons (custom errors + ERC-20 require strings) to i18n keys.
 */
export function parseContractError(error: Error | null): string | null {
  if (!error) return null;
  const msg = error.message || "";

  // USDT / ERC-20 (from MockERC20 require strings — unchanged)
  if (msg.includes("insufficient balance")) return "errors.insufficientBalance";
  if (msg.includes("insufficient allowance")) return "errors.insufficientAllowance";

  // FootballBetting custom errors — check by name
  if (msg.includes("NotOwner")) return "errors.onlyOwner";
  if (msg.includes("ReentrantCall")) return null; // silent — shouldn't happen
  if (msg.includes("ContractPaused") || msg.includes("contract is paused")) return "errors.contractPaused";
  if (msg.includes("AlreadyPaused") || msg.includes("already paused")) return "errors.alreadyPaused";
  if (msg.includes("NotPaused") || msg.includes("not paused")) return "errors.notPaused";
  if (msg.includes("StartTimeNotFuture") || msg.includes("start time must be in the future")) return "errors.startTimeFuture";
  if (msg.includes("DeadlineNotFuture") || msg.includes("deadline must be in the future")) return "errors.deadlineFuture";
  if (msg.includes("DeadlineAfterStart") || msg.includes("deadline must be")) return "errors.deadlineBeforeStart";
  if (msg.includes("MatchNotExist") || msg.includes("match does not exist")) return "errors.matchNotExist";
  if (msg.includes("MatchNotOpen") || msg.includes("match is not open")) return "errors.matchNotOpen";
  if (msg.includes("MatchNotCreated") || msg.includes("not in Created")) return "errors.matchNotCreated";
  if (msg.includes("MatchAlreadySettled") || msg.includes("already settled")) return "errors.alreadySettled";
  if (msg.includes("MatchNotSettled") || msg.includes("not settled yet")) return "errors.notSettled";
  if (msg.includes("DeadlineNotPassed") || msg.includes("betting deadline passed")
      || msg.includes("deadline not yet passed")) return "errors.deadlinePassed";
  if (msg.includes("InvalidResult") || msg.includes("must choose a valid result")) return "errors.invalidResult";
  if (msg.includes("ZeroAmount") || msg.includes("bet amount must be positive")) return "errors.positiveAmount";
  if (msg.includes("BelowMinBet") || msg.includes("bet below minimum")) return "errors.betBelowMin";
  if (msg.includes("AboveMaxBet") || msg.includes("bet above maximum")) return "errors.betAboveMax";
  if (msg.includes("DrawNotAllowed") || msg.includes("draw betting not allowed")) return "errors.drawNotAllowed";
  if (msg.includes("NoBet") || msg.includes("no bet")) return "errors.noBetFound";
  if (msg.includes("AlreadyClaimed") || msg.includes("reward already claimed")) return "errors.alreadyClaimed";
  if (msg.includes("ScoresEqual") || msg.includes("scores cannot determine")) return "errors.invalidScores";
  if (msg.includes("NoFees") || msg.includes("no fees to withdraw")) return "errors.noFees";
  if (msg.includes("USDTTransferFailed") || msg.includes("USDT transfer failed")
      || msg.includes("USDT refund failed") || msg.includes("USDT delta refund")) return "errors.transferFailed";
  if (msg.includes("USDTTransferFromFailed") || msg.includes("USDT transferFrom failed")
      || msg.includes("USDT delta transfer")) return "errors.transferFromFailed";
  if (msg.includes("MatchHasBets")) return "errors.matchNotCreated"; // cannot delete match with bets
  if (msg.includes("MatchNotClosedOrPast")) return "errors.matchNotOpenStatus";

  // User rejection (wallet level)
  if (msg.includes("User rejected") || msg.includes("user rejected")) return "errors.userRejected";
  if (msg.includes("User denied")) return "errors.userRejected";

  // Gas
  if (msg.includes("insufficient funds")) return "errors.insufficientGas";

  return null;
}
