"use client";

import { Web3Provider } from "@/providers/Web3Provider";
import { type ReactNode } from "react";

/**
 * 'use client' 边界组件 — 将 RainbowKit/Wagmi Provider 包裹在客户端边界内。
 * App Router 要求：所有使用 React hooks 的组件必须标记 'use client'。
 * 此组件在 layout.tsx 中作为 children 的 wrapper 使用。
 */
export function ClientProviders({ children }: { children: ReactNode }) {
  return <Web3Provider>{children}</Web3Provider>;
}
