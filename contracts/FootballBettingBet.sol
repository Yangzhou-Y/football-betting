// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "./FootballBettingBase.sol";

/**
 * ============================================================================
 * @title  FootballBettingBet — 用户投注功能
 * @notice 包含 placeBet 和 cancelBet，继承自 FootballBettingBase。
 * ============================================================================
 */
abstract contract FootballBettingBet is FootballBettingBase {
    /**
     * @notice 用户使用 USDT 投注（ERC-20 transferFrom 模式，支持重复投注和修改选项）
     *
     * @dev    【重复投注规则】
     *         同一用户可在同一赛事多次投注：
     *         - 选择相同结果 → 累加金额到已有投注 + 追加奖池
     *         - 选择不同结果 → 自动从旧奖池移除旧金额，加入新奖池，更新投注记录
     *
     *         【Gas 优化】
     *         - Bet 结构体仅 2 槽
     *         - 奖池更新最多 2 槽
     *         - unchecked 包裹奖池加法
     *         - reward 字段不写（默认 0，结算时才填）
     *         - transferFrom 放在状态更新之后（CEI 模式）
     */
    function placeBet(uint256 matchId, Result betOn, uint256 amount) external noReentrancy whenNotPaused {
        if (betOn == Result.Pending) revert InvalidResult();
        if (amount == 0) revert ZeroAmount();

        Match storage m = matches[matchId];
        if (m.startTime == 0) revert MatchNotExist();
        if (m.status != MatchStatus.Open) revert MatchNotOpen();
        if (block.timestamp >= m.deadline) revert DeadlineNotPassed();
        if (amount < m.minBet) revert BelowMinBet();
        if (m.maxBet != 0 && amount > m.maxBet) revert AboveMaxBet();
        if (betOn == Result.Draw && !m.allowDraw) revert DrawNotAllowed();

        uint128 betAmount = uint128(amount);
        Bet storage b = bets[matchId][msg.sender];
        uint128 oldAmount = b.amount;
        Result oldBetOn = b.betOn;

        if (oldAmount > 0) {
            if (oldBetOn == betOn) {
                _addToPool(m, betOn, betAmount);
                b.amount = oldAmount + betAmount;
            } else {
                _removeFromPool(m, oldBetOn, oldAmount);
                _addToPool(m, betOn, betAmount);
                b.betOn = betOn;
                b.reward = 0;
                b.amount = betAmount;

                if (betAmount > oldAmount) {
                    if (!usdt.transferFrom(msg.sender, address(this), betAmount - oldAmount))
                        revert USDTTransferFromFailed();
                } else if (betAmount < oldAmount) {
                    if (!usdt.transfer(msg.sender, oldAmount - betAmount))
                        revert USDTTransferFailed();
                }
                b.timestamp = uint48(block.timestamp);
                emit BetPlaced(matchId, msg.sender, amount, betOn);
                return;
            }
        } else {
            b.amount = betAmount;
            b.betOn = betOn;
            _addToPool(m, betOn, betAmount);
        }

        b.timestamp = uint48(block.timestamp);

        if (!usdt.transferFrom(msg.sender, address(this), amount))
            revert USDTTransferFromFailed();

        emit BetPlaced(matchId, msg.sender, amount, betOn);
    }

    /**
     * @notice 取消投注并退回 USDT（仅在投注期可操作）
     * @dev    从奖池中移除用户的全部投注金额，退回 USDT，删除投注记录
     */
    function cancelBet(uint256 matchId) external noReentrancy whenNotPaused {
        Match storage m = matches[matchId];
        if (m.startTime == 0) revert MatchNotExist();
        if (m.status != MatchStatus.Open) revert MatchNotOpen();
        if (block.timestamp >= m.deadline) revert DeadlineNotPassed();

        Bet storage b = bets[matchId][msg.sender];
        if (b.amount == 0) revert NoBet();

        uint128 refundAmount = b.amount;
        Result betOn = b.betOn;

        _removeFromPool(m, betOn, refundAmount);

        delete bets[matchId][msg.sender];

        if (!usdt.transfer(msg.sender, refundAmount)) revert USDTTransferFailed();
    }
}
