"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { RainbowKitProvider, lightTheme, type Locale } from "@rainbow-me/rainbowkit";
import { metaMaskWallet, rabbyWallet } from "@rainbow-me/rainbowkit/wallets";
import { injected } from "wagmi/connectors";
import { supportedChains } from "@/lib/wagmi";
import { useLang } from "@/lib/i18n";
import "@rainbow-me/rainbowkit/styles.css";
import { useState, type ReactNode } from "react";

// ============================================================================
// RainbowKit + Wagmi + TanStack React Query 三合一 Provider
// ============================================================================
// 使用 createConfig 而非 getDefaultConfig，以避免引入 WalletConnect 依赖。
// 显式配置 MetaMask 和 Rabby 两个 injected connector，
// RainbowKit 连接弹窗会分别显示两个钱包选项。

const wagmiConfig = createConfig({
  chains: supportedChains as any,
  connectors: [
    // MetaMask 专用 connector（通过 EIP-6963 rdns 精准匹配，桌面端优先）
    injected({ target: "metaMask" }),
    // Rabby Wallet 专用 connector（shim 注入 window.ethereum）
    injected({ target: "rabby" }),
    // 兜底 injected connector，捕获无 EIP-6963 的环境（MetaMask 移动端浏览器等）
    // 桌面端已由上方 target 匹配，不会重复显示
    injected(),
  ],
  transports: supportedChains.reduce(
    (acc, chain) => ({ ...acc, [chain.id]: http() }),
    {} as Record<number, ReturnType<typeof http>>,
  ),
});

function RainbowKitInner({ children }: { children: ReactNode }) {
  const { lang } = useLang();
  const locale: Locale = lang === "zh" ? "zh-CN" : "en";

  return (
    <RainbowKitProvider
      coolMode
      locale={locale}
      theme={lightTheme()}
      wallets={[
        { groupName: "Recommended", wallets: [metaMaskWallet, rabbyWallet] },
      ]}
    >
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
