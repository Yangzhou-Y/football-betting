# FootballBetting — 基于区块链的足球竞猜 DApp

使用 Solidity 智能合约实现的世界杯足球竞猜系统。用户使用 ETH 对比赛结果（胜/平/负）进行预测，猜对者按比例瓜分奖池。

## 项目结构

```
football-betting/
├── contracts/
│   └── FootballBetting.sol    # 智能合约（Solidity）
├── scripts/
│   ├── deploy.ts              # 部署脚本（自动保存地址到 deployments/）
│   └── interact.ts            # 交互演示脚本（自动读取部署地址）
├── test/
│   └── FootballBetting.test.ts # 48 个测试用例
├── deployments/               # 部署记录（自动生成，提交到 git）
├── hardhat.config.ts          # Hardhat 配置
├── package.json               # 依赖 + npm 快捷命令
└── .env.example               # 环境变量模板
```

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 编译合约（生成 typechain-types）
npm run compile

# 3. 跑测试（48 个用例，含 Gas 消耗报告）
npm run test

# 4. 启动本地链（终端 A — 保持运行）
npm run node

# 5. 部署合约到本地链（终端 B）
npm run deploy

# 6. 运行交互演示（终端 B）
npm run interact
```

## npm 命令

| 命令 | 说明 |
|---|---|
| `npm run compile` | 编译 Solidity 合约 + 生成 TypeScript 类型 |
| `npm run test` | 运行全部测试 + Gas 消耗报告 |
| `npm run test:gas` | 同上（显式启用 Gas 报告） |
| `npm run test:trace` | 运行测试 + 出错时显示 Solidity 调用栈 |
| `npm run node` | 启动 Hardhat 本地链（监听 127.0.0.1:8545） |
| `npm run deploy` | 部署到本地链 |
| `npm run interact` | 交互演示（创建→投注→结算→领奖 完整流程） |
| `npm run clean` | 清理编译产物 |
| `npm run compile:force` | 强制重新编译 |

## 部署到 Sepolia 测试网

### 1. 获取资源

| 需要什么 | 去哪里获取 |
|---|---|
| Sepolia RPC URL | [infura.io](https://infura.io) 或 [alchemy.com](https://alchemy.com) 免费注册 |
| 测试 ETH | [sepoliafaucet.com](https://sepoliafaucet.com) 或 Google "Sepolia faucet" |
| 私钥 | MetaMask 钱包 → 账户详情 → 导出私钥 |

### 2. 配置 .env

```bash
# 复制模板
cp .env.example .env

# 编辑 .env 填入真实值
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/你的KEY
PRIVATE_KEY=0x你的私钥（注意：绝对不能上传到 GitHub！）
```

### 3. 部署

```bash
npx hardhat run scripts/deploy.ts --network sepolia
```

部署成功后合约地址会保存到 `deployments/sepolia.json`。

### 4. 验证

```bash
# 交互演示（自动读取 deployments/sepolia.json）
npx hardhat run scripts/interact.ts --network sepolia
```

## 部署到以太坊主网

> ⚠️ **主网使用真实 ETH，部署成本约几百~几千美元。务必先在 Sepolia 验证所有功能！**

```bash
# 编辑 .env 填入主网 RPC URL 和私钥
MAINNET_RPC_URL=https://mainnet.infura.io/v3/你的KEY
PRIVATE_KEY=0x你的私钥

# 部署
npx hardhat run scripts/deploy.ts --network mainnet
```

## 合约功能

| 功能 | 函数 | 调用者 |
|---|---|---|
| 创建赛事 | `createMatch(home, away, startTime, deadline, minBet, maxBet)` | 管理员 |
| 开放投注 | `openMatch(matchId)` | 管理员 |
| 关闭投注 | `closeMatch(matchId)` | 管理员 |
| 录入比分 | `recordResult(matchId, homeScore, awayScore)` | 管理员 |
| 投注 | `placeBet(matchId, result) + msg.value` | 任何人 |
| 领奖 | `claimReward(matchId)` | 任何人 |
| 提手续费 | `withdrawFee()` | 管理员 |
| 查看比赛 | `getMatch(matchId)` `getAllMatches()` | 任何人（免费） |
| 预览奖励 | `previewReward(matchId, user)` | 任何人（免费） |

## Gas 优化

合约经过三轮 Gas 优化，主要函数平均降低 26-41%：

| 函数 | 优化前 | 优化后 | 节省 |
|---|---|---|---|
| createMatch | 168,675 | 124,999 | -26% |
| placeBet | 140,710 | 96,752 | -31% |
| claimReward | 78,846 | 50,356 | -36% |
| openMatch | 47,134 | 28,013 | -41% |
| recordResult | 75,983 | 55,727 | -27% |
| 合约部署 | 2,059,329 | 1,869,435 | -9% |

优化手段：结构体紧凑排列、uint128/uint64 替代 uint256、string→bytes32、unchecked 算术、删除冗余零赋值。

## 技术栈

- **Solidity 0.8.21** — 智能合约语言
- **Hardhat** — 开发框架（编译、测试、部署、本地节点）
- **ethers.js v6** — 区块链交互库
- **TypeScript** — 脚本和测试
- **Mocha + Chai** — 测试框架
- **hardhat-gas-reporter** — Gas 消耗分析

## 安全

- `onlyOwner` 修饰器 — 管理员功能权限隔离
- `noReentrancy` 修饰器 — 防重入攻击（互斥锁模式）
- Checks-Effects-Interactions — 状态更新在外部转账之前
- Solidity 0.8.x 内置溢出检查
- `settled` 标记双重防结算
- 每用户每场限投一次

## 开发环境要求

- Node.js >= 18
- npm >= 9
- Git（可选）
