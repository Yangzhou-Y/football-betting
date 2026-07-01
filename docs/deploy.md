# 部署流程

## 前置条件

- Node.js 18+
- npm 9+
- 钱包私钥（Conflux eSpace 测试网有 CFX 余额）

## 本地开发

### 1. 安装依赖

```bash
npm install
cd frontend && npm install --legacy-peer-deps && cd ..
```

### 2. 编译合约

```bash
npm run compile
```

### 3. 运行测试

```bash
npm run test
```

### 4. 启动本地链

```bash
# 终端 A — 启动 Hardhat 本地节点
npm run node
```

### 5. 部署到本地链

```bash
# 终端 B — 部署合约
npm run deploy

# 创建 10 场测试比赛
npm run interact
```

### 6. 启动前端

```bash
cd frontend
npm run dev
```

## 部署到 Conflux eSpace 测试网

### 1. 配置环境变量

创建 `.env` 文件：

```bash
PRIVATE_KEY=0x你的私钥
CONFLUX_TESTNET_RPC_URL=https://evmtestnet.confluxrpc.com
USDT_ADDRESS=0x7d682e65efc5c13bf4e394b8f376c48e6bae0355
```

### 2. 部署合约

```bash
npx hardhat run scripts/deploy.ts --network confluxTestnet
```

部署完成后合约地址自动写入：

```
frontend/src/lib/deployments/confluxTestnet.json
```

### 3. 验证部署

```bash
# 检查链上状态
npx hardhat run scripts/check.ts --network confluxTestnet
```

### 4. 创建赛事

```bash
npm run interact
```

### 5. 部署前端

前端托管在 **Vercel**，与 GitHub 深度集成。每次 `main` 分支有推送，Vercel 自动拉取、构建、上线。

修改前端代码后：

```bash
git add .
git commit -m "feat: your change"
git push
# ✅ 自动部署到 https://football-betting-mu.vercel.app
```

## 脚本说明

| 脚本 | 用途 |
|---|---|
| `scripts/deploy.ts` | 部署 FootballBetting 合约（无现有 USDT 时自动部署 MockERC20） |
| `scripts/interact.ts` | 批量创建 10 场测试比赛 |
| `scripts/admin.ts` | 管理员增删查 |
| `scripts/check.ts` | 链上状态检查 |
| `scripts/diag.ts` | 诊断脚本（时间校准 / 状态排查） |
| `scripts/fix-time.ts` | Hardhat EVM 时间修复 |
| `scripts/test-bet.ts` | 测试投注流程 |
| `scripts/test-create.ts` | 测试创建赛事 |
| `scripts/shared/usdt.ts` | USDT 小数位数统一配置 |

## 网络配置

### Conflux eSpace 测试网

| 配置项 | 值 |
|---|---|
| Chain ID | 71 |
| RPC URL | `https://evmtestnet.confluxrpc.com` |
| 水龙头 | https://efaucet.confluxnetwork.org |
| 区块链浏览器 | https://evmtestnet.confluxscan.io |
| Faucet USDT | `0x7d682e65efc5c13bf4e394b8f376c48e6bae0355` |

### Hardhat 本地链

| 配置项 | 值 |
|---|---|
| Chain ID | 31337 |
| RPC URL | `http://localhost:8545` |
| 默认账户 | 20 个 Hardhat 测试账户，每个有 10,000 ETH |

## Vercel 自动部署流程

```
GitHub main 分支 push
  → Vercel 检测变更
  → git clone 仓库
  → cd frontend && npm install --legacy-peer-deps
  → npm run build (next build)
  → 静态资源部署到 CDN
  → 域名生效: football-betting-mu.vercel.app
```

部署记录可在 [Vercel Dashboard](https://vercel.com) 中查看。

## 合约升级注意事项

- 合约不可升级（非代理模式），新部署意味着新合约地址
- 新合约地址需要更新 `frontend/src/lib/deployments/confluxTestnet.json`
- 旧合约和前端仍然可用，只是指向不同的合约实例
- 考虑在前端增加合约版本标识，避免用户混淆
