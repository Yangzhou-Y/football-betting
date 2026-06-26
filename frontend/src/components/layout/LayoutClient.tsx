/**
 * ============================================================================
 * LayoutClient — 客户端布局根组件
 * ============================================================================
 *
 * 【Context 层级结构（从外到内）】
 *   LangProvider         → 中英文切换
 *   ClientProviders      → RainbowKit + Wagmi + TanStack Query
 *   TxToastProvider      → 全局交易状态 Toast
 *   RefreshContext        → 手动触发 UI 刷新
 *   LayoutInner          → Navbar + 背景 + 页面动画 + Footer
 *
 * 【为什么需要 'use client'？】
 *   Next.js App Router 默认服务端渲染。useAccount()、useState() 等
 *   需要客户端环境（window、localStorage 等），所以整个布局链从
 *   LayoutClient 开始都标记为 'use client'。
 *
 * 【RefreshContext 的作用】
 *   提供 refreshKey 计数器 + triggerRefresh 方法，跨组件触发 UI 更新
 *   （如页面切换动画、表单重置等与 TanStack Query 无关的状态）。
 */
"use client";

import { useState, useEffect, type ReactNode } from "react";
import { useAccount } from "wagmi";
import { supportedChains } from "@/lib/wagmi";
const supportedChainIds = supportedChains.map((c) => c.id) as number[];
import { RefreshContext } from "@/lib/refresh";
import { ClientProviders } from "@/components/layout/ClientProviders";
import { Navbar } from "@/components/layout/Navbar";
import { PageTransition } from "@/components/layout/PageTransition";
import { WorldCupBackground } from "@/components/layout/WorldCupBackground";
import { LangProvider, useT, useLang } from "@/lib/i18n";
import { TxToastProvider } from "@/components/shared/TxToast";

export function LayoutClient({ children }: { children: ReactNode }) {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <LangProvider>
      <ClientProviders>
        <TxToastProvider>
          <RefreshContext.Provider value={{ refreshKey, triggerRefresh: () => setRefreshKey(k => k + 1) }}>
            <LayoutInner refreshKey={refreshKey}>{children}</LayoutInner>
          </RefreshContext.Provider>
        </TxToastProvider>
      </ClientProviders>
    </LangProvider>
  );
}

/** 实际渲染布局的内部组件 — Navbar + 背景 + 主内容 + 页面切换动画 + Footer */
function LayoutInner({ children, refreshKey }: { children: ReactNode; refreshKey: number }) {
  const t = useT();
  const { lang } = useLang();
  const { address, chain, isConnected } = useAccount();
  // 检测当前连接的网络是否在支持列表中
  const unsupported = isConnected && chain && !supportedChainIds.includes(chain.id);

  // 语言切换时同步更新 HTML lang 属性（影响浏览器翻译提示和字体渲染）
  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  }, [lang]);

  return (
    <>
      <WorldCupBackground />
      <Navbar />
      {unsupported && (
        <div className="bg-amber-50 border-b border-amber-300 text-center py-2 text-sm text-amber-700">
          {t("network.unsupported")}
        </div>
      )}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        <PageTransition refreshKey={refreshKey} accountKey={address}>{children}</PageTransition>
      </main>
      <footer className="text-center text-sm text-slate-400 py-4 border-t border-slate-200">
        FootballBetting DApp &copy; {new Date().getFullYear()}
      </footer>
    </>
  );
}
