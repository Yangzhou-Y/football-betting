/**
 * ============================================================================
 * USDT 小数位数统一配置 — 整个项目的唯一真相来源
 * ============================================================================
 *
 * 【切换小数位的方法】
 * 若将来需要适配不同币种（如真实 USDT 的 6 位小数），只需修改此处的 DECIMALS
 * 常量即可。所有脚本、测试、前端（frontend/src/lib/constants.ts）均引用各自的
 * 中心常量，建议一并修改以下两处：
 *
 *   1. 本文件（scripts/shared/usdt.ts）          —— Hardhat 脚本 & 测试
 *   2. frontend/src/lib/constants.ts USDT_DECIMALS —— 前端
 *
 * 常用币种小数位速查：
 *   - Faucet USDT (Conflux 测试网): 18 位
 *   - 真实 USDT / USDC:             6 位
 *   - ETH / CFX (原生币):           18 位
 *   - DAI:                          18 位
 * ============================================================================
 */

import { ethers } from "hardhat";

/** USDT 小数位数（Faucet USDT = 18 位，真实 USDT = 6 位） */
export const USDT_DECIMALS = 18;

/** 将人类可读的 USDT 金额转换为合约最小单位（如 "0.05" → 50000000000000000n） */
export const U = (amount: string) => ethers.parseUnits(amount, USDT_DECIMALS);

/** 将合约最小单位转换为人类可读的 USDT 金额 */
export const FU = (amount: bigint) => ethers.formatUnits(amount, USDT_DECIMALS);
