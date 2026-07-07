// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "./FootballBettingBase.sol";

/**
 * ============================================================================
 * @title  FootballBettingQuery — 查询函数
 * @notice 包含所有 view / pure 查询函数，继承自 FootballBettingBase。
 * ============================================================================
 */
abstract contract FootballBettingQuery is FootballBettingBase {
    /// @notice 获取比赛总数
    function getMatchCount() external view returns (uint256) {
        return matchCounter;
    }

    /// @notice 获取单场比赛详情
    function getMatch(uint256 matchId) external view returns (Match memory) {
        return matches[matchId];
    }

    /// @notice 获取用户投注详情
    function getUserBet(uint256 matchId, address user)
        external
        view
        returns (
            uint256 amount,
            Result betOn,
            uint256 timestamp,
            uint256 reward,
            bool claimed
        )
    {
        Bet storage b = bets[matchId][user];
        return (b.amount, b.betOn, b.timestamp, b.reward, b.claimed);
    }

    /// @notice 预览某用户在某场比赛的预期奖励
    function previewReward(uint256 matchId, address user)
        external
        view
        returns (uint256)
    {
        Match storage m = matches[matchId];
        if (!m.settled) return 0;

        Bet storage userBet = bets[matchId][user];
        if (userBet.amount == 0 || userBet.claimed) return 0;
        if (userBet.betOn != m.result) return 0;

        return _calculateReward(m, userBet);
    }

    /// @notice 获取所有比赛列表
    function getAllMatches() external view returns (Match[] memory) {
        uint256 count = matchCounter;
        Match[] memory all = new Match[](count);
        for (uint256 i = 1; i <= count; i++) {
            all[i - 1] = matches[i];
        }
        return all;
    }

    /// @notice 获取用户全部投注记录（返回 5 个并行数组）
    function getUserAllBets(address user)
        external
        view
        returns (
            uint256[] memory matchIds,
            uint256[] memory amounts,
            Result[] memory betOns,
            uint256[] memory rewards,
            bool[] memory claimed
        )
    {
        uint256 count = matchCounter;
        uint256 betCount = 0;
        for (uint256 i = 1; i <= count; i++) {
            if (bets[i][user].amount > 0) betCount++;
        }

        matchIds = new uint256[](betCount);
        amounts = new uint256[](betCount);
        betOns = new Result[](betCount);
        rewards = new uint256[](betCount);
        claimed = new bool[](betCount);

        uint256 idx = 0;
        for (uint256 i = 1; i <= count; i++) {
            Bet storage b = bets[i][user];
            if (b.amount > 0) {
                matchIds[idx] = i;
                amounts[idx] = b.amount;
                betOns[idx] = b.betOn;
                rewards[idx] = b.reward;
                claimed[idx] = b.claimed;
                idx++;
            }
        }
    }
}
