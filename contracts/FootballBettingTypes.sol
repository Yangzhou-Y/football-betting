// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

/**
 * ============================================================================
 * @title  FootballBettingTypes — 类型定义合约
 * @notice 集中管理 FootballBetting 的所有枚举、结构体、事件和自定义错误。
 *         作为基础合约被 FootballBetting 继承，不包含状态和逻辑。
 * ============================================================================
 */
abstract contract FootballBettingTypes {
    // ========================================================================
    // 枚举定义
    // ========================================================================

    /// @dev 比赛结果枚举（足球 1X2 玩法）
    enum Result { Pending, HomeWin, Draw, AwayWin }

    /// @dev 比赛状态枚举（生命周期：Created→Open→Closed→Settled）
    enum MatchStatus { Created, Open, Closed, Settled }

    // ========================================================================
    // 结构体定义 — Gas 优化核心区域
    // ========================================================================
    //
    // 【Solidity 存储布局规则（理解优化关键）】
    // 1. 每个存储槽 = 32 字节，EVM 按槽计费
    // 2. 相邻的多个小字段（总大小 ≤ 32 字节）自动压缩到一个槽 → 省 SSTORE
    // 3. 动态类型（string/bytes/动态数组）始终独占一个槽（存指针）→ 费 Gas
    // 4. 结构体数组元素始终从新槽开始

    /**
     * @dev 比赛信息结构体（三轮优化最终版，共 7 槽）
     */
    struct Match {
        bytes32 matchName;
        bytes32 homeTeam;
        bytes32 awayTeam;

        uint128 poolHome;
        uint128 poolDraw;
        uint128 poolAway;
        uint128 totalPool;

        uint128 minBet;
        uint128 maxBet;

        uint64 startTime;
        uint64 deadline;
        Result result;
        MatchStatus status;
        uint8 homeScore;
        uint8 awayScore;
        bool settled;
        bool allowDraw;
    }

    /**
     * @dev 投注记录结构体（槽位布局优化版，共 2 槽）
     */
    struct Bet {
        uint128 amount;
        uint128 reward;
        uint48 timestamp;
        Result betOn;
        bool claimed;
    }

    // ========================================================================
    // 事件
    // ========================================================================

    event MatchCreated(
        uint256 indexed matchId,
        bytes32 matchName,
        bytes32 homeTeam, bytes32 awayTeam,
        uint256 startTime, uint256 deadline,
        uint256 minBet, uint256 maxBet
    );
    event MatchOpened(uint256 indexed matchId);
    event MatchClosed(uint256 indexed matchId);
    event BetPlaced(
        uint256 indexed matchId, address indexed user,
        uint256 amount, Result betOn
    );
    event MatchSettled(
        uint256 indexed matchId,
        uint8 homeScore, uint8 awayScore, Result result,
        uint256 distributablePool, uint256 feeAmount
    );
    event RewardClaimed(
        uint256 indexed matchId, address indexed user, uint256 rewardAmount
    );
    event FeeWithdrawn(address indexed owner, uint256 amount);
    event MatchReopened(uint256 indexed matchId);
    event MatchDeleted(uint256 indexed matchId);
    event AdminAdded(address indexed admin);
    event AdminRemoved(address indexed admin);
    event Paused(address indexed owner);
    event Unpaused(address indexed owner);

    // ========================================================================
    // Custom errors — gas-efficient (4-byte selector vs full string)
    // ========================================================================
    error NotOwner();
    error ReentrantCall();
    error ContractPaused();
    error AlreadyPaused();
    error NotPaused();
    error FeeRateTooHigh();
    error InvalidUsdtAddress();
    error StartTimeNotFuture();
    error DeadlineNotFuture();
    error DeadlineAfterStart();
    error MatchNameEmpty();
    error TeamNameEmpty();
    error MinBetZero();
    error MaxBelowMin();
    error MatchNotExist();
    error MatchNotCreated();
    error MatchNotOpen();
    error MatchNotClosedOrPast();
    error MatchAlreadySettled();
    error MatchNotSettled();
    error MatchHasBets();
    error DeadlineNotPassed();
    error InvalidResult();
    error ZeroAmount();
    error BelowMinBet();
    error AboveMaxBet();
    error DrawNotAllowed();
    error NoBet();
    error AlreadyClaimed();
    error NoFees();
    error ScoresEqual();
    error ClaimsExist();
    error NotAdmin();
    error InvalidAdmin();
    error USDTTransferFailed();
    error USDTTransferFromFailed();
}
