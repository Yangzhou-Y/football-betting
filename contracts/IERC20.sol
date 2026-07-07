// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

/**
 * @dev ERC-20 代币最小接口（内联定义，不依赖 OpenZeppelin）
 *
 *      【为什么不用 OpenZeppelin 的 IERC20？】
 *      1. 编译速度：不引入外部依赖包，编译更快
 *      2. 字节码体积：只编译用到的 3 个函数，字节码更短
 *      3. 部署成本：更少的元数据和 import 路径处理
 *
 *      【为什么只需要这三个函数？】
 *      - transferFrom：投注时从用户钱包拉取 USDT 到合约
 *      - transfer：领奖和提取手续费时从合约转出 USDT
 *      - balanceOf：前端查询合约/用户 USDT 余额（view 函数）
 *      - 不需要 approve：因为 approve 由用户直接调 USDT 合约，不经过本合约
 *      - 不需要 totalSupply/allowance 等：竞猜业务不关心
 *
 *      【ERC-20 安全提醒】
 *      - transferFrom 依赖用户先调用 USDT.approve(spender, amount)，否则会 revert
 *      - 部分非标准 USDT（如 USDT on Ethereum）transferFrom 不返回 bool，
 *        需使用 SafeERC20 库。但 Conflux eSpace 上的 USDT 是标准实现，安全。
 */
interface IERC20 {
    /// @notice 从 sender 转账 amount 到 recipient（需发送者预先 approve）
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    /// @notice 从调用者转账 amount 到 recipient
    function transfer(address recipient, uint256 amount) external returns (bool);
    /// @notice 查询账户的 USDT 余额
    function balanceOf(address account) external view returns (uint256);
}
