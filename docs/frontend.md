# 前端架构文档

## 技术栈

| 技术 | 版本 | 用途 |
|---|---|---|
| Next.js | 16 | App Router 框架 |
| React | 19 | UI 组件 |
| TypeScript | — | 类型安全 |
| wagmi | v2 | 链上读写（writeContract / readContract） |
| RainbowKit | v2 | 钱包连接 UI |
| viem | — | 链上数据编解码 |
| Tailwind CSS | v4 | 原子化样式 |
| TanStack Query | v5 | 请求缓存与自动刷新 |

## 目录结构

```
frontend/src/
├── app/                        # Next.js App Router 页面
│   ├── layout.tsx              #   根布局（元数据 + 字体 + Provider 链）
│   ├── page.tsx                #   首页（统计数据 + 热门赛事 + 即将开赛 + 新用户引导）
│   ├── globals.css             #   全局样式与动画
│   ├── matches/
│   │   ├── page.tsx            #   赛事列表（筛选 + 排序 + 分页）
│   │   └── [id]/
│   │       └── page.tsx        #   赛事详情（投注面板 + 领奖面板）
│   ├── my-bets/
│   │   └── page.tsx            #   我的竞猜（投注历史 + 盈亏统计 + 一键领奖）
│   ├── leaderboard/
│   │   └── page.tsx            #   排行榜（盈亏排名 + 分页）
│   └── admin/
│       └── page.tsx            #   管理后台（创建赛事 + 赛事管理 + 暂停/提取）
├── components/
│   ├── layout/
│   │   ├── LayoutClient.tsx    #   Provider 链（LangProvider → ClientProviders → RefreshContext）
│   │   ├── LayoutInner.tsx     #   页面布局（Navbar + 内容 + Footer + 背景）
│   │   └── Navbar.tsx          #   导航栏（桌面横排 + 手机底部 Tab Bar）
│   ├── home/
│   │   └── WelcomeBanner.tsx   #   新用户引导横幅
│   ├── match/
│   │   ├── MatchCard.tsx       #   赛事卡片（首页 / 列表 / 我的竞猜通用）
│   │   ├── BettingPanel.tsx    #   投注面板（选项选择 + 金额输入 + 确认弹窗）
│   │   ├── PoolChart.tsx       #   奖池分布比例条
│   │   ├── ClaimPanel.tsx      #   领奖面板
│   │   └── ConfirmDialog.tsx   #   确认弹窗
│   └── shared/
│       ├── Skeleton.tsx        #   骨架屏组件
│       ├── TeamNameDisplay.tsx #   队名显示（含国旗）
│       ├── MatchStatusBadge.tsx#   状态徽章
│       ├── AmountDisplay.tsx   #   金额格式化显示
│       └── Skeleton.tsx        #   骨架屏组件
├── hooks/
│   ├── useMatches.ts           #   赛事数据 hooks（useAllMatches / useMatch）
│   ├── useUserBets.ts          #   用户投注 hooks（useUserAllBets / usePreviewReward）
│   ├── useClaimReward.ts       #   领奖 hook
│   ├── useLeaderboard.ts       #   排行榜 hook（链上事件聚合）
│   ├── useIsAdmin.ts           #   管理员检测 hook
│   ├── useMounted.ts           #   客户端挂载检测
│   ├── useParticipantCounts.ts #   投注人数统计
│   ├── useWaitForTx.ts         #   交易确认等待 hook
│   ├── useWriteContract.ts     #   写入合约 hook
│   └── useReadContract.ts      #   查询合约 hook
├── lib/
│   ├── i18n.tsx                #   国际化（中英文切换，~200 条翻译）
│   ├── config.ts               #   部署配置（合约地址 / USDT 地址 / RPC）
│   ├── constants.ts            #   枚举与常量（MatchStatus / Result）
│   ├── types.ts                #   TypeScript 类型定义
│   ├── utils.ts                #   工具函数（formatUSDT / formatTime / calcOdds）
│   ├── nameMap.ts              #   队名中英映射表
│   ├── abi/
│   │   ├── FootballBetting.json
│   │   └── MockERC20.json
│   └── deployments/
│       └── confluxTestnet.json #   合约地址配置
```

## 页面路由树

```
/                    首页（统计 + 热门 + 即将开赛 + 新用户引导）
/matches             赛事列表（筛选 + 排序 + 分页）
/matches/[id]        赛事详情（投注面板 + 奖池 + 领奖面板）
/my-bets             我的竞猜（投注历史 + 盈亏统计）
/leaderboard         排行榜（盈亏排名 + 分页）
/admin               管理后台（赛事管理 + 暂停/提取）
```

## Provider 链（从外到内）

```
LangProvider          ← 国际化上下文
ClientProviders       ← RainbowKit + Wagmi + TanStack Query
TxToastProvider       ← 交易通知 Toast
RefreshContext        ← 跨组件 UI 刷新触发器
LayoutInner           ← Navbar + PageTransition + Footer
```

## 数据流

### 赛事数据

```
合约 getAllMatches()
  → useAllMatches() (wagmi readContract)
  → TanStack Query 缓存（staleTime: 30s）
  → 各页面通过 queryClient.invalidateQueries 在交易确认后刷新
```

### 投注流程

```
用户点击投注
  → BettingPanel 检查 USDT Allowance
  → 不足 → approve USDT（等待确认）
  → 足够 → placeBet(matchId, betOn, amount)（等待确认）
  → useWaitForTxAndRefresh 等待交易收据
  → invalidateQueries 刷新赛事 + 用户数据
  → Toast 通知
```

### 领奖流程

```
ClaimButton / ClaimPanel
  → claimReward(matchId)
  → useWaitForTxAndRefresh 等待确认
  → invalidateQueries 刷新数据
  → Toast 通知
```

### 排行榜数据

```
useLeaderboard()
  → 扫描链上 BetPlaced + RewardClaimed 事件
  → 前端聚合 per-address 盈亏
  → 按 profit 降序 + 胜率降序排序
  → 排除在 TanStack Query invalidation 之外（手动刷新）
```

## 响应式设计

| 断点 | 策略 |
|---|---|
| `< sm (640px)` | 底部 Tab Bar + 卡片列表 + 紧凑排版 |
| `sm - lg (640-1024px)` | 顶部导航 + 表格 + 2 列卡片 |
| `> lg (1024px)` | 最大宽度 6xl + 3 列卡片 |

## 关键设计决策

1. **零依赖 i18n**：自建 `useT()` Context，不引入第三方库
2. **RainbowKit 直连**：不支持 WalletConnect（稳定性问题），只在 injected 模式下使用
3. **key-based remount**：`BettingPanel` / `ClaimPanel` 使用 `key={address}` 确保切换账户时状态重置
4. **排行榜手动刷新**：不从 TanStack Query 自动刷新，避免每次交易都重扫全量事件
