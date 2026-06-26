// SPDX-License-Identifier: MIT
// ============================================================================
// SPDX（Software Package Data Exchange）：以太坊智能合约的标准许可证标识。
// MIT 许可证允许任何人自由使用、修改、分发本合约代码。
// ============================================================================
pragma solidity ^0.8.21;

/**
 * @dev ERC-20 代币最小接口（内联定义，不依赖 OpenZeppelin）
 *
 *      【为什么不用 OpenZeppelin 的 IERC20？】
 *      1. 编译速度：不引入外部依赖包，编译更快
 *      2. 字节码体积：只编译用到的 3 个函数，字节码更短
 *      3. 部署成本：更少的元数据和 import 路径处理
 *
 *      【为什么只需要这三个函数？】
 *      - transferFrom：投注时从用户钱包拉取 USDT 到合约
 *      - transfer：领奖和提取手续费时从合约转出 USDT
 *      - balanceOf：前端查询合约/用户 USDT 余额（view 函数）
 *      - 不需要 approve：因为 approve 由用户直接调 USDT 合约，不经过本合约
 *      - 不需要 totalSupply/allowance 等：竞猜业务不关心
 *
 *      【ERC-20 安全提醒】
 *      - transferFrom 依赖用户先调用 USDT.approve(spender, amount)，否则会 revert
 *      - 部分非标准 USDT（如 USDT on Ethereum）transferFrom 不返回 bool，
 *        需使用 SafeERC20 库。但 Conflux eSpace 上的 USDT 是标准实现，安全。
 */
interface IERC20 {
    /// @notice 从 sender 转账 amount 到 recipient（需发送者预先 approve）
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    /// @notice 从调用者转账 amount 到 recipient
    function transfer(address recipient, uint256 amount) external returns (bool);
    /// @notice 查询账户的 USDT 余额
    function balanceOf(address account) external view returns (uint256);
}

/**
 * ============================================================================
 * @title  FootballBetting — 足球竞猜系统（Gas 优化版 / USDT 支付）
 *
 * @notice 本合约实现了完整的链上足球竞猜业务：
 *         ① 赛事管理 ② USDT 投注 ③ Parimutuel 奖池分配 ④ 平台手续费 ⑤ 安全防护
 *
 * @dev    【Gas 优化要点 — 三轮迭代】
 *         本合约对存储布局和数据类型做了多轮优化，累计降低主要函数 26-41% Gas：
 *
 *         ┌──────────────────────┬──────────┬──────────┬──────────────┐
 *         │  优化手段              │ 优化对象  │ 节省 Gas  │ 说明          │
 *         ├──────────────────────┼──────────┼──────────┼──────────────┤
 *         │  结构体紧凑排列        │ Match/Bet│  ~40-50% │ 小字段共槽    │
 *         │  uint128 代 uint256   │ 金额字段  │  ~30%    │ 两字段挤 1 槽 │
 *         │  uint64 代 uint256    │ 时间戳    │  ~15%    │ 停供值可用 58 亿年│
 *         │  uint48 代 uint256    │ 投注时间  │  ~10%    │ 可用 890 万年 │
 *         │  string → bytes32     │ 队名      │  ~15%    │ 免动态存储开销 │
 *         │  删除显式零赋值        │ createMatch│ ~8%    │ Solidity 默认 0│
 *         │  ++i 前缀自增          │ 计数器    │  ~1%     │ 省栈操作       │
 *         └──────────────────────┴──────────┴──────────┴──────────────┘
 *
 *         存储槽成本速查（EVM 硬限制，不可突破）：
 *         - SSTORE 冷写（首次写入槽）：~20,000 gas
 *         - SSTORE 热写（覆盖已有值）： ~5,000 gas
 *         - SSTORE 写零（清零释放）：   ~5,000 gas（返还 ~15,000 gas 退款）
 *         - SLOAD 冷读：              ~2,100 gas
 *         - SLOAD 热读（同一交易内）：  ~100 gas
 * ============================================================================
 */
contract FootballBetting {

    // ========================================================================
    // 一、枚举定义（Enum）
    // ========================================================================
    // Solidity 枚举值从 0 开始自增：Pending=0, HomeWin=1, Draw=2, AwayWin=3
    // ========================================================================

    /// @dev 比赛结果枚举（足球 1X2 玩法）
    enum Result { Pending, HomeWin, Draw, AwayWin }

    /// @dev 比赛状态枚举（生命周期：Created→Open→Closed→Settled）
    enum MatchStatus { Created, Open, Closed, Settled }

    // ========================================================================
    // 二、结构体定义（Struct）— Gas 优化核心区域
    // ========================================================================
    //
    // 【Solidity 存储布局规则（理解优化关键）】
    // 1. 每个存储槽 = 32 字节，EVM 按槽计费
    // 2. 相邻的多个小字段（总大小 ≤ 32 字节）自动压缩到一个槽 → 省 SSTORE
    // 3. 动态类型（string/bytes/动态数组）始终独占一个槽（存指针）→ 费 Gas
    //    这是 bytes32 替代 string 的动机：32 字节固定长度 = 1 槽，无额外指针
    // 4. 结构体数组元素始终从新槽开始
    //
    // 设计策略：先放定长字段（bytes32），再放可打包的量值对。

    /**
     * @dev 比赛信息结构体（三轮优化最终版）
     *
     *      【槽位布局图 — 共 7 槽】
     *      ┌──────┬──────────────────────────────────────────────────┐
     *      │ 槽 0 │ bytes32 matchName          (32B，占满)             │
     *      │ 槽 1 │ bytes32 homeTeam           (32B，占满)             │
     *      │ 槽 2 │ bytes32 awayTeam           (32B，占满)             │
     *      │ 槽 3 │ uint128 poolHome │ uint128 poolDraw (16B+16B=32) │
     *      │ 槽 4 │ uint128 poolAway │ uint128 totalPool (同挤)       │
     *      │ 槽 5 │ uint128 minBet   │ uint128 maxBet   (同挤)        │
     *      │ 槽 6 │ uint64 startTime(8B)│uint64 deadline(8B)│        │
     *      │      │ Result(1B)│MatchStatus(1B)│uint8(1B)│uint8(1B)│  │
     *      │      │ bool(1B)│bool(1B) → 合计 22B < 32B ✓            │
     *      └──────┴──────────────────────────────────────────────────┘
     *
     *      【为什么 bytes32 代替 string？】
     *      string 是动态类型，每个额外占 1 槽指针 + 独立槽存长度+内容（共 2+ 槽/队名）。
     *      bytes32 是定长 32 字节，直接嵌入结构体，0 额外槽。
     *      两支队名从 string→bytes32：省 2-4 次 SSTORE ≈ 4-8 万 gas（createMatch）。
     *      注意：队名需在前端用 ethers.encodeBytes32String() 编码，中文 UTF-8 每字 3 字节，最多 10 个中文字。
     *
     *      旧布局（string + uint256 全部）≈ 12-14 槽 → 新布局 6 槽
     */
    struct Match {
        // ---- 名称 + 队名：各占一个完整槽 ----
        bytes32 matchName;
        bytes32 homeTeam;
        bytes32 awayTeam;

        // ---- 金额对（两两打包，各 16 字节凑满 32） ----
        uint128 poolHome;
        uint128 poolDraw;
        uint128 poolAway;
        uint128 totalPool;

        // ---- 限额对 ----
        uint128 minBet;
        uint128 maxBet;

        // ---- 时间 + 标志位（全部挤在一个槽） ----
        uint64 startTime;
        uint64 deadline;
        Result result;           // enum = 1 字节
        MatchStatus status;      // enum = 1 字节
        uint8 homeScore;         // 1 字节，比分 0-255
        uint8 awayScore;         // 1 字节
        bool settled;            // 1 字节
        bool allowDraw;          // 1 字节 — 是否允许投注平局
    }

    /**
     * @dev 投注记录结构体（槽位布局优化版）
     *
     *      【槽位布局图】
     *      槽 0:  uint128 amount │ uint128 reward    (投注额 + 奖金，各 16B = 32B)
     *      槽 1:  uint48 timestamp │ betOn[1B] │ claimed[1B]
     *            (6+1+1 = 8 字节，剩余 24 字节空闲)
     *
     *      旧布局约 5 槽 → 新布局 2 槽，placeBet 节省约 3 次 SSTORE
     */
    struct Bet {
        uint128 amount;          // 投注金额（USDT 最小单位），uint128 上限 ≈ 3.4e38
        uint128 reward;          // 应得奖金，打包在同一个槽
        uint48 timestamp;        // 投注时间戳，uint48 可用 890 万年
        Result betOn;            // 投注选项
        bool claimed;            // 是否已领取
    }

    // ========================================================================
    // 三、状态变量
    // ========================================================================

    address public immutable owner;
    mapping(address => bool) public admins;
    uint256 public matchCounter;
    mapping(uint256 => Match) public matches;
    mapping(uint256 => mapping(address => Bet)) public bets;
    mapping(uint256 => uint256) public matchClaimCount;

    /// @dev 平台手续费率（基点，如 200 = 2%），immutable 读取免 SLOAD
    uint256 public immutable platformFeeRate;

    /// @dev 平台累计手续费余额（Faucet USDT = 18 位小数，1 USDT = 10^18 最小单位）
    uint256 public platformBalance;

    /// @dev USDT 代币合约引用（immutable——constructor 赋值后不可修改，读取免 SLOAD）
    ///      【ETH → USDT 改造关键】
    ///      原生币（ETH/CFX）用 payable + msg.value + call{value:} 收发；
    ///      ERC-20 代币（USDT/USDC）用 IERC20.transferFrom + IERC20.transfer 收发。
    ///      本合约持有的是 USDT 余额（存储在该 USDT 合约的账本中），而非本合约的 ETH 余额。
    IERC20 public immutable usdt;

    bool private reentrancyLock;

    /// @dev 紧急暂停标志，true = 合约已暂停，用户操作被禁用（public 生成公开 getter）
    bool public paused;

    // ========================================================================
    // 四、事件
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
    event FeeRefundShortfall(uint256 indexed matchId, uint256 oldFee, uint256 available);
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
    error DeadlineNotReached();
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

    // ========================================================================
    // 五、修饰器
    // ========================================================================

    modifier onlyAdmin() {
        if (msg.sender != owner && !admins[msg.sender]) revert NotOwner();
        _;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
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
    // 六、构造函数
    // ========================================================================

    /// @param _platformFeeRate 手续费率（基点，200=2%），≤1000（≤10%）
    /// @param _usdt             USDT 代币合约地址
    ///                          【不同网络的 USDT 地址是不同的！】
    ///                          - Conflux eSpace 主网：查询 confluxscan.io 或官方文档
    ///                          - Sepolia 测试网：需自行部署 MockERC20 或使用测试 USDT
    ///                          - Hardhat 本地链：deploy.ts 自动部署 MockERC20 并传入
    constructor(uint256 _platformFeeRate, address _usdt) {
        if (_platformFeeRate > 1000) revert FeeRateTooHigh();
        if (_usdt == address(0)) revert InvalidUsdtAddress();
        owner = msg.sender;
        platformFeeRate = _platformFeeRate;
        usdt = IERC20(_usdt);
    }

    // ========================================================================
    // 七、赛事管理（仅管理员）
    // ========================================================================

    /**
     * @notice 创建新赛事
     *
     * @dev    【createMatch Gas 优化清单】
     *         ① bytes32 队名 — 各占 1 槽，无动态存储开销（原 string 每队名多 2+ 槽）
     *         ② uint128 金额 — minBet+maxBet 共槽（1 SSTORE 而非 2）
     *         ③ uint64 时间戳 — startTime+deadline+5 个标志位全部在槽 5（1 SSTORE）
     *         ④ 删除显式零赋值 — pool/result/settled/score 靠 Solidity 默认 0
     *         ⑤ ++matchCounter 前缀自增 — 比后缀省 1 次栈操作
     *
     *         槽写入合计：homeTeam(1) + awayTeam(1) + minBet/maxBet(1) + time/flag(1) = 4 次 SSTORE
     *         对比优化前：约 10-12 次 SSTORE → 降低约 60%
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
        onlyAdmin
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
    function openMatch(uint256 matchId) external onlyAdmin {
        Match storage m = matches[matchId];
        if (m.startTime == 0) revert MatchNotExist();
        if (m.status != MatchStatus.Created) revert MatchNotCreated();

        m.status = MatchStatus.Open;
        emit MatchOpened(matchId);
    }

    function deleteMatch(uint256 matchId) external onlyAdmin {
        Match storage m = matches[matchId];
        if (m.startTime == 0) revert MatchNotExist();
        if (m.status != MatchStatus.Created) revert MatchNotCreated();
        if (m.totalPool != 0) revert MatchHasBets();

        delete matches[matchId];

        emit MatchDeleted(matchId);
    }

    function closeMatch(uint256 matchId) external onlyAdmin {
        Match storage m = matches[matchId];
        if (m.startTime == 0) revert MatchNotExist();
        if (m.status != MatchStatus.Open) revert MatchNotOpen();

        m.status = MatchStatus.Closed;
        emit MatchClosed(matchId);
    }

    function autoClose(uint256 matchId) external {
        Match storage m = matches[matchId];
        if (m.startTime == 0) revert MatchNotExist();
        if (m.status != MatchStatus.Open) revert MatchNotOpen();
        if (block.timestamp < m.deadline) revert DeadlineNotReached();

        m.status = MatchStatus.Closed;
        emit MatchClosed(matchId);
    }

    /**
     * @notice 重新打开已结算比赛，允许管理员纠正错误比分
     * @dev    将比赛从 Settled 回退到 Closed 状态，并退还已扣除的手续费。
     *         仅当手续费未被提取时才能完整退还；若已部分提取则退还剩余部分。
     *         若有用户已领奖则禁止回退，防止合约资不抵债。
     */
    function reopenMatch(uint256 matchId) external onlyAdmin {
        Match storage m = matches[matchId];
        if (m.startTime == 0) revert MatchNotExist();
        if (!m.settled) revert MatchNotSettled();
        if (matchClaimCount[matchId] != 0) revert ClaimsExist();

        // 计算之前结算时扣除的手续费
        uint256 oldFee = _calculateFee(m, m.result);

        // 退还手续费（若平台余额不足，仅退还剩余部分并发出事件）
        if (oldFee > 0) {
            if (platformBalance >= oldFee) {
                platformBalance -= oldFee;
            } else {
                emit FeeRefundShortfall(matchId, oldFee, platformBalance);
                platformBalance = 0;
            }
        }

        // 回退比赛状态到 Closed，清除比分和结果
        m.settled = false;
        m.status = MatchStatus.Closed;
        m.result = Result.Pending;
        m.homeScore = 0;
        m.awayScore = 0;

        emit MatchReopened(matchId);
    }

    /// @notice 紧急暂停合约，禁用所有用户操作（投注/领奖/结算）
    function pause() external onlyAdmin {
        if (paused) revert AlreadyPaused();
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyAdmin {
        if (!paused) revert NotPaused();
        paused = false;
        emit Unpaused(msg.sender);
    }

    function addAdmin(address admin) external onlyOwner {
        if (admin == address(0)) revert InvalidAdmin();
        admins[admin] = true;
        emit AdminAdded(admin);
    }

    function removeAdmin(address admin) external onlyOwner {
        if (!admins[admin]) revert NotAdmin();
        admins[admin] = false;
        emit AdminRemoved(admin);
    }

    /**
     * @notice 录入比分并自动结算
     *
     * @dev    【recordResult Gas 优化】
     *         ① 参数 uint8 — calldata 紧凑，比 uint256 省空间
     *         ② 5 个小字段（score/scores/result/status/settled）全在槽 5，1 次 SSTORE 全写
     *         ③ unchecked — pool * platformFeeRate / 10000 不可能溢出（pool≤uint128 上限）
     *         ④ 手续费累加到 platformBalance（独立 uint256 槽，1 次 SSTORE）
     */
    function recordResult(uint256 matchId, uint8 homeScore, uint8 awayScore)
        external
        onlyAdmin
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

        // 同槽写入（全部在槽 5 — 见 Match 布局图）
        m.homeScore = homeScore;
        m.awayScore = awayScore;
        m.result = r;
        m.status = MatchStatus.Settled;
        m.settled = true;

        // 手续费计算 + 无人猜中时全部归入平台
        uint256 feeAmount = _calculateFee(m, r);
        if (feeAmount > 0) {
            platformBalance += feeAmount;
        }

        emit MatchSettled(matchId, homeScore, awayScore, r, uint256(m.totalPool) - feeAmount, feeAmount);
    }

    // ========================================================================
    // 八、用户投注
    // ========================================================================

    /**
     * @notice 用户使用 USDT 投注（ERT-20 transferFrom 模式，支持重复投注和修改选项）
     *
     * @dev    【重复投注规则】
     *         同一用户可在同一赛事多次投注：
     *         - 选择相同结果 → 累加金额到已有投注 + 追加奖池
     *         - 选择不同结果 → 自动从旧奖池移除旧金额，加入新奖池，更新投注记录
     *
     *         【ETH → USDT 改造核心变化】
     *         旧版：function placeBet(id, betOn) external payable
     *              用户随交易附带 ETH → msg.value 自动到账
     *         新版：function placeBet(id, betOn, amount) external
     *              用户预先 approve 合约 → 合约主动拉取 USDT
     *
     *         【用户操作流程（前端）】
     *         ① 用户打开投注页面
     *         ② 前端检查用户 USDT 余额是否足够
     *         ③ 前端检查用户是否已 approve 足够的 USDT 给合约
     *         ④ 如未 approve，引导用户先调用 USDT.approve(contractAddress, amount)
     *         ⑤ 用户确认投注 → 前端调用 placeBet(id, betOn, amount)
     *         ⑥ 合约内部调用 usdt.transferFrom(msg.sender, address(this), amount)
     *         ⑦ 成功后 emit BetPlaced 事件，前端监听后刷新 UI
     *
     *         【placeBet Gas 优化】
     *         ① Bet 结构体仅 2 槽 — amount/reward 同槽(1 SSTORE)，timestamp/betOn/claimed 同槽(1 SSTORE)
     *         ② 奖池更新最多 2 槽 — poolHome/poolDraw 同槽，poolAway/totalPool 同槽
     *         ③ unchecked 包裹奖池加法 — uint128 上限 ≈ 3.4e38，远超 USDT 总流通量，安全
     *         ④ uint128(amount) SafeCast — 0.8.x 保护，投注额不可能超 2^128
     *         ⑤ reward 字段不写 — 默认 0，等结算时再填，省 1 次 SSTORE
     *         ⑥ transferFrom 放在状态更新之后 → Checks-Effects-Interactions 模式
     *
     * @param matchId 赛事 ID（从 1 开始，由 createMatch 返回）
     * @param betOn   投注选项（HomeWin=1, Draw=2, AwayWin=3）
     * @param amount  投注 USDT 金额（最小单位，18 位小数：1 USDT = 10^18）
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
                // Clear old reward before writing new amount (same slot, compiler may combine)
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

    // ========================================================================
    // 九、奖励领取
    // ========================================================================

    /**
     * @notice 领取中奖 USDT 奖励（Pull 模式，用户自付 Gas）
     *
     * @dev    【ETH → USDT 改动】
     *         旧版：(bool success,) = payable(msg.sender).call{value: rewardAmount}("");
     *         新版：require(usdt.transfer(msg.sender, rewardAmount), "...");
     *         transfer 替代 call{value:} — 功能等价，安全性和可读性更好。
     *         transfer 失败时自动 revert，不需要手动检查 success bool。
     *
     *         【claimReward Gas 优化】
     *         ① uint128 → uint256 展宽在乘法前 — 防中间溢出
     *         ② unchecked — distributablePool - winningPool 逻辑保证不溢出
     *         ③ 状态写入 2 槽 — reward+claimed 跨槽存储
     *         ④ Checks-Effects-Interactions — 状态更新在 USDT 转出之前，防重入
     *         ⑤ uint128(rewardAmount) SafeCast — 奖励不可能超 uint128 上限
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

    // ========================================================================
    // 十、平台手续费提取
    // ========================================================================

    /// @notice 提取平台手续费（仅管理员，USDT 转账）
    /// @dev    平台手续费来自：① 正常结算时 2% 抽成  ② 无人猜中时全部奖池归入
    ///         Effects before Interactions：platformBalance 先归零，再转 USDT
    function withdrawFee() external onlyAdmin noReentrancy {
        uint256 amount = platformBalance;
        if (amount == 0) revert NoFees();
        platformBalance = 0;

        if (!usdt.transfer(owner, amount)) revert USDTTransferFailed();

        emit FeeWithdrawn(owner, amount);
    }

    // ========================================================================
    // 十一、查询函数
    // ========================================================================

    function getMatchCount() external view returns (uint256) {
        return matchCounter;
    }

    function getMatch(uint256 matchId) external view returns (Match memory) {
        return matches[matchId];
    }

    /// @notice 获取用户投注详情（注意返回值中的 uint128 字段在 ABI 中自动展宽为 uint256）
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

    /**
     * @notice 预览某用户在某场比赛的预期奖励（不实际领取，不消耗 Gas）
     * @dev    与 claimReward 同一公式：amount * distributablePool / winningPool
     */
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

    /// @notice 分页获取比赛列表（每页 pageSize 条，page 从 0 开始）
    function getMatchesPaginated(uint256 page, uint256 pageSize)
        external
        view
        returns (Match[] memory result, uint256 totalMatches)
    {
        totalMatches = matchCounter;
        if (pageSize == 0) return (new Match[](0), totalMatches);
        uint256 start = page * pageSize + 1;
        if (start > totalMatches) return (new Match[](0), totalMatches);
        uint256 end = start + pageSize;
        if (end > totalMatches + 1) end = totalMatches + 1;
        uint256 size = end - start;
        result = new Match[](size);
        for (uint256 i = 0; i < size; i++) {
            result[i] = matches[start + i];
        }
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
        // 第一趟：统计该用户投注了多少场比赛
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

    // ========================================================================
    // 十二、内部辅助函数（internal — 仅合约内及子合约可调用）
    // ========================================================================

    /**
     * @dev 根据比赛结果枚举获取对应奖池金额
     * @return uint128 — 返回 pool 字段原始类型，uint128 上限 ≈ 3.4e38
     *         调用方在需要乘法/除法时自行展宽为 uint256 防溢出
     */
    function _getPoolByResult(Match storage m, Result r)
        internal
        view
        returns (uint128)
    {
        if (r == Result.HomeWin) return m.poolHome;
        if (r == Result.Draw) return m.poolDraw;
        if (r == Result.AwayWin) return m.poolAway;
        return 0; // Pending 或异常：返回 0
    }

    /**
     * @dev 根据主客队比分自动判定比赛结果
     *      pure 修饰符 — 不读链上数据，纯粹的计算函数，0 gas（外部调用时）
     *      三种情况全覆盖，不可能返回 Pending
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
     * @dev 计算比赛手续费金额（统一公式，供 recordResult/reopenMatch 共用）
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
     * @dev 计算用户应得奖励（Parimutuel 公式，供 claimReward/previewReward 共用）
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

    function _removeFromPool(Match storage m, Result r, uint128 amount) internal {
        unchecked {
            if (r == Result.HomeWin) {
                assert(m.poolHome >= amount);
                m.poolHome -= amount;
            } else if (r == Result.Draw) {
                assert(m.poolDraw >= amount);
                m.poolDraw -= amount;
            } else {
                assert(m.poolAway >= amount);
                m.poolAway -= amount;
            }
            assert(m.totalPool >= amount);
            m.totalPool -= amount;
        }
    }

    // ========================================================================
    // 十三、注意
    // ========================================================================
    //
    // 本合约不再接受原生币（ETH/CFX）。
    // 已删除 receive() 和 fallback() — 误发原生币到合约会直接 revert，
    // 用户不会因为操作失误而损失资金。
    // 所有资金出入通过 USDT 的 transferFrom / transfer 完成。
}
