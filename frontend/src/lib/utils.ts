import { formatUnits, parseUnits } from "viem";
import { USDT_DECIMALS } from "./constants";

// ============================================================================
// bytes32 队名编解码
// Contract stores team names as bytes32 (32-byte fixed, left-aligned, zero-padded).
// We use TextEncoder/TextDecoder for proper UTF-8 handling of Chinese characters.
// ============================================================================

/** Encode a team name to bytes32 hex (left-aligned, zero-padded to 32 bytes) */
export function encodeTeamName(name: string): `0x${string}` {
  const bytes = new TextEncoder().encode(name);
  if (bytes.length > 32) throw new Error(`Team name too long: ${name} (${bytes.length} bytes, max 32)`);
  // Build hex string byte by byte, then pad with zero bytes to 32
  let hex = "0x";
  for (const b of bytes) {
    hex += b.toString(16).padStart(2, "0");
  }
  return hex.padEnd(66, "0") as `0x${string}`;
}

/** Decode a bytes32 hex to a human-readable team name (stops at first zero byte) */
export function decodeTeamName(hex: string): string {
  if (!hex || hex === "0x") return "";
  // Remove 0x prefix then process 64 hex chars as 32 bytes
  const raw = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(raw.slice(i * 2, i * 2 + 2) || "00", 16);
  }
  // Find first zero byte
  let end = 0;
  while (end < 32 && bytes[end] !== 0) end++;
  if (end === 0) return "";
  try {
    return new TextDecoder().decode(bytes.slice(0, end));
  } catch {
    return hex.slice(0, 10) + "...";
  }
}

// ============================================================================
// USDT 金额格式化（18 位小数）
// ============================================================================

/** Format USDT amount from minimum units to display string (e.g., 50000 → "0.05")
 *  Uses string manipulation to avoid Number() precision loss. */
export function formatUSDT(amount: bigint | null | undefined, displayDecimals = 2): string {
  if (amount == null) return "0.00";
  const formatted = formatUnits(amount, USDT_DECIMALS);
  // Avoid Number() which loses precision above 2^53 (~9e15 for amounts)
  const dot = formatted.indexOf(".");
  if (dot === -1) return formatted + "." + "0".repeat(displayDecimals);
  const intPart = formatted.slice(0, dot);
  const decPart = formatted.slice(dot + 1);
  return intPart + "." + decPart.slice(0, displayDecimals).padEnd(displayDecimals, "0");
}

/** Parse USDT string to minimum units (e.g., "0.05" → 50000n) */
export function parseUSDT(amount: string): bigint {
  return parseUnits(amount, USDT_DECIMALS);
}

/**
 * 计算某个选项的当前赔率（Parimutuel 快照赔率）
 *
 * 赔率 = 可分配奖池 / 该选项奖池
 *   可分配奖池 = 总奖池 × (1 - 手续费率)
 *
 * @param optionPool 该选项的奖池金额（最小单位）
 * @param totalPool  总奖池金额（最小单位）
 * @param feeRate    平台手续费率（基点，如 200 = 2%）
 * @returns 形如 "2.10" 的赔率字符串；无法计算（奖池为 0）时返回 null
 */
export function calcOdds(optionPool: bigint, totalPool: bigint, feeRate: number): string | null {
  if (optionPool <= 0n || totalPool <= 0n) return null;
  const distributable = (totalPool * BigInt(10000 - feeRate)) / 10000n;
  // 放大 100 倍后取整，保留两位小数，避免 bigint→Number 精度丢失
  const oddsX100 = (distributable * 100n) / optionPool;
  return (Number(oddsX100) / 100).toFixed(2);
}

// ============================================================================
// 通用工具
// ============================================================================

/** Shorten address for display: 0x1234...abcd */
export function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

/** Format Unix timestamp to local date string, following app language */
export function formatTime(ts: bigint | number, lang: "zh" | "en" = "zh"): string {
  const locale = lang === "zh" ? "zh-CN" : "en-US";
  return new Date(Number(ts) * 1000).toLocaleString(locale);
}

/** Short date+time without seconds for compact display */
export function formatTimeShort(ts: bigint | number, lang: "zh" | "en" = "zh"): string {
  const locale = lang === "zh" ? "zh-CN" : "en-US";
  const d = new Date(Number(ts) * 1000);
  return d.toLocaleDateString(locale, { month: "numeric", day: "numeric" }) + " " +
    d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}
