# FootballBetting — 链上足球竞猜 DApp

世界杯足球竞猜系统，使用 **USDT** 投注，Parimutuel 奖池分配。合约部署在 **Conflux eSpace 测试网**，前端托管于 **Vercel**。

## 在线访问

**[football-betting-mu.vercel.app](https://football-betting-mu.vercel.app/)**

## 项目结构

```
football-betting/
├── contracts/
│   ├── FootballBetting.sol      # 核心合约（USDT 支付 / 多管理员 / Gas 优化）
│   └── MockERC20.sol            # 本地测试用 ERC-20（18 位小数）
├── scripts/
│   ├── deploy.ts                # 部署脚本（自动部署 MockERC20 或读取 faucet USDT）
│   ├── interact.ts              # 批量创建 10 场比赛
│   ├── admin.ts                 # 管理员管理（添加/移除/查看）
│   ├── check.ts                 # 链上状态检查
│   └── test-bet.ts              # 测试投注脚本
├── test/
│   └── FootballBetting.test.ts  # 完整测试套件
├── frontend/                    # Next.js 前端
│   └── src/
│       ├── app/                 # 页面路由
│       │   ├── page.tsx         # 首页（热门赛事 / 即将开始）
│       │   ├── matches/         # 赛事列表 / 详情
│       │   ├── my-bets/         # 我的竞猜
│       │   ├── leaderboard/     # 排行榜
│       │   └── admin/           # 管理后台
│       ├── hooks/               # 自定义 Hooks（合约读写 / 投注 / 排行榜）
│       ├── lib/                 # 配置 / 类型 / i18n / ABI / 工具函数
│       └── components/          # UI 组件
├── deployments/                 # 硬帽部署记录（自动生成）
└── hardhat.config.ts            # Hardhat 配置
```

## 合约信息（Conflux eSpace 测试网）

| 项目 | 地址 |
|---|---|
| FootballBetting | `0x8A60409F40fEDFE7D07D61866757899F2fE35B63` |
| Faucet USDT | `0x7d682e65efc5c13bf4e394b8f376c48e6bae0355` |
| Chain ID | 71 |
| RPC | `https://evmtestnet.confluxrpc.com` |
| 水龙头 | [efaucet.confluxnetwork.org](https://efaucet.confluxnetwork.org) |
| 区块链浏览器 | [evmtestnet.confluxscan.io](https://evmtestnet.confluxscan.io) |

## 快速开始

```bash
# 安装依赖
npm install

# 编译合约
npm run compile

# 运行测试
npm run test

# 启动本地链（终端 A）
npm run node

# 部署到本地链（终端 B）
npm run deploy

# 创建比赛（终端 B）
npm run interact
```

### 前端开发

```bash
cd frontend
npm install --legacy-peer-deps
npm run dev
```

## 部署到 Conflux 测试网

```bash
# .env 配置
PRIVATE_KEY=0x你的私钥
CONFLUX_TESTNET_RPC_URL=https://evmtestnet.confluxrpc.com
USDT_ADDRESS=0x7d682e65efc5c13bf4e394b8f376c48e6bae0355

# 部署合约
npx hardhat run scripts/deploy.ts --network confluxTestnet

# 创建比赛
npx hardhat run scripts/interact.ts --network confluxTestnet
```

部署后合约地址会自动同步到 `frontend/src/lib/deployments/confluxTestnet.json`，Vercel 重新构建后前端自动指向新合约。

## 管理员操作

```bash
# 查看管理员
ADMIN_ACTION=list npx hardhat run scripts/admin.ts --network confluxTestnet

# 添加管理员
ADMIN_ACTION=add ADMIN_ADDRESS=0x... npx hardhat run scripts/admin.ts --network confluxTestnet

# 移除管理员
ADMIN_ACTION=remove ADMIN_ADDRESS=0x... npx hardhat run scripts/admin.ts --network confluxTestnet
```

部署时自动添加的管理员：
- `0x69a44E15f5718853e757866D000a98141D49da0D`
- `0x914fAfB682e62638351699fe1c228Bc6Fd2E516E`

## 合约功能

| 功能 | 函数 | 调用者 |
|---|---|---|
| 创建赛事 | `createMatch(name, home, away, start, deadline, minBet, maxBet, allowDraw)` | 管理员 |
| 开放投注 | `openMatch(matchId)` | 管理员 |
| 关闭投注 | `closeMatch(matchId)` | 管理员 |
| 自动封盘 | `autoClose(matchId)` | 任何人 |
| 删除赛事 | `deleteMatch(matchId)` | 管理员 |
| 录入比分 | `recordResult(matchId, homeScore, awayScore)` | 管理员 |
| 重新结算 | `reopenMatch(matchId)` | 管理员 |
| USDT 投注 | `placeBet(matchId, betOn, amount)` | 任何人 |
| 取消投注 | `cancelBet(matchId)` | 任何人 |
| 领取奖励 | `claimReward(matchId)` | 任何人 |
| 提取手续费 | `withdrawFee()` | 管理员 |
| 暂停/恢复 | `pause()` / `unpause()` | 管理员 |
| 管理员管理 | `addAdmin()` / `removeAdmin()` | Owner |

## Gas 优化（第四轮）

本轮优化引入 **36 个自定义错误** 替代 require 字符串、`_addToPool`/`_removeFromPool` 使用 `unchecked` 池子运算、修复 `placeBet` 切换选项时的双写 SSTORE。

| 优化 | 效果 |
|---|---|
| 自定义错误 | 部署 Gas -5~10%，每次 revert -200~300 gas |
| unchecked 池子运算 | 每次投注 -100~400 gas |
| 双写修复 | 切换投注选项时 -5000 gas |

历史优化：结构体紧凑排列（-40~50%）、uint128 替代 uint256（-30%）、bytes32 替代 string（-15%）、删除零赋值（-8%）。

## 技术栈

- **Solidity 0.8.21** + Hardhat — 智能合约
- **Next.js 15** + TypeScript — 前端
- **wagmi v3** + **RainbowKit** + **viem** — 钱包连接与合约交互
- **Tailwind CSS** — 样式
- **TanStack Query** — 数据缓存
- **ethers.js v6** — 脚本与测试

## 安全

- `onlyOwner` 修饰器 — 管理员 + 多管理员权限隔离
- `noReentrancy` 修饰器 — 重入保护
- `whenNotPaused` 修饰器 — 紧急暂停
- Checks-Effects-Interactions — 状态更新先于外部调用
- Solidity 0.8.x 内置溢出检查
- `settled` 标记防重复结算
- 自定义错误 — 精确匹配 revert 原因，前端友好提示
- 无 `receive()`/`fallback()` — 误发原生币自动 revert
