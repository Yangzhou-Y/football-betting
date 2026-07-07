// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "./IERC20.sol";
import "./FootballBettingTypes.sol";

/**
 * ============================================================================
 * @title  FootballBettingBase — 状态、构造器、修饰器与内部辅助函数
 * @notice 包含合约所有状态变量、modifier 和 internal helper 函数。
 *         作为中间层被各功能模块合约继承，最终由 FootballBetting 聚合。
 * ============================================================================
 */
abstract contract FootballBettingBase is FootballBettingTypes {
    // ========================================================================
    // 状态变量
    // ========================================================================

    address public immutable owner;
    mapping(address => bool) public admins;
    uint256 public matchCounter;
    mapping(uint256 => Match) public matches;
    mapping(uint256 => mapping(address => Bet)) public bets;
    mapping(uint256 => uint256) public matchClaimCount;

    /// @dev 平台手续费率（基点，如 200 = 2%），immutable 读取免 SLOAD
    uint256 public immutable platformFeeRate;

    /// @dev 平台累计手续费余额
    uint256 public platformBalance;

    /// @dev USDT 代币合约引用（immutable，读取免 SLOAD）
    IERC20 public immutable usdt;

    bool private reentrancyLock;

    /// @dev 紧急暂停标志
    bool public paused;

    // ========================================================================
    // 修饰器
    // ========================================================================

    modifier onlyOwner() {
        if (msg.sender != owner && !admins[msg.sender]) revert NotOwner();
        _;
    }

    modifier noReentrancy() {
        if (reentrancyLock) revert ReentrantCall();
        reentrancyLock = true;
        _;
        reentrancyLock = false;
    }

    modifier whenNotPaused() {
        if (paused) revert ContractPaused();
        _;
    }

    // ========================================================================
    // 构造函数
    // ========================================================================

    /// @param _platformFeeRate 手续费率（基点，200=2%），≤1000（≤10%）
    /// @param _usdt             USDT 代币合约地址
    constructor(uint256 _platformFeeRate, address _usdt) {
        if (_platformFeeRate > 1000) revert FeeRateTooHigh();
        if (_usdt == address(0)) revert InvalidUsdtAddress();
        owner = msg.sender;
        platformFeeRate = _platformFeeRate;
        usdt = IERC20(_usdt);
    }

    // ========================================================================
    // 内部辅助函数
    // ========================================================================

    /**
     * @dev 根据比赛结果枚举获取对应奖池金额
     */
    function _getPoolByResult(Match storage m, Result r)
        internal
        view
        returns (uint128)
    {
        if (r == Result.HomeWin) return m.poolHome;
        if (r == Result.Draw) return m.poolDraw;
        if (r == Result.AwayWin) return m.poolAway;
        return 0;
    }

    /**
     * @dev 根据主客队比分自动判定比赛结果（pure — 不读链上数据）
     */
    function _determineResult(uint8 homeScore, uint8 awayScore)
        internal
        pure
        returns (Result)
    {
        if (homeScore > awayScore) return Result.HomeWin;
        if (homeScore == awayScore) return Result.Draw;
        return Result.AwayWin;
    }

    /**
     * @dev 计算比赛手续费金额
     *      若获胜奖池为 0（无人猜中），全部奖池归平台；否则按费率计算。
     */
    function _calculateFee(Match storage m, Result r) internal view returns (uint256) {
        uint256 pool = uint256(m.totalPool);
        if (pool == 0) return 0;
        if (_getPoolByResult(m, r) == 0) return pool;
        if (platformFeeRate == 0) return 0;
        unchecked { return (pool * platformFeeRate) / 10000; }
    }

    /**
     * @dev 计算用户应得奖励（Parimutuel 公式）
     *      reward = bet * (totalPool - fee) / winningPool
     */
    function _calculateReward(Match storage m, Bet storage userBet) internal view returns (uint256) {
        uint256 winningPool = uint256(_getPoolByResult(m, m.result));
        uint256 pool = uint256(m.totalPool);
        if (pool == 0) return 0;
        uint256 feeAmount = _calculateFee(m, m.result);
        uint256 distributablePool = pool - feeAmount;

        if (winningPool > 0) {
            return (uint256(userBet.amount) * distributablePool) / winningPool;
        }
        return uint256(userBet.amount);
    }

    /**
     * @dev 向指定结果的奖池添加金额（同时更新 totalPool）
     */
    function _addToPool(Match storage m, Result r, uint128 amount) internal {
        unchecked {
            if (r == Result.HomeWin) {
                m.poolHome += amount;
            } else if (r == Result.Draw) {
                m.poolDraw += amount;
            } else {
                m.poolAway += amount;
            }
            m.totalPool += amount;
        }
    }

    /**
     * @dev 从指定结果的奖池移除金额（同时更新 totalPool）
     */
    function _removeFromPool(Match storage m, Result r, uint128 amount) internal {
        unchecked {
            if (r == Result.HomeWin) {
                m.poolHome -= amount;
            } else if (r == Result.Draw) {
                m.poolDraw -= amount;
            } else {
                m.poolAway -= amount;
            }
            m.totalPool -= amount;
        }
    }
}
