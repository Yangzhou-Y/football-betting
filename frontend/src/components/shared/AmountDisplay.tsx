"use client";

import { formatUSDT } from "@/lib/utils";

/** 将 USDT 最小单位格式化为可读金额（如 50000 → "0.05 USDT"） */
export function AmountDisplay({ amount, showUnit = true }: { amount: bigint | null | undefined; showUnit?: boolean }) {
  return <span>{formatUSDT(amount)}{showUnit ? " USDT" : ""}</span>;
}
