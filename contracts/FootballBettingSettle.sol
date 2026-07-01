// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "./FootballBettingBase.sol";

/**
 * ============================================================================
 * @title  FootballBettingSettle — 奖励领取与手续费提取
 * @notice 包含 claimReward 和 withdrawFee，继承自 FootballBettingBase。
 * ============================================================================
 */
abstract contract FootballBettingSettle is FootballBettingBase {
    /**
     * @notice 领取中奖 USDT 奖励（Pull 模式，用户自付 Gas）
     *
     * @dev    【Gas 优化】
     *         - uint128 → uint256 展宽在乘法前，防中间溢出
     *         - unchecked 使用在逻辑保证不溢出的位置
     *         - Checks-Effects-Interactions 模式，防重入
     */
    function claimReward(uint256 matchId) external noReentrancy whenNotPaused returns (uint256 rewardAmount) {
        Match storage m = matches[matchId];
        if (m.startTime == 0) revert MatchNotExist();
        if (!m.settled) revert MatchNotSettled();

        Bet storage userBet = bets[matchId][msg.sender];
        if (userBet.amount == 0) revert NoBet();
        if (userBet.claimed) revert AlreadyClaimed();

        if (userBet.betOn != m.result) {
            userBet.claimed = true;
            return 0;
        }

        rewardAmount = _calculateReward(m, userBet);

        userBet.reward = uint128(rewardAmount);
        userBet.claimed = true;
        matchClaimCount[matchId]++;

        if (!usdt.transfer(msg.sender, rewardAmount)) revert USDTTransferFailed();

        emit RewardClaimed(matchId, msg.sender, rewardAmount);
    }

    /// @notice 提取平台手续费（仅管理员）
    /// @dev    Effects before Interactions：platformBalance 先归零，再转 USDT
    function withdrawFee() external onlyOwner noReentrancy {
        uint256 amount = platformBalance;
        if (amount == 0) revert NoFees();
        platformBalance = 0;

        if (!usdt.transfer(owner, amount)) revert USDTTransferFailed();

        emit FeeWithdrawn(owner, amount);
    }
}
