/**
 * ============================================================================
 * 刷新上下文 — 提供手动触发 UI 更新的轻量级机制
 * ============================================================================
 *
 * 【为什么需要这个？】
 *   TanStack Query 的 invalidateQueries 已经能自动刷新合约数据，
 *   但某些 UI 状态（如 toast 提示、动画重置、交易成功后清空表单等）
 *   不通过 TanStack Query 管理，需要一种统一的方式触发重渲染。
 *
 * 【工作原理】
 *   - refreshKey 是一个自增计数器，每次 triggerRefresh() 调用时 +1
 *   - 消费方（PageTransition 等）将 refreshKey 作为 useEffect 的依赖，
 *     refreshKey 变化 → 触发动画重置或状态清理
 *   - 通过 React Context 传递，避免逐层 props drilling
 *
 * 【使用示例】
 *   // Provider 端（LayoutClient.tsx）
 *   const [refreshKey, setRefreshKey] = useState(0);
 *   <RefreshContext.Provider value={{ refreshKey, triggerRefresh: ... }}>
 *
 *   // Consumer 端
 *   const { triggerRefresh } = useRefresh();
 *   triggerRefresh(); // 触发所有监听方的刷新逻辑
 */
"use client";

import { createContext, useContext } from "react";

export const RefreshContext = createContext({ refreshKey: 0, triggerRefresh: () => {} });
export const useRefresh = () => useContext(RefreshContext);
