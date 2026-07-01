# 合约接口文档

## 合约信息

| 项目 | 值 |
|---|---|
| 合约名称 | `FootballBetting` |
| Solidity 版本 | `^0.8.21` |
| 许可 | MIT |
| 支付代币 | USDT (ERC-20) |
| 玩法模型 | Parimutuel（同注分彩） |
| 手续费率 | 2%（200 基点） |

## 状态变量

### 公开常量

| 变量 | 类型 | 说明 |
|---|---|---|
| `owner` | `address immutable` | 合约部署者，唯一可管理 admin |
| `usdt` | `IERC20 immutable` | USDT 代币合约地址 |
| `platformFeeRate` | `uint256 immutable` | 手续费率（基点，200 = 2%） |

### 可变状态

| 变量 | 类型 | 说明 |
|---|---|---|
| `admins` | `mapping(address => bool)` | 管理员集合 |
| `matchCounter` | `uint256` | 赛事计数（从 1 开始） |
| `matches` | `mapping(uint256 => Match)` | 赛事存储 |
| `bets` | `mapping(uint256 => mapping(address => Bet))` | 投注记录 |
| `matchClaimCount` | `mapping(uint256 => uint256)` | 赛事已领取人数 |
| `platformBalance` | `uint256` | 平台待提取手续费余额 |
| `paused` | `bool` | 紧急暂停标志 |

## 枚举

### MatchStatus

| 值 | 含义 |
|---|---|
| `Created (0)` | 已创建，不可投注 |
| `Open (1)` | 已开放，可投注 |
| `Closed (2)` | 已封盘，等待录入比分 |
| `Settled (3)` | 已开奖，可领取奖励 |

### Result

| 值 | 含义 |
|---|---|
| `Pending (0)` | 未定（初始值/平局录入时禁止） |
| `HomeWin (1)` | 主队胜 |
| `Draw (2)` | 平局 |
| `AwayWin (3)` | 客队胜 |

## 结构体

### Match

```
槽 0: bytes32 matchName
槽 1: bytes32 homeTeam
槽 2: bytes32 awayTeam
槽 3: uint128 poolHome | uint128 poolDraw
槽 4: uint128 poolAway | uint128 totalPool
槽 5: uint128 minBet   | uint128 maxBet
槽 6: uint64 startTime | uint64 deadline | Result(1B) | MatchStatus(1B) | uint8 homeScore | uint8 awayScore | bool settled | bool allowDraw
```

### Bet

```
槽 0: uint128 amount | uint128 reward
槽 1: uint48 timestamp | Result betOn(1B) | bool claimed(1B)
```

## 外部函数

### 管理员 — 赛事管理

| 函数 | 参数 | 返回值 | 修饰器 | 说明 |
|---|---|---|---|---|
| `createMatch` | `bytes32 matchName, bytes32 homeTeam, bytes32 awayTeam, uint256 startTime, uint256 deadline, uint256 minBet, uint256 maxBet, bool allowDraw` | `uint256 matchId` | `onlyOwner` | 创建新赛事 |
| `openMatch` | `uint256 matchId` | — | `onlyOwner` | 开放投注 (Created → Open) |
| `closeMatch` | `uint256 matchId` | — | `onlyOwner` | 关闭投注 (Open → Closed) |
| `autoClose` | `uint256 matchId` | — | — | 任何人可在截止时间后自动关闭 |
| `deleteMatch` | `uint256 matchId` | — | `onlyOwner` | 删除赛事（仅 Created 状态、无投注） |
| `recordResult` | `uint256 matchId, uint8 homeScore, uint8 awayScore` | — | `onlyOwner, whenNotPaused` | 录入比分并结算 |
| `reopenMatch` | `uint256 matchId` | — | `onlyOwner` | 重新打开已结算赛事（纠正比分） |

### 管理员 — 权限与暂停

| 函数 | 参数 | 修饰器 | 说明 |
|---|---|---|---|
| `addAdmin` | `address admin` | `owner only` | 添加管理员 |
| `removeAdmin` | `address admin` | `owner only` | 移除管理员 |
| `pause` | — | `onlyOwner` | 紧急暂停 |
| `unpause` | — | `onlyOwner` | 恢复 |
| `withdrawFee` | — | `onlyOwner, noReentrancy` | 提取手续费 |

### 用户操作

| 函数 | 参数 | 返回值 | 修饰器 | 说明 |
|---|---|---|---|---|
| `placeBet` | `uint256 matchId, Result betOn, uint256 amount` | — | `noReentrancy, whenNotPaused` | USDT 投注（支持重复投注和切换选项） |
| `cancelBet` | `uint256 matchId` | — | `noReentrancy, whenNotPaused` | 取消投注，退回 USDT |
| `claimReward` | `uint256 matchId` | `uint256 rewardAmount` | `noReentrancy, whenNotPaused` | 领取中奖 USDT |

### 查询

| 函数 | 参数 | 返回值 | 说明 |
|---|---|---|---|
| `getMatchCount` | — | `uint256` | 赛事总数 |
| `getMatch` | `uint256 matchId` | `Match memory` | 单场赛事详情 |
| `getAllMatches` | — | `Match[] memory` | 所有赛事列表 |
| `getUserBet` | `uint256 matchId, address user` | `(amount, betOn, timestamp, reward, claimed)` | 单场投注详情 |
| `getUserAllBets` | `address user` | `(matchIds[], amounts[], betOns[], rewards[], claimed[])` | 用户全部投注 |
| `previewReward` | `uint256 matchId, address user` | `uint256` | 预览预期奖励（不消耗 Gas） |

## 事件

| 事件 | 参数 | 触发时机 |
|---|---|---|
| `MatchCreated` | `matchId, matchName, homeTeam, awayTeam, startTime, deadline, minBet, maxBet` | 创建赛事 |
| `MatchOpened` | `matchId` | 开放投注 |
| `MatchClosed` | `matchId` | 关闭投注 |
| `BetPlaced` | `matchId, user, amount, betOn` | 用户投注 |
| `MatchSettled` | `matchId, homeScore, awayScore, result, distributablePool, feeAmount` | 录入比分结算 |
| `RewardClaimed` | `matchId, user, rewardAmount` | 用户领奖 |
| `FeeWithdrawn` | `owner, amount` | 管理员提取手续费 |
| `MatchReopened` | `matchId` | 重新打开已结算赛事 |
| `MatchDeleted` | `matchId` | 删除赛事 |
| `AdminAdded` | `admin` | 添加管理员 |
| `AdminRemoved` | `admin` | 移除管理员 |
| `Paused` | `owner` | 合约暂停 |
| `Unpaused` | `owner` | 合约恢复 |

## 自定义错误

### 权限类

| 错误 | 含义 |
|---|---|
| `NotOwner()` | 调用者非 owner 且非 admin |
| `NotAdmin()` | 待移除的地址非管理员 |
| `InvalidAdmin()` | 不能添加零地址 |

### 状态类

| 错误 | 含义 |
|---|---|
| `ReentrantCall()` | 重入攻击拦截 |
| `ContractPaused()` | 合约已暂停 |
| `AlreadyPaused()` | 合约已经是暂停状态 |
| `NotPaused()` | 合约非暂停状态 |
| `MatchNotExist()` | 赛事不存在 |
| `MatchNotCreated()` | 赛事非 Created 状态 |
| `MatchNotOpen()` | 赛事非 Open 状态 |
| `MatchNotClosedOrPast()` | 赛事未封盘且未过截止时间 |
| `MatchAlreadySettled()` | 赛事已结算 |
| `MatchNotSettled()` | 赛事未结算 |
| `MatchHasBets()` | 赛事已有投注（禁止删除） |

### 参数校验类

| 错误 | 含义 |
|---|---|
| `FeeRateTooHigh()` | 手续费率超过 10% |
| `InvalidUsdtAddress()` | USDT 地址为零地址 |
| `StartTimeNotFuture()` | 开赛时间非未来 |
| `DeadlineNotFuture()` | 截止时间非未来 |
| `DeadlineAfterStart()` | 截止时间晚于开赛时间 |
| `MatchNameEmpty()` | 比赛名称为空 |
| `TeamNameEmpty()` | 队名为空 |
| `MinBetZero()` | 最低投注为 0 |
| `MaxBelowMin()` | 最高投注 < 最低投注 |
| `ScoresEqual()` | 比分相同（不允许平局时） |
| `InvalidResult()` | 投注选项无效 |
| `ZeroAmount()` | 金额为 0 |

### 投注校验类

| 错误 | 含义 |
|---|---|
| `BelowMinBet()` | 低于最低投注额 |
| `AboveMaxBet()` | 超过最高投注额 |
| `DrawNotAllowed()` | 该赛事不允许投注平局 |
| `DeadlineNotPassed()` | 截止时间未过 |
| `NoBet()` | 用户无投注记录 |

### 领奖 / 费用类

| 错误 | 含义 |
|---|---|
| `AlreadyClaimed()` | 已领取 |
| `NoFees()` | 无手续费可提取 |
| `ClaimsExist()` | 已有用户领取（禁止 reopen） |

### 转账类

| 错误 | 含义 |
|---|---|
| `USDTTransferFailed()` | USDT 转出失败 |
| `USDTTransferFromFailed()` | USDT 转入失败 |

## 安全机制

- **多管理员权限**：`onlyOwner` 修饰器同时放行 owner 和 admins，真正 owner 专属操作做内联检查
- **重入保护**：`noReentrancy` 修饰器，Checks-Effects-Interactions 模式
- **紧急暂停**：`whenNotPaused` 修饰器，禁用投注/领奖/结算
- **防重复结算**：`settled` 标记位，不可逆
- **溢出保护**：Solidity 0.8.x 内置检查 + `unchecked` 在已证明安全的地方使用
- **零地址防护**：构造函数拒绝零地址 USDT
- **无 receive/fallback**：误发原生币自动 revert

## Parimutuel 分配算法

```
手续费 = pool × platformFeeRate / 10000    (如果 winningPool == 0，全部归平台)
可分配奖池 = pool - 手续费
用户奖励 = bet × 可分配奖池 / winningPool
```

- 未猜中用户调用 `claimReward` 返回 `rewardAmount = 0`，仅标记 `claimed = true`（清理存储）
- 无人猜中时（`winningPool == 0`），全部奖池归入平台手续费
