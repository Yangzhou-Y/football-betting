/**
 * Maps contract revert reason strings to i18n keys.
 * Callers should pass the result through useT() for translation.
 */
export function parseContractError(error: Error | null): string | null {
  if (!error) return null;
  const msg = error.message || "";

  // USDT / ERC-20
  if (msg.includes("insufficient balance")) return "errors.insufficientBalance";
  if (msg.includes("insufficient allowance")) return "errors.insufficientAllowance";
  if (msg.includes("USDT transferFrom failed")) return "errors.transferFromFailed";
  if (msg.includes("USDT transfer failed")) return "errors.transferFailed";
  if (msg.includes("USDT refund failed")) return "errors.refundFailed";

  // Pause
  if (msg.includes("contract is paused")) return "errors.contractPaused";
  if (msg.includes("already paused")) return "errors.alreadyPaused";
  if (msg.includes("not paused")) return "errors.notPaused";

  // Match status
  if (msg.includes("match is not open for betting")) return "errors.matchNotOpen";
  if (msg.includes("match is not open")) return "errors.matchNotOpen";
  if (msg.includes("betting deadline passed")) return "errors.deadlinePassed";
  if (msg.includes("match already settled")) return "errors.alreadySettled";
  if (msg.includes("match not settled yet")) return "errors.notSettled";
  if (msg.includes("match does not exist")) return "errors.matchNotExist";

  // Bet limits
  if (msg.includes("bet below minimum")) return "errors.betBelowMin";
  if (msg.includes("bet above maximum")) return "errors.betAboveMax";
  if (msg.includes("must choose a valid result")) return "errors.invalidResult";
  if (msg.includes("bet amount must be positive")) return "errors.positiveAmount";
  if (msg.includes("already placed a bet")) return "errors.alreadyPlacedBet";

  // Claim
  if (msg.includes("reward already claimed")) return "errors.alreadyClaimed";
  if (msg.includes("no bet found")) return "errors.noBetFound";
  if (msg.includes("no bet found for this match")) return "errors.noBetFound";
  if (msg.includes("no bet to cancel")) return "errors.noBetToCancel";

  // Draw restriction
  if (msg.includes("draw betting not allowed")) return "errors.drawNotAllowed";

  // Permission
  if (msg.includes("caller is not the owner")) return "errors.onlyOwner";

  // Admin
  if (msg.includes("match is not in Created status")) return "errors.matchNotCreated";
  if (msg.includes("match is not in Open status")) return "errors.matchNotOpenStatus";
  if (msg.includes("no fees to withdraw")) return "errors.noFees";
  if (msg.includes("scores cannot determine result")) return "errors.invalidScores";
  if (msg.includes("deadline must be <= startTime")) return "errors.deadlineBeforeStart";
  if (msg.includes("start time must be in the future")) return "errors.startTimeFuture";
  if (msg.includes("deadline must be in the future")) return "errors.deadlineFuture";

  // User rejection
  if (msg.includes("User rejected") || msg.includes("user rejected")) return "errors.userRejected";
  if (msg.includes("User denied")) return "errors.userRejected";

  // Gas
  if (msg.includes("insufficient funds")) return "errors.insufficientGas";

  return null;
}
