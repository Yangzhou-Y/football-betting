/**
 * ============================================================================
 * TxToast — 交易状态 Toast 通知系统
 * ============================================================================
 *
 * 【三种通知类型】
 *   pending → 蓝色卡片 + ⏳ 图标，交易已提交等待签名/确认（不自动消失）
 *   success → 绿色卡片 + ✓ 图标，操作成功（2.8s 后自动消失）
 *   error   → 红色卡片 + ✕ 图标，操作失败（2.8s 后自动消失）
 *
 * 【生命周期管理】
 *   ① 交易开始前      → show("交易已提交...", "pending")  返回 toastId
 *   ② 交易 pending 中 → toast 保持显示（不自动消失）
 *   ③ 交易确认成功    → show("投注成功", "success")       自动替换 + 2.8s 消失
 *   ④ 交易失败        → show("投注失败", "error")         自动替换 + 2.8s 消失
 *   ⑤ pending 变 success/error → 自动替换，无需手动 dismiss
 *
 * 【为什么用 Context 而非全局状态库？】
 *   Toast 是一个全局 UI 元素，Context + Provider 模式可确保：
 *   - 所有组件共享同一个 Toast 实例（而非各自渲染一个）
 *   - Toast 固定在页面右下角（fixed positioning），不随路由切换消失
 *   - 无需引入 Zustand/Redux 等状态管理库
 *
 * 【动画实现】
 *   使用 requestAnimationFrame + CSS transition（opacity + translateY），
 *   入场时从下方滑入 + 淡入，由浏览器合成器处理，不触发重排。
 */
"use client";

import { useEffect, useState, useCallback, useRef, createContext, useContext, type ReactNode } from "react";

type ToastType = "pending" | "success" | "error";
interface ToastItem { id: number; message: string; type: ToastType; }

const TxToastContext = createContext<{
  show: (_msg: string, _type: ToastType) => number;
  dismiss: (_id: number) => void;
}>({
  show: (_msg, _type) => 0,
  dismiss: (_id) => {},
});
export const useTxToast = () => useContext(TxToastContext);

let nextId = 1;

export function TxToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  }, []);

  const show = useCallback((message: string, type: ToastType) => {
    const id = nextId++;
    clearTimer();
    setToast({ id, message, type });
    if (type !== "pending") {
      timerRef.current = setTimeout(() => {
        setToast(null);
        timerRef.current = null;
      }, 2800);
    }
    return id;
  }, [clearTimer]);

  const dismiss = useCallback(() => {
    clearTimer();
    setToast(null);
  }, [clearTimer]);

  return (
    <TxToastContext.Provider value={{ show, dismiss }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[99999] pointer-events-none">
        {toast && <ToastCard key={toast.id} item={toast} />}
      </div>
    </TxToastContext.Provider>
  );
}

function ToastCard({ item }: { item: ToastItem }) {
  const [opacity, setOpacity] = useState(0);
  const [translateY, setTranslateY] = useState(20);

  useEffect(() => {
    requestAnimationFrame(() => {
      setOpacity(1);
      setTranslateY(0);
    });
  }, []);

  const bg = item.type === "pending" ? "bg-blue-600" :
    item.type === "success" ? "bg-green-600" : "bg-red-600";

  const icon = item.type === "pending" ? "⏳" :
    item.type === "success" ? "✓" : "✕";

  return (
    <div
      className={`${bg} text-white px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 transition-all duration-300`}
      style={{ opacity, transform: `translateY(${translateY}px)` }}
    >
      <span>{icon}</span>
      <span>{item.message}</span>
    </div>
  );
}
