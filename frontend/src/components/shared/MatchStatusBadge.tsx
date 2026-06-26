/**
 * ============================================================================
 * MatchStatusBadge — 比赛状态徽章（彩色圆角标签）
 * ============================================================================
 *
 * 【状态与颜色对应】
 *   0 → Created（已创建）→ 灰色 gray-500
 *   1 → Open（投注中）  → 绿色 green-500
 *   2 → Closed（已封盘）→ 黄色 yellow-500
 *   3 → Settled（已开奖）→ 紫色 purple-500
 *   已截止（Open 但 deadline 已过）→ 橙色 orange-500（覆盖状态颜色）
 *
 * 【deadline 检测逻辑】
 *   即使 status 仍为 Open，如果 deadline 已过，显示"已截止"。
 *   这覆盖了管理员尚未调用 closeMatch/autoClose 但时间已过的过渡状态。
 */
"use client";

import { useT } from "@/lib/i18n";
import { STATUS_KEYS, MatchStatus } from "@/lib/constants";

const STATUS_COLORS: Record<number, string> = {
  0: "bg-gray-500",
  1: "bg-green-500",
  2: "bg-yellow-500",
  3: "bg-purple-500",
};

export function MatchStatusBadge({ status, deadline }: { status: number; deadline?: bigint }) {
  const t = useT();
  const now = BigInt(Math.floor(Date.now() / 1000));
  const expired = status === MatchStatus.Open && deadline != null && deadline > 0n && now >= deadline;

  const label = expired ? t("match.status.deadlinePassed") : t(STATUS_KEYS[status as MatchStatus] || "common.unknown");
  const color = expired ? "bg-orange-500" : (STATUS_COLORS[status] || "bg-gray-400");

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white ${color}`}>
      {label}
    </span>
  );
}
