"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { RainbowKitProvider, lightTheme, connectorsForWallets, type Locale } from "@rainbow-me/rainbowkit";
import { rabbyWallet, walletConnectWallet } from "@rainbow-me/rainbowkit/wallets";
import { injected } from "wagmi/connectors";
import type { CreateConnectorFn } from "wagmi";
import { supportedChains } from "@/lib/wagmi";
import { useLang } from "@/lib/i18n";
import "@rainbow-me/rainbowkit/styles.css";
import { useState, type ReactNode } from "react";

const projectId = "c3ab3b19085ebe629d528e219ebd3546";

// 自定义 MetaMask 钱包：用简单的 injected() 替代 SDK connector
function customMetaMaskWallet() {
  const isInstalled =
    typeof window !== "undefined" && !!(window.ethereum as any)?.isMetaMask;

  return {
    id: "metaMask",
    name: "MetaMask",
    rdns: "io.metamask",
    iconBackground: "#fff",
    iconAccent: "#f6851a",
    iconUrl: async () => {
      const mod = await import("@rainbow-me/rainbowkit/wallets");
      const mm = (mod as any).metaMaskWallet?.({ projectId });
      return mm?.iconUrl ?? "";
    },
    installed: isInstalled || undefined,
    downloadUrls: {
      android: "https://play.google.com/store/apps/details?id=io.metamask",
      ios: "https://apps.apple.com/us/app/metamask/id1438144202",
      mobile: "https://metamask.io/download",
      chrome:
        "https://chrome.google.com/webstore/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn",
      browserExtension: "https://metamask.io/download",
    },
    createConnector: (walletDetails: any): CreateConnectorFn => {
      return (config: any) => ({
        ...injected({ target: "metaMask" })(config),
        ...walletDetails,
      });
    },
  };
}

const wagmiConfig = createConfig({
  chains: supportedChains as any,
  connectors: connectorsForWallets(
    [
      {
        groupName: "Recommended",
        wallets: [customMetaMaskWallet as any, rabbyWallet, walletConnectWallet],
      },
    ],
    {
      projectId,
      appName: "Football Betting",
    },
  ),
  ssr: true,
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
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 0,
            refetchOnWindowFocus: true,
            refetchOnMount: true,
          },
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
