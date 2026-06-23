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
