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
