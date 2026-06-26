// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

/**
 * ============================================================================
 * @title MockERC20 — 测试用 ERC-20 代币
 *
 * @notice 模拟 Faucet USDT 的行为和精度（18 位小数），专供 Hardhat 测试使用。
 *         公开 mint 函数允许任何测试账户无限量获取代币。
 *
 * @dev    【这个合约永远不会部署到真实链上】
 *         只在 Hardhat Network / localhost 环境下由 deploy.ts 自动部署。
 *         真实链（Sepolia/Conflux 主网）使用官方已部署的 USDT 合约。
 *
 *         【为什么不用 .env 里的 USDT 地址做测试？】
 *         1. Hardhat 本地链没有真实的 USDT 合约，需要 mock
 *         2. 公开 mint 让测试脚本可以任意分发给测试账户
 *         3. 行为与 Faucet USDT 一致（18 位小数、transferFrom/approve 标准接口）
 *
 *         【为啥不 import OpenZeppelin 的 ERC20？】
 *         1. 测试专用合约不需要审计级别的安全实现
 *         2. 手写 ~50 行，编译快、依赖少
 *         3. 功能完全等价（transfer/transferFrom/approve/mint）
 *
 *         【当前 Faucet USDT 的精度（decimals=18）与其他常见代币对比】
 *         - Faucet USDT (Conflux 测试网): 18 位 — 1 USDT = 10^18
 *         - 真实 USDT / USDC:              6 位 — 1 USDT = 10^6
 *         - DAI / ETH / CFX:              18 位 — 1 = 10^18
 *         本合约用 18 位小数匹配 Conflux 测试网 Faucet USDT，确保与前端一致。
 * ============================================================================
 */
contract MockERC20 {
    string public name = "Mock USDT";
    string public symbol = "mUSDT";
    uint8 public decimals = 18;

    /// @dev 总发行量（mint 时累加）
    uint256 public totalSupply;

    /// @dev 账户余额映射（address → 持有量）
    mapping(address => uint256) public balanceOf;

    /// @dev 授权额度 — allowance[owner][spender]，spender 可从 owner 花费的上限
    mapping(address => mapping(address => uint256)) public allowance;

    /** 转账事件（from=address(0) 表示铸币） */
    event Transfer(address indexed from, address indexed to, uint256 value);
    /** 授权事件（前端监听以更新 approve 状态） */
    event Approval(address indexed owner, address indexed spender, uint256 value);

    /**
     * @notice 铸造测试代币（公开调用，仅测试用）
     * @dev    Hardhat 测试中任何人可调用 mint 给自己或其他账户，
     *         真实 USDT 合约中此函数不存在或仅 owner 可调用。
     * @param to     接收代币的地址
     * @param amount 铸造数量（最小单位，18 位小数）
     */
    function mint(address to, uint256 amount) external {
        totalSupply += amount;
        balanceOf[to] += amount;
        // from=address(0) 在 ERC-20 标准中表示"铸币"事件
        emit Transfer(address(0), to, amount);
    }

    /**
     * @notice 授权 spender 从 msg.sender 账户划转最多 amount 个代币
     * @dev    用户投注前调用此函数授权竞猜合约：
     *         mockUsdt.connect(user).approve(contractAddress, amount)
     *         竞猜合约的 placeBet 内部调用 transferFrom 时会检查并扣减此额度。
     *
     *         【安全警告】某些非标准 ERC-20（如以太坊上的 USDT）要求先清零再设新值，
     *         否则 approve 可能被 front-run。本 Mock 是标准实现，不需此操作。
     */
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    /**
     * @notice 从 msg.sender 转账 amount 给 to
     * @dev    本合约的 claimReward 和 withdrawFee 调用 usdt.transfer(...) 即触发此函数
     */
    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "ERC20: insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    /**
     * @notice 从 from 账户转账 amount 给 to（前提：from 已 approve 调用者）
     * @dev    本合约的 placeBet 调用 usdt.transferFrom(user, contract, amount) 即触发此函数。
     *
     *         【调用条件和顺序】
     *         ① 用户调用 mockUsdt.approve(contractAddress, 1000 USDT)
     *         ② allowance[user][contract] 被设为 1000 USDT
     *         ③ 合约 placeBet 内部调用 mockUsdt.transferFrom(user, contract, 100 USDT)
     *         ④ 检查 balanceOf[user] >= 100    ✓
     *         ⑤ 检查 allowance[user][contract] >= 100  ✓
     *         ⑥ allowance 减 100，balance 从 user 转给 contract
     *
     *         【Gas 说明】transferFrom 是一次外部合约调用（CALL opcode），
     *         额外消耗 ~30,000 gas（含 2,600 cold account access + 逻辑开销）。
     *         这是所有 ERC-20 投注函数 Gas 比原生币投注高的根本原因。
     */
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "ERC20: insufficient balance");
        require(allowance[from][msg.sender] >= amount, "ERC20: insufficient allowance");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }
}
