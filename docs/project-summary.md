# 项目实践总结 — FootballBetting DApp

> 项目周期：2026-06-23 ～ 2026-07-01 | 145 次提交 | 10 个分支 | 65 个合约测试用例

## 一、项目概述

**FootballBetting** 是一个基于区块链的去中心化足球竞猜平台。用户使用 USDT 投注世界杯赛事，智能合约自动按 Parimutuel（同注分彩）算法分配奖池。合约部署在 Conflux eSpace 测试网，前端托管于 Vercel，支持中英双语、桌面和移动端。

**核心用户价值**：链上透明 — 所有投注和奖池数据公开在区块链上，规则由智能合约执行，用户不需要信任任何中心化平台。

在线访问：[football-betting-mu.vercel.app](https://football-betting-mu.vercel.app/)

## 二、技术栈

| 层级 | 技术 | 选型理由 |
|------|------|------|
| 智能合约 | Solidity 0.8.21 + Hardhat | 行业标准工具链，完善的测试和部署支持 |
| 支付代币 | USDT (ERC-20) | 世界杯场景下用户群体广泛，USDT 法币锚定降低认知门槛 |
| 前端框架 | Next.js 16 + React 19 + TypeScript | App Router 服务端渲染，Vercel 原生支持 |
| 钱包连接 | wagmi v2 + RainbowKit v2 + viem | 开箱即用的多钱包支持，维护了 MetaMask 专用检测逻辑 |
| 样式 | Tailwind CSS v4 | 原子化 CSS，响应式开发效率极高 |
| 数据缓存 | TanStack Query v5 | 声明式数据管理，自动处理缓存和重取 |

## 三、项目规模

| 指标 | 数值 |
|------|------|
| 合约代码 | 996 行 Solidity（8 个文件） |
| 合约测试 | 873 行 TypeScript（65 个测试用例，11 个模块） |
| 前端代码 | ~5,500 行 TypeScript/TSX（页面、组件、Hooks、工具库） |
| 脚本 | 7 个部署/诊断/管理脚本 |
| 总提交 | 145 次 |
| 分支 | 10 个（含 feature 分支和 Code Review 分支） |
| 文档 | 5 份合约/前端/部署文档 + 5 份开发日志 |

## 四、关键技术决策

### 4.1 为什么用 USDT 而不是原生币？

最初考虑直接收 ETH/CFX 作为投注代币（简单，一行 `msg.value` 搞定），但两个因素促成了 USDT 方案：

- **用户认知**：普通球迷对"0.001 ETH"没有概念，但知道"10 USDT = 10 美元"。降低参与门槛比省一行代码更重要。
- **波动风险**：比赛周期可能长达数周，原生币价格波动会导致奖池实际购买力剧烈变化，USDT 的锚定特性更稳定。

代价：USDT 需要用户先 `approve` 再 `transferFrom`，比原生币多一步交互和多约 3 万 gas。

### 4.2 为什么用 Conflux eSpace 测试网？

三个原因选了 Conflux 而非以太坊 Sepolia：

- **Gas 成本**：Sepolia ETH 虽免费但限量难领，Conflux 测试网水龙头充足
- **出块速度**：Conflux 约 1 秒出块，测试反馈快
- **EVM 兼容**：与以太坊完全兼容，合约代码和工具链零修改

### 4.3 合约 Gas 优化：三轮迭代

合约从最初的字符串队名 + uint256 全字段版本，经过三轮优化，主要函数 Gas 降低 26-41%：

| 优化手段 | 节省幅度 | 原理 |
|------|------|------|
| 结构体紧凑排列 | ~40-50% | 小字段合并在同一 32 字节存储槽 |
| uint128 代 uint256（金额） | ~30% | 两字段挤 1 槽 |
| string → bytes32（队名） | ~15% | 免动态存储开销 |
| uint64/uint48（时间戳） | ~15% | 多字段共槽 |
| 自定义错误替代 require 字符串 | 5-10%（部署） | 4 字节 selector vs 完整字符串 |

总计：`Match` 结构体从 12-14 槽压缩到 7 槽，`Bet` 结构体从 5 槽压缩到 2 槽。

### 4.4 合约拆分：从 879 行到 8 个文件

原 `FootballBetting.sol` 承载了全部逻辑，PRD 发起人建议拆分。采用**抽象合约 + 多重继承**模式拆为 8 个文件：

```
IERC20.sol                        # ERC-20 接口
FootballBettingTypes.sol          # 枚举 + 结构体 + 事件 + 错误
FootballBettingBase.sol           # 状态 + 构造器 + 修饰器 + helper
FootballBettingAdmin.sol          # 赛事管理
FootballBettingBet.sol            # 投注逻辑
FootballBettingSettle.sol         # 结算领奖
FootballBettingQuery.sol          # 查询函数
FootballBetting.sol               # 聚合（~55 行）
```

关键设计约束：**ABI 完全不变** — 所有 public/external 函数签名、事件、状态变量布局与拆分前一致，前端和 65 个测试用例零修改。

### 4.5 移动端深度适配

DApp 的固有痛点是对移动端极不友好（必须装浏览器拓展）。本项目做了三层适配：

1. **MetaMask App 内置浏览器**：在 MetaMask App 中打开 DApp 即可完成全流程
2. **底部 Tab Bar**：移动端用固定底部标签栏替代桌面端横排导航
3. **WalletConnect 探索**（`fix/mobile-WalletConnect` 分支）：实现任意浏览器扫码连接钱包，但因 MetaMask WC 仍处于实验阶段暂时搁置

### 4.6 前端性能优化：事件缓存

链上事件扫描（排行榜、参与人数统计）每次需要遍历全部历史区块，Conflux RPC 的 `eth_getLogs` 在 1000+ 区块范围时耗时显著。解决方案：

- 增量扫描：记录 `lastScannedBlock`，只拉取新区块
- localStorage 缓存：5 分钟 TTL，避免重复扫描
- BigInt 序列化：自定义 `replacer/reviver` 处理 `bigint` → JSON 转换（经典 Web3 前端陷阱）

## 五、踩过的坑

### 5.1 BigInt 序列化

`JSON.stringify` 不支持 `bigint`，而合约返回的所有数值字段（奖池、金额、时间戳）都是 `bigint`。任何涉及 `localStorage` 的缓存方案都必须自定义序列化器。这是 Web3 前端的经典问题，值得在项目早期就建立统一的序列化工具函数。

### 5.2 bytes32 编码的"透明性"陷阱

合约返回的 `homeTeam` 是 bytes32 hex（如 `0xE5B7B4E8A5BF...`），TypeScript 类型只是 `string`，IDE 不会提示。组件内通过 `TeamNameDisplay` 自动解码展示，但筛选逻辑直接使用原始 hex 值做字符串匹配时静默失败。教训：凡是合约返回的 bytes32 字段，在业务逻辑中使用前必须显式调用 `decodeTeamName()`。

### 5.3 CSS 包含块与 fixed 定位

移动端底部 Tab Bar 使用 `fixed bottom-0` 定位，但它嵌套在 `<nav className="sticky top-0">` 内部。`sticky` 在部分浏览器中创建了新的 CSS 包含块，导致 `fixed` 元素被"困"在 nav 内而非定位到视口底部。修复方式是将 fixed 元素移出 sticky 容器，直接用 Fragment 包裹。

### 5.4 Vercel 只监听 main 分支

`fix/contracts-dividing` 分支上的部署地址更新没有触发 Vercel 自动部署，因为它只监听 `main` 分支。合并后才会自动上线。这意味着非 main 分支的部署测试需要通过本地 `npm run dev` 验证。

### 5.5 合约拆分后的部署地址同步

拆分后的合约部署到新地址后，需要同步更新 3 处引用：`deployments/` 目录（部署记录）、`frontend/src/lib/deployments/` 目录（前端配置）、README 文档。漏掉任何一处都会导致不一致。部署脚本已自动同步前两处，第三处需手动更新。

## 六、AI 协作经验

本项目全程使用 Claude Code（CLI + VSCode 扩展）辅助开发，积累了一些 AI 协作心得：

1. **合约拆分让 AI 做最合适**：将 879 行合约拆分为 8 个文件的工作，手工做需要仔细复制粘贴和验证编译，AI 在 10 分钟内完成并确保 65 个测试全部通过。关键在于提前说明了"ABI 不变"的约束。

2. **视觉设计给 AI 明确的产品约束**：背景草坪主题的 6 层 CSS gradient 叠加，如果只说"做个好看的背景"，结果会很泛。但如果约束为"零图片、零带宽、足球场主题、纯 CSS"，AI 就能在有限的方案空间内产生有创意的输出。

3. **开发日志的价值**：每天结束时让 AI 根据 git log 自动生成开发日志，格式固定、数据准确，人工只需修改 10% 的内容。一周下来有了完整的项目演进轨迹。

4. **Code Review 双模型策略**：用 Claude Opus 做 code review 发现逻辑错误，用 DeepSeek 做第二意见交叉验证。两个模型在同一个代码库上的发现存在互补。

## 七、待改进项

1. **合约升级机制**：当前合约不可升级，若业务逻辑需要改动，只能部署新合约并迁移数据
2. **钱包连接多样性**：目前仅正式支持 MetaMask injected，WalletConnect 体验待 MetaMask 转正后重新接入
3. **端到端测试覆盖**：缺少前端与合约交互的 E2E 测试，目前仅依赖合约单元测试 + 手动验证
4. **筛选逻辑复用**：日期/球队筛选在 matches、my-bets、admin 三个页面各自实现，可提取为通用 hook
5. **主网部署准备**：合约已在测试网验证，但主网部署需考虑审计、Gas 优化、多签名管理等
6. **链上数据迁移工具**：合约重新部署后，需手动重建测试数据，缺乏一键迁移脚本

## 八、相关文档

| 文档 | 路径 |
|------|------|
| 项目 README | `README.md` |
| 合约接口文档 | `docs/contracts.md` |
| 前端架构文档 | `docs/frontend.md` |
| 部署文档 | `docs/deploy.md` |
| BigInt 序列化 Bug 记录 | `docs/BUGFIX_BIGINT_SERIALIZATION.md` |
| RPC 性能优化记录 | `docs/RPC_PERFORMANCE_OPTIMIZATION.md` |
| 开发日志 | `docs/dev-logs/`（5 份，覆盖 6/16 ～ 7/01） |
