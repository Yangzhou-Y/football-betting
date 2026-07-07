// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "./FootballBettingBase.sol";

/**
 * ============================================================================
 * @title  FootballBettingAdmin — 赛事管理与管理员功能
 * @notice 包含赛事生命周期管理（创建/开放/关闭/删除/重开/录入赛果）、
 *         紧急暂停和 admin 管理。继承自 FootballBettingBase。
 * ============================================================================
 */
abstract contract FootballBettingAdmin is FootballBettingBase {
    // ========================================================================
    // 赛事管理（仅管理员）
    // ========================================================================

    /**
     * @notice 创建新赛事
     * @dev    Gas 优化：bytes32 队名（无动态存储）、uint128 金额同槽、
     *         uint64 时间戳 + 标志位同槽、删除显式零赋值、++i 前缀自增
     */
    function createMatch(
        bytes32 matchName,
        bytes32 homeTeam,
        bytes32 awayTeam,
        uint256 startTime,
        uint256 deadline,
        uint256 minBet,
        uint256 maxBet,
        bool allowDraw
    )
        external
        onlyOwner
        returns (uint256)
    {
        if (startTime <= block.timestamp) revert StartTimeNotFuture();
        if (deadline <= block.timestamp) revert DeadlineNotFuture();
        if (deadline > startTime) revert DeadlineAfterStart();
        if (matchName == bytes32(0)) revert MatchNameEmpty();
        if (homeTeam == bytes32(0)) revert TeamNameEmpty();
        if (awayTeam == bytes32(0)) revert TeamNameEmpty();
        if (minBet == 0) revert MinBetZero();
        if (maxBet != 0 && maxBet < minBet) revert MaxBelowMin();

        uint256 matchId = ++matchCounter;

        Match storage m = matches[matchId];
        m.matchName = matchName;
        m.homeTeam = homeTeam;
        m.awayTeam = awayTeam;

        m.minBet = uint128(minBet);
        m.maxBet = uint128(maxBet);

        m.startTime = uint64(startTime);
        m.deadline = uint64(deadline);
        m.status = MatchStatus.Created;
        m.allowDraw = allowDraw;

        emit MatchCreated(matchId, matchName, homeTeam, awayTeam, startTime, deadline, minBet, maxBet);
        return matchId;
    }

    /// @notice 开放比赛投注（Created → Open）
    function openMatch(uint256 matchId) external onlyOwner {
        Match storage m = matches[matchId];
        if (m.startTime == 0) revert MatchNotExist();
        if (m.status != MatchStatus.Created) revert MatchNotCreated();

        m.status = MatchStatus.Open;
        emit MatchOpened(matchId);
    }

    /// @notice 删除未开放且无投注的比赛
    function deleteMatch(uint256 matchId) external onlyOwner {
        Match storage m = matches[matchId];
        if (m.startTime == 0) revert MatchNotExist();
        if (m.status != MatchStatus.Created) revert MatchNotCreated();
        if (m.totalPool != 0) revert MatchHasBets();

        delete matches[matchId];

        emit MatchDeleted(matchId);
    }

    /// @notice 关闭比赛投注（Open → Closed）
    function closeMatch(uint256 matchId) external onlyOwner {
        Match storage m = matches[matchId];
        if (m.startTime == 0) revert MatchNotExist();
        if (m.status != MatchStatus.Open) revert MatchNotOpen();

        m.status = MatchStatus.Closed;
        emit MatchClosed(matchId);
    }

    /// @notice 任何人可在截止时间后关闭比赛
    function autoClose(uint256 matchId) external {
        Match storage m = matches[matchId];
        if (m.startTime == 0) revert MatchNotExist();
        if (m.status != MatchStatus.Open) revert MatchNotOpen();
        if (block.timestamp < m.deadline) revert DeadlineNotPassed();

        m.status = MatchStatus.Closed;
        emit MatchClosed(matchId);
    }

    /**
     * @notice 重新打开已结算比赛，允许管理员纠正错误比分
     * @dev    将比赛从 Settled 回退到 Closed 状态，并退还已扣除的手续费。
     *         若有用户已领奖则禁止回退。
     */
    function reopenMatch(uint256 matchId) external onlyOwner {
        Match storage m = matches[matchId];
        if (m.startTime == 0) revert MatchNotExist();
        if (!m.settled) revert MatchNotSettled();
        if (matchClaimCount[matchId] != 0) revert ClaimsExist();

        uint256 oldFee = _calculateFee(m, m.result);

        if (oldFee > 0) {
            if (platformBalance >= oldFee) {
                platformBalance -= oldFee;
            } else {
                platformBalance = 0;
            }
        }

        m.settled = false;
        m.status = MatchStatus.Closed;
        m.result = Result.Pending;
        m.homeScore = 0;
        m.awayScore = 0;

        emit MatchReopened(matchId);
    }

    /**
     * @notice 录入比分并自动结算
     */
    function recordResult(uint256 matchId, uint8 homeScore, uint8 awayScore)
        external
        onlyOwner
        whenNotPaused
    {
        Match storage m = matches[matchId];
        if (m.startTime == 0) revert MatchNotExist();
        if (m.settled) revert MatchAlreadySettled();
        if (m.status != MatchStatus.Closed &&
            !(m.status == MatchStatus.Open && block.timestamp >= m.deadline))
            revert MatchNotClosedOrPast();

        Result r = _determineResult(homeScore, awayScore);
        if (r == Result.Pending) revert ScoresEqual();

        m.homeScore = homeScore;
        m.awayScore = awayScore;
        m.result = r;
        m.status = MatchStatus.Settled;
        m.settled = true;

        uint256 feeAmount = _calculateFee(m, r);
        if (feeAmount > 0) {
            platformBalance += feeAmount;
        }

        emit MatchSettled(matchId, homeScore, awayScore, r, uint256(m.totalPool) - feeAmount, feeAmount);
    }

    // ========================================================================
    // 紧急暂停
    // ========================================================================

    function pause() external onlyOwner {
        if (paused) revert AlreadyPaused();
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyOwner {
        if (!paused) revert NotPaused();
        paused = false;
        emit Unpaused(msg.sender);
    }

    // ========================================================================
    // Admin 管理
    // ========================================================================

    function addAdmin(address admin) external {
        if (msg.sender != owner) revert NotOwner();
        if (admin == address(0)) revert InvalidAdmin();
        admins[admin] = true;
        emit AdminAdded(admin);
    }

    function removeAdmin(address admin) external {
        if (msg.sender != owner) revert NotOwner();
        if (!admins[admin]) revert NotAdmin();
        admins[admin] = false;
        emit AdminRemoved(admin);
    }
}
