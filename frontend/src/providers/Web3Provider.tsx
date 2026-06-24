"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import {
  RainbowKitProvider,
  lightTheme,
  connectorsForWallets,
  type Locale,
} from "@rainbow-me/rainbowkit";
import { metaMaskWallet, rabbyWallet } from "@rainbow-me/rainbowkit/wallets";
import { walletConnect } from "wagmi/connectors";
import type { CreateConnectorFn } from "wagmi";
import { supportedChains } from "@/lib/wagmi";
import { useLang } from "@/lib/i18n";
import "@rainbow-me/rainbowkit/styles.css";
import { useState, type ReactNode } from "react";

const projectId = "c3ab3b19085ebe629d528e219ebd3546";

// WalletConnect 图标
const WC_ICON =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyODgiIGhlaWdodD0iMjg4IiBmaWxsPSJub25lIiB2aWV3Qm94PSIwIDAgMjg4IDI4OCI+PHJlY3Qgd2lkdGg9IjI4OCIgaGVpZ2h0PSIyODgiIGZpbGw9IiMzQjk5RkMiIHJ4PSI1Ny42Ii8PjxwYXRoIGZpbGw9IiNmZmYiIGQ9Ik03Ny4yIDExNi44YzM2LjktMzYuMiA5Ni43LTM2LjIgMTMzLjYgMGw0LjQgNC40YzEuOSAxLjggMS45IDQuOCAwIDYuNmwtMTUuMiAxNC45Yy0uOS45LTIuMy45LTMuMiAwbC02LjEtNi4xYy0yNS43LTI1LjMtNjcuNS0yNS4zLTkzLjIgMGwtNi42IDYuNWMtLjkuOS0yLjMuOS0zLjIgMEw3Mi44IDEyMy40Yy0xLjgtMS44LTEuOC00LjggMC02LjZsNC40LTQuNFptMTY1LjEgMTUuNCAxMy41IDEzLjNjMS45IDEuOCAxLjkgNC44IDAgNi42bC02MS4yIDYwLjFjLTEuOSAxLjgtNC45IDEuOC02LjggMGwtNDMuNC00Mi42Yy0uNS0uNS0xLjMtLjUtMS44IDBsLTQzLjQgNDIuNmMtMS45IDEuOC00LjkgMS44LTYuOCAwbC02MS4yLTYwLjFjLTEuOS0xLjgtMS45LTQuOCAwLTYuNmwxMy41LTEzLjNjMS45LTEuOCA0LjktMS44IDYuOCAwbDQzLjQgNDIuNmMuNS41IDEuMy41IDEuOCAwbDQzLjQtNDIuNmMxLjktMS44IDQuOS0xLjggNi44IDBsNDMuNCA0Mi42Yy41LjUgMS4zLjUgMS44IDBsNDMuNC00Mi42YzEuOS0xLjggNC45LTEuOCA2LjggMHoiLz48L3N2Zz4=";

// 自定义 WalletConnect：用 wagmi 的 walletConnect connector，明确传入 projectId
function customWalletConnect() {
  return {
    id: "walletConnect",
    name: "WalletConnect",
    iconBackground: "#3b99fc",
    iconAccent: "#3b99fc",
    iconUrl: WC_ICON,
    createConnector: (walletDetails: any): CreateConnectorFn => {
      return (config: any) => ({
        ...walletConnect({
          projectId,
          showQrModal: false,
          metadata: {
            name: "Football Betting",
            description: "Football Betting DApp",
            url: "",
            icons: [],
          },
        })(config),
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
        wallets: [
          metaMaskWallet,
          rabbyWallet,
          customWalletConnect as any,
        ],
      },
    ],
    { projectId, appName: "Football Betting" },
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
