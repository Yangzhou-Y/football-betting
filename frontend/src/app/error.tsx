/**
 * ============================================================================
 * Error Boundary — Next.js App Router 全局错误边界
 * ============================================================================
 *
 * 【触发时机】
 *   当页面组件在渲染过程中抛出未捕获错误时，Next.js 会自动显示此错误页面。
 *   这包括：RPC 请求失败、合约调用异常、JavaScript 运行时错误等。
 *
 * 【error 对象】
 *   - message: 错误描述文本
 *   - digest: Next.js 生成的哈希值，用于在生产日志中定位具体错误
 *
 * 【reset 函数】
 *   Next.js 提供的重试机制。点击"重试"按钮后，
 *   reset() 会重新渲染出错的页面组件，重新发起数据请求。
 *   这适合临时性错误（如 RPC 超时、网络波动）。
 *
 * 【与普通 try-catch 的区别】
 *   React Error Boundary 捕获渲染阶段的错误，try-catch 捕获事件处理器中的错误。
 *   两者互补：此组件处理渲染/数据获取错误，页面内的 try-catch 处理用户操作错误。
 */
"use client";

import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("App error boundary caught:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <div className="bg-white rounded-xl p-8 shadow-sm border border-slate-200 max-w-md w-full text-center">
        <h2 className="text-lg font-semibold text-red-600 mb-2">Something went wrong</h2>
        <p className="text-sm text-slate-500 mb-6">
          {error.message || "An unexpected error occurred. Please try again."}
        </p>
        <button
          onClick={reset}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
