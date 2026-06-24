"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { RainbowKitProvider, lightTheme, connectorsForWallets, type Locale } from "@rainbow-me/rainbowkit";
import { metaMaskWallet, rabbyWallet } from "@rainbow-me/rainbowkit/wallets";
import { supportedChains } from "@/lib/wagmi";
import { useLang } from "@/lib/i18n";
import "@rainbow-me/rainbowkit/styles.css";
import { useState, type ReactNode } from "react";

// ============================================================================
// RainbowKit + Wagmi + TanStack React Query 三合一 Provider
// ============================================================================
// 使用 connectorsForWallets 生成带 RainbowKit 元数据的 connector，
// 确保 MetaMask 和 Rabby 在桌面端和移动端（含 MetaMask 内置浏览器）都能正常显示。
// 不包含 WalletConnect wallet，因此 projectId 留空即可。

const wagmiConfig = createConfig({
  chains: supportedChains as any,
  connectors: connectorsForWallets(
    [{ groupName: "Recommended", wallets: [metaMaskWallet, rabbyWallet] }],
    { projectId: "00000000000000000000000000000000", appName: "Football Betting" },
  ),
  transports: supportedChains.reduce(
    (acc, chain) => ({ ...acc, [chain.id]: http() }),
    {} as Record<number, ReturnType<typeof http>>,
  ),
});

function RainbowKitInner({ children }: { children: ReactNode }) {
  const { lang } = useLang();
  const locale: Locale = lang === "zh" ? "zh-CN" : "en";

  return (
    <RainbowKitProvider coolMode locale={locale} theme={lightTheme()}>
      {children}
    </RainbowKitProvider>
  );
}

export function Web3Provider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({
      defaultOptions: {
        queries: { staleTime: 0, refetchOnWindowFocus: true, refetchOnMount: true },
      },
    }),
  );

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitInner>{children}</RainbowKitInner>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
