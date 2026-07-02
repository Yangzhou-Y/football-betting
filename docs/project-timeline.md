# 项目历程 — FootballBetting DApp

> 记录从立项到上线的关键节点和重要决策

---

## 基础知识学习

### 区块链
- 分为公链和联盟链，本质是一种去中心化的分布式账本技术，每个区块通过密码学方式（哈希值）链接到前一个区块，形成一条链。如果有人想篡改中间的某个区块，后面所有区块的链接都会断裂。数据一旦上链，被网络确认后，几乎无法被修改或删除。这不意味着绝对不可改，但改造成本极高，需要控制全网超过半数（51%）的计算能力。

### 去中心化
- 没有单一的中心服务器或管理机构。数据由全网节点共同维护，任何单点故障或恶意篡改都不会影响整体。同时也不依赖于某一主体，解决了信任问题。

### 智能合约
- 运行在区块链上的自动执行程序。它的核心逻辑可以概括为：当预设条件满足时，自动执行约定的操作，无需第三方介入。
- 智能合约不能主动"醒来"，必须由外部交易触发；它也不能自主发起 HTTP 请求，需要依赖预言机来获取链外数据（如天气、股价）。

### P2P
- P2P 是 Peer-to-Peer（点对点） 的缩写，指的是一种去中心化的网络架构，网络中的每个节点（Peer）地位对等，既可以提供服务，也可以消费服务。
- P2P 是区块链的底层基础设施——比特币和以太坊都运行在 P2P 网络上，每个全节点都是一个 Peer，负责转发交易、同步区块。但 P2P 本身是一个更广泛的概念，不限于区块链（eg迅雷下载：不是从服务器下载，用户发给用户，点对点传输数据）。

### LLM
- Large Language Model，即大语言模型，是指那些拥有海量参数、在海量文本数据上训练出来的、能够理解和生成人类语言的深度学习模型。
- GPT-4、Claude Code、Gemini、DeepSeek 等都是大模型

### Token
- Token 是模型处理文本的最小单位。一个 token 可以是一个词、一个词的一部分、或一个标点符号。比如 "blockchain" 可能是 2 个 token，"区块链" 可能是 3 个 token。模型的输入输出按 token 数量计费。
- OpenAI 的 Tokenizer 工具可用于计算 token：https://platform.openai.com/tokenizer

### Context
- 上下文，指模型在一次推理中能够看到的所有信息。通常包括：系统提示（System Prompt），即预先设定的角色描述和行为准则；对话历史；当前输入和额外注入的信息，比如检索到的文档内容等。

### Context Window
- 模型一次推理中能处理的最大 token 数量，它决定了模型能记住多长的对话历史或读懂多长的文档。在 Coding 时，这将直接决定一个模型处理项目的能力。
- 如果上下文很短，模型一次就无法处理太多文件；但如果上下文很长，例如 DeepSeek-V4-Pro 支持 1m 上下文窗口，也即百万 token 上下文输入，你就可以把整个项目发给他让它从整体角度出发处理问题。

### Prompt
- Prompt 就是你跟 AI 对话时输入的文本，它的质量直接决定了 AI 输出的质量。

### Prompt Engineering
- 提示词工程，这是目前一个很重要的技能——研究怎么写 prompt 能让 AI 给出最好的结果。常见技巧包括：
- Chain-of-Thought（思维链）：让模型一步步推理，而不是直接给答案。比如不写 "这道数学题答案是多少"，而是 "请逐步推理，最后给出答案"。
- Role Prompting（角色提示）："你是某领域的专家"——模型会根据角色定位调整回答的口吻和专业度。
- System Prompt（系统提示）：像 Claude 这样的模型有 system prompt 机制——你可以设定一段全局指令，它会影响模型在整个对话中的行为。比如我现在遵循的规则，很大程度上来自我的系统提示。

### AI Agent
- Agent（智能体、代理人），AI Agent 是指以大语言模型为大脑，能够自主感知环境、制定计划、调用工具、执行行动来完成复杂任务的 AI 系统。不再只是简单回答问题，而是能够真正做事情。
- Agent代表了大模型应用的下一个范式跃迁——从聊天工具进化为行动者。

### Agent Skills
- 智能体技能，是指 AI Agent 被赋予的特定领域的能力模块。每个 Skill 封装了完成某一类任务所需的知识、工具、流程和策略，让 Agent 可以像安装插件一样灵活地获取新能力。

### AI Coding Assistant
- AI 编程助手 是一个AI 协作者。它不取代编辑器，而是驻留在编辑器里面或旁边，帮你生成代码、解释代码、修改代码。
- 常见的有 Claude、Cursor、Codex、Github Copilot、ChatGPT 等。

### IDE
- Integrated Development Environment（集成开发环境），把程序员写代码需要的所有工具打包在一个软件里。可以把它理解成一个数字化的程序员工作台——所有工具都在手边，不用来回切换。

### Vibe Coding
- 由 AI 领域知名人物 Andrej Karpathy 在 2025 年初提出，描述一种完全依赖 AI 来写代码的编程方式。你对代码本身不需要完全理解，更多是在描述需求 → 看效果 → 提修改意见这样一个循环里。就像跟着音乐的节奏"摇摆"（vibe），所以叫 vibe coding。

### API
- Application Programming Interface（应用程序编程接口），就是两个软件之间约定好的沟通方式——一个程序怎么去调用另一个程序的功能或数据。

### API Key
- 调用 API 时的身份凭证和访问密钥——相当于你的"钥匙"或"通行证"。

---

## 项目确立

### 基于区块链智能合约的世界杯竞猜DApp

---

## 基础环境搭建

### 科学上网注册Github、Outlook、Teams
- 由同事提供的企业级 VPN 注册上述应用，为接下来的工作做准备。
- Github 账户名称：Yangzhou-Y 注册邮箱：3279458942@qq.com
- Outlook 企业邮箱：yangzhou.yu@confluxnetwork.org

### VScode + Github Copilot
- 加入企业组织 Conflux，并由管理员下发 Github Copilot 额度。
- 用 Github 账号登录 VScode 并下载 Copilot 插件，即可在 VScode 中使用可选的 Agent。

### VScode + Claude Code + DeepSeek-V4-Pro
- 为避免 token 不够用的情况，自主探索使用国产大模型的替代方案。
- 最终选择使用 VScode + Claude Code + DeepSeek-V4-Pro 的方案，配置参考视频：BV1rBRQBSEwB。选择原因：deepseek 百万上下文 + token 十分便宜，很适合当前项目定位。

### CC Switch
- CC Switch（全称 Claude Code Switch）是一款开源跨平台桌面应用，核心是统一管理并一键切换多款 AI 编程 CLI（如 Claude Code、Codex、Gemini CLI）的供应商配置、MCP、Skills 与提示词，彻底告别手动编辑 JSON/TOML/.env 配置文件。A cross-platform desktop All-in-One assistant for Claude Code, Codex, OpenCode, OpenClaw, Gemini CLI & Hermes Agent。
- Github 地址：https://github.com/farion1231/cc-switch 官网链接：[ccswitch.io](https://ccswitch.io/)
- 本项目正是使用此工具，将从 deepseek 拿到的 API Key 给到 ccswitch 自动配置，以实现在 vscode 的 Claude Code 插件中使用 deepseek 模型。

### Claude Desktop、Codex、Cursor
- Claude Desktop：将在后面探索，如今已安装到本地且可以正常使用，功能比插件版更强大。
- Codex：很多人推荐，但注册账户需要外国手机号，暂时解决不了。
- Cursor：老牌应用，推荐指数较低，下载后在注册时未能成功，遂暂时搁置。

---

## 后端合约开发 + 部署本地链

### 编写 Solidity 合约
- Solidity 是专门用来写以太坊及兼容公链智能合约的编程语言，语法类似 JavaScript/C++。
- Solidity 合约：用 Solidity 编写、部署在区块链上的自动执行代码，跑在全网节点，去中心化，永久运行。
- 本项目所有链上逻辑都写在合约 [text](../contracts/FootballBetting.sol) 中。

---

## 结合 PRD 修改后端并做 Code Review

### 科学上网注册Github、Outlook、Teams
- 由同事提供的企业级 VPN 注册上述应用，为接下来的工作做准备。
- Github 账户名称：Yangzhou-Y 注册邮箱：3279458942@qq.com
- Outlook 企业邮箱：yangzhou.yu@confluxnetwork.org

---

## 关键决策一览

| 日期 | 决策 | 原因 | 结果 |
|------|------|------|------|
| | | | |
| | | | |
| | | | |

---

## 数字说话

| 指标 | 数值 |
|------|------|
| 从零到上线 | |
| 总提交数 | |
| 合约部署成本 | |
| 测试用例数 | |
| 支持语言 | |
| 支持设备 | |

---

## 相关文档

| 文档 | 路径 |
|------|------|
| 项目 README | `README.md` |
| 合约接口文档 | `docs/contracts.md` |
| 前端架构文档 | `docs/frontend.md` |
| 部署文档 | `docs/deploy.md` |
| 项目实践总结 | `docs/project-summary.md` |
| 开发日志 | `docs/dev-logs/` |

---

## 鸣谢

- 角色 / 工具 — 贡献说明
