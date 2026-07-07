// SPDX-License-Identifier: MIT
// ============================================================================
// @title  FootballBetting — 足球竞猜系统（Gas 优化版 / USDT 支付）
//
// @notice 本合约实现了完整的链上足球竞猜业务：
//         ① 赛事管理 ② USDT 投注 ③ Parimutuel 奖池分配 ④ 平台手续费 ⑤ 安全防护
//
// @dev    【模块拆分结构】
//         本合约通过继承聚合以下模块，每个模块负责单一职责：
//
//         ┌─────────────────────────────────────────────────────────────┐
//         │  合约文件                     │ 职责              │ 行数 ~   │
//         ├─────────────────────────────────────────────────────────────┤
//         │  IERC20.sol                  │ ERC-20 最小接口     │   40    │
//         │  FootballBettingTypes.sol    │ 枚举/结构体/事件/错误│  130    │
//         │  FootballBettingBase.sol     │ 状态/构造器/helper │  170    │
//         │  FootballBettingAdmin.sol    │ 赛事生命周期+管理   │  170    │
//         │  FootballBettingBet.sol      │ 投注+取消投注       │  120    │
//         │  FootballBettingSettle.sol   │ 领奖+手续费提取     │   70    │
//         │  FootballBettingQuery.sol    │ 查询函数            │   90    │
//         │  FootballBetting.sol (本文件)│ 继承聚合，对外唯一入口│  ~30   │
//         └─────────────────────────────────────────────────────────────┘
//
//         继承链：Admin → Base → Types
//                 Bet → Base → Types
//                 Settle → Base → Types
//                 Query → Base → Types
//         最终 FootballBetting 多重继承以上全部，C3 线性化自动解析。
//
//         【为什么 ABI 不变？】
//         所有 public/external 函数签名、事件、状态变量 getter 均与拆分前完全一致。
//         前端和测试无需任何修改。
// ============================================================================
pragma solidity ^0.8.21;

import "./FootballBettingAdmin.sol";
import "./FootballBettingBet.sol";
import "./FootballBettingSettle.sol";
import "./FootballBettingQuery.sol";

contract FootballBetting is FootballBettingAdmin, FootballBettingBet, FootballBettingSettle, FootballBettingQuery {
    /// @param _platformFeeRate 手续费率（基点，200=2%），≤1000（≤10%）
    /// @param _usdt             USDT 代币合约地址
    constructor(uint256 _platformFeeRate, address _usdt)
        FootballBettingBase(_platformFeeRate, _usdt)
    {
        // 所有初始化在 FootballBettingBase 的 constructor 中完成
    }
    // ========================================================================
    // 所有功能通过多重继承聚合，无需额外代码
    //
    // 【Gas 优化要点 — 三轮迭代】
    //   存储布局优化（详见 FootballBettingTypes.sol）：
    //   - 结构体紧凑排列（小字段共槽）
    //   - uint128 代 uint256（金额字段，两字段挤 1 槽）
    //   - uint64 代 uint256（时间戳）
    //   - uint48 代 uint256（投注时间）
    //   - bytes32 代 string（队名，免动态存储开销）
    //
    //   存储槽成本速查（EVM 硬限制）：
    //   - SSTORE 冷写：~20,000 gas
    //   - SSTORE 热写： ~5,000 gas
    //   - SLOAD 冷读：  ~2,100 gas
    //   - SLOAD 热读：    ~100 gas
    // ========================================================================

    // ========================================================================
    // 注意
    // ========================================================================
    //
    // 本合约不再接受原生币（ETH/CFX）。
    // 已删除 receive() 和 fallback() — 误发原生币到合约会直接 revert，
    // 用户不会因为操作失误而损失资金。
    // 所有资金出入通过 USDT 的 transferFrom / transfer 完成。
}
