/**
 * ============================================================================
 * Hardhat 配置文件 — 编译、网络、测试等全局设置
 * ============================================================================
 *
 * 【什么是 Hardhat？】
 * Hardhat 是以太坊智能合约开发框架，提供：
 *   - 合约编译（Solc 编译器集成）
 *   - 本地节点（内置 Hardhat Network，模拟真实以太坊环境）
 *   - 测试框架（集成 Mocha + Chai + ethers.js）
 *   - 部署脚本（TypeScript 编写，支持多网络）
 *   - 调试工具（console.log 在 Solidity 中输出、堆栈追踪）
 *
 * 【配置文件做什么？】
 * 本文件被 Hardhat CLI 在每次运行时加载，控制：
 *   - 使用什么 Solidity 编译器版本
 *   - 是否开启代码优化器
 *   - 连接哪些区块链网络（本地 / 测试网 / 主网）
 *   - 测试超时时间等
 *
 * 【网络配置安全提醒】
 * - 私钥绝不能硬编码在配置文件中！
 * - 私钥来自 .env 文件（已在 .gitignore 中被排除出版本控制）
 * - 本地链（hardhat / localhost）不需要真实私钥，用自动生成的测试账户
 */

// HardhatUserConfig：TypeScript 类型定义，让 IDE 有自动补全
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-verify";

// @nomicfoundation/hardhat-toolbox：Hardhat 官方插件集合包
// 内部打包了 ethers、chai、typechain、hardhat-network-helpers 等
import "@nomicfoundation/hardhat-toolbox";

// hardhat-gas-reporter：测试时显示每个函数的 Gas 消耗详情
// 启用方式：npx hardhat test（配合下方 gasReporter 配置）
import "hardhat-gas-reporter";

// dotenv：从 .env 文件读取环境变量到 process.env
// .env 文件存放私钥、RPC URL 等敏感信息，不入 Git
import * as dotenv from "dotenv";

// dotenv.config()：执行后 process.env.XXX 就能读到 .env 里定义的值
dotenv.config();

const config: HardhatUserConfig = {
  // ======================================================================
  // Solidity 编译器配置
  // ======================================================================
  solidity: {
    // version：指定编译器版本
    // 0.8.21 兼容 0.8.x 系列，默认开启整数溢出检查
    version: "0.8.21",
    settings: {
      // optimizer（优化器）：压缩合约字节码大小，降低部署 Gas 成本
      // enabled: true → 开启优化
      // runs: 200 → 优化参数，200 是"期望合约被调用约 200 次"的平衡值
      //   runs 越小 → 优先减小部署成本（字节码更短）
      //   runs 越大 → 优先减小执行成本（运行时 Gas 更低）
      optimizer: {
        enabled: true,
        // runs: 1 优先减小部署成本（字节码更短），降低 Conflux eSpace 部署时栈溢出风险
        runs: 1
      },

      // viaIR（Intermediate Representation 编译管线）：
      // 启用 IR-based 编译器后端，可解决"Stack too deep"错误
      viaIR: true
    }
  },

  // ======================================================================
  // 网络配置
  // ======================================================================
  // networks 对象定义合约可部署到的区块链网络
  // 每个网络有唯一的 chainId（链 ID），用于区分不同以太坊网络
  //
  // 常用 chainId：
  //   1          — 以太坊主网（Mainnet）
  //   1030       — Conflux eSpace 主网
  //   71         — Conflux eSpace 测试网
  //   11155111   — Sepolia 测试网（以太坊）
  //   31337      — Hardhat 内置网络 / localhost
  //   137        — Polygon 主网
  //   56         — BSC 主网
  // ======================================================================
  networks: {
    /**
     * hardhat 内置网络（默认）
     * - `npx hardhat test` 自动使用此网络
     * - `npx hardhat run <script>` 不指定 --network 时默认使用此网络
     * - 启动时临时创建，脚本结束后销毁（生命周期自动管理）
     * - 带 20 个预设测试账户，每个 10000 ETH
     * - 无 RPC 端口（不对外暴露），只能在本进程内访问
     * - 支持 console.log（Solidity 合约中直接打印，其他网络不支持）
     */
    hardhat: {
      chainId: 31337
    },

    /**
     * localhost 网络（独立运行的本地节点）
     * - 需要先在另一个终端运行 `npm run node`（即 `npx hardhat node`）
     * - 节点持续运行，监听 127.0.0.1:8545 端口
     * - 跨脚本复用：部署后，其他脚本可以连上同一个合约实例
     * - 用途：前后端联调时前端连上本地链，或多次运行脚本共享链状态
     * - 同样有 20 个预设测试账户
     */
    localhost: {
      url: "http://127.0.0.1:8545",  // 本地节点的 JSON-RPC 端点
      chainId: 31337
    },

    /**
     * Sepolia 测试网（以太坊官方测试网）
     * - 使用真实的 PoS 共识机制
     * - 测试 ETH 免费（从水龙头 faucet 领取）
     * - 部署和交易需要真实 Gas（用测试 ETH 支付）
     * - 用途：主网上线前的最终验证环境
     *
     * 配置说明：
     *   url：RPC（Remote Procedure Call）节点地址
     *     推荐使用 Infura / Alchemy 的免费 RPC 服务
     *     SEPOLIA_RPC_URL 在 .env 文件中定义，格式如：
     *     https://sepolia.infura.io/v3/你的API_KEY
     *
     *   accounts：部署/交互使用的账户私钥数组
     *     PRIVATE_KEY 在 .env 文件中定义，格式如：
     *     0xabcd1234...（64 位十六进制数）
     *     本地测试不需要设置
     */
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 11155111
    },

    /**
     * 以太坊主网（Mainnet）
     * - 真实 ETH，真实经济价值
     * - 部署合约需要消耗真实 ETH（几百到几千美元不等）
     * - 测试网（Sepolia）通过后才部署到主网
     * - 每次操作都要谨慎：交易不可撤销！
     *
     * 安全提醒：
     *   1. 先在 Sepolia 测试网验证所有功能
     *   2. 合约代码经过专业审计（audit）
     *   3. 私钥使用硬件钱包（Ledger/Trezor）管理
     *   4. 小金额先试跑，确认无误再扩大
     */
    mainnet: {
      url: process.env.MAINNET_RPC_URL || "",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 1
    },

    /**
     * Conflux eSpace 测试网
     * - 树图（Conflux）EVM 兼容空间测试网，chainId=71
     * - 使用测试 CFX 付 Gas 费，USDT 为投注币种
     * - RPC: https://evmtestnet.confluxrpc.com
     * - 水龙头: https://efaucet.confluxnetwork.org
     */
    confluxTestnet: {
      url: process.env.CONFLUX_TESTNET_RPC_URL || "https://evmtestnet.confluxrpc.com",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 71
    },

    /**
     * Conflux eSpace 主网
     * - 树图（Conflux）EVM 兼容空间主网，chainId=1030
     * - 使用真实 CFX 付 Gas 费，USDT 为投注币种
     * - RPC: https://evm.confluxrpc.com
     *
     * 部署前准备：
     *   1. 在 .env 设置 CONFLUX_MAINNET_RPC_URL 和 PRIVATE_KEY
     *   2. 设置 USDT_ADDRESS（Conflux eSpace 上 USDT 的合约地址）
     *   3. 确保钱包里有足够 CFX 付 Gas
     *   4. 先在 confluxTestnet 验证所有功能
     */
    confluxMainnet: {
      url: process.env.CONFLUX_MAINNET_RPC_URL || "https://evm.confluxrpc.com",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 1030
    }
  },

  // ==========================================================================
  // 合约验证（hardhat-verify）
  // ==========================================================================
  etherscan: {
    apiKey: {
      confluxTestnet: "unused",
      confluxMainnet: "unused",
    },
    customChains: [
      {
        network: "confluxTestnet",
        chainId: 71,
        urls: {
          apiURL: "https://api-evmtestnet.confluxscan.io/api",
          browserURL: "https://evmtestnet.confluxscan.io",
        },
      },
      {
        network: "confluxMainnet",
        chainId: 1030,
        urls: {
          apiURL: "https://api.confluxscan.io/api",
          browserURL: "https://confluxscan.io",
        },
      },
    ],
  },

  // ==========================================================================
  // Gas 消耗报告器（hardhat-gas-reporter）
  // ==========================================================================
  //
  // 每次 `npm run test` 结束后，在终端打印一个表格，列出每个函数的 Gas 消耗详情。
  //
  // ┌───────── 表格字段中文对照 ───────────────────────────────────────┐
  // │                                                                 │
  // │  【Methods 表格 — 每个公开函数的 Gas 消耗】                        │
  // │                                                                 │
  // │  Contracts / Methods      合约名 / 函数签名                        │
  // │  Min                      该函数在所有测试中单次调用的最小 Gas      │
  // │  Max                      该函数在所有测试中单次调用的最大 Gas      │
  // │  Avg                      该函数在所有测试中的平均 Gas 消耗         │
  // │  # calls                  该函数在测试中被调用的总次数              │
  // │  eth (avg)                平均每次调用的 ETH 成本（= Avg × GasPrice）│
  // │                                                                 │
  // │  【Deployments 表格 — 合约部署的 Gas 消耗】                        │
  // │                                                                 │
  // │  % of limit               部署消耗占区块 Gas 上限的比例              │
  // │                           以太坊主网区块限制 ≈ 30M gas             │
  // │                                                                 │
  // │  【为什么关注 Gas？】                                              │
  // │  Gas 越低 → 用户手续费越少 → 合约更有竞争力                         │
  // │  createMatch（约 169k）是最贵的操作（写入大量字符串到链上）           │
  // │  view 函数（如 getMatch）不在此表出现，因为外部调用不消耗 Gas         │
  // │                                                                 │
  // │  【颜色说明】                                                      │
  // │  绿色 = 低消耗   黄色 = 中等    红色 = 高消耗（需关注优化）            │
  // └─────────────────────────────────────────────────────────────────┘
  gasReporter: {
    enabled: true,                     // 启用报告（设为 false 可临时关闭）
    currency: "ETH",                   // 货币单位（影响 eth(avg) 列的显示）
    gasPrice: 20,                      // 假设的 Gas 单价（gwei），仅影响成本估算列
    showMethodSig: true,               // 显示完整函数签名（参数类型可见）
    coinmarketcap: undefined,          // CoinMarketCap API Key，填入后显示实时法币成本
    outputFile: undefined,             // 如需保存报告到文件，填写路径如 "gas-report.md"
    noColors: false,                   // 保留终端颜色高亮（绿/黄/红）
    showUncalledMethods: false         // false=仅显示被测试调用的方法  true=显示所有方法
  },

  // ======================================================================
  // 测试配置
  // ======================================================================
  // Hardhat 测试基于 Mocha（测试框架）+ Chai（断言库）
  mocha: {
    // timeout：单个测试用例的最长执行时间（毫秒）
    // 区块链交易有时需要等待区块确认，默认 20000ms 可能不够
    // 设为 60000ms（1 分钟）留足余量
    timeout: 60000,

    // reporter：测试输出格式
    // "spec" = 层级缩进展示（默认，清晰易读）
    // "min"  = 极简输出
    // "dot"  = 每个用例一个点
    reporter: "spec"
  }
};

export default config;
