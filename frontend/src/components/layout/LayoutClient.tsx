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

function LayoutInner({ children, refreshKey }: { children: ReactNode; refreshKey: number }) {
  const t = useT();
  const { lang } = useLang();
  const { address, chain, isConnected } = useAccount();
  const unsupported = isConnected && chain && !supportedChainIds.includes(chain.id);

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
