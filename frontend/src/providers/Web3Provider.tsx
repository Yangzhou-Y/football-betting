"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import {
  RainbowKitProvider,
  lightTheme,
  connectorsForWallets,
  type Locale,
} from "@rainbow-me/rainbowkit";
import { rabbyWallet } from "@rainbow-me/rainbowkit/wallets";
import { injected, walletConnect } from "wagmi/connectors";
import type { CreateConnectorFn } from "wagmi";
import { supportedChains } from "@/lib/wagmi";
import { useLang } from "@/lib/i18n";
import "@rainbow-me/rainbowkit/styles.css";
import { useState, type ReactNode } from "react";

const projectId = "c3ab3b19085ebe629d528e219ebd3546";

const META_MASK_ICON =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyOCIgaGVpZ2h0PSIyOCIgZmlsbD0ibm9uZSIgdmlld0JveD0iMCAwIDI4IDI4Ij48cGF0aCBmaWxsPSIjZmZmIiBkPSJNMCAwaDI4djI4SDB6Ii8+PGcgY2xpcC1wYXRoPSJ1cmwoI2EpIj48cGF0aCBmaWxsPSIjZmY1YzE2IiBkPSJtMjQuMDI0IDIzLjgyNC00Ljg0Ni0xLjQzNC0zLjY1NSAyLjE3Mi0yLjU1LS4wMDEtMy42NTYtMi4xNzEtNC44NDQgMS40MzRMMyAxOC44OGwxLjQ3My01LjQ4OEwzIDguNzUxIDQuNDczIDNsNy41NjkgNC40OTZoNC40MTNMMjQuMDI0IDNsMS40NzMgNS43NTEtMS40NzMgNC42NCAxLjQ3MyA1LjQ4OHoiLz48cGF0aCBmaWxsPSIjZmY1YzE2IiBkPSJtNC40NzQgMyA3LjU3IDQuNDk5LS4zMDIgMy4wODd6bTQuODQ0IDE1Ljg4MSAzLjMzIDIuNTIyLTMuMzMuOTg3em0zLjA2NC00LjE3LS42NC00LjEyMy00LjA5NyAyLjgwNGgtLjAwMnYuMDAxbC4wMTMgMi44ODYgMS42NjEtMS41Njd6TTI0LjAyNCAzbC03LjU3IDQuNDk5LjMgMy4wODd6TTE5LjE4IDE4Ljg4MWwtMy4zMyAyLjUyMiAzLjMzLjk4N3ptMS42NzQtNS40ODh2LS4wMDJsLTQuMDk3LTIuODA0LS42NCA0LjEyNGgzLjA2NGwxLjY2MiAxLjU2N3oiLz48cGF0aCBmaWxsPSIjZTM0ODA3IiBkPSJtOS4zMTcgMjIuMzktNC44NDQgMS40MzRMMyAxOC44ODFoNi4zMTd6bTMuMDY0LTcuNjguOTI1IDUuOTYyLTEuMjgyLTMuMzE1LTQuMzctMS4wNzggMS42NjItMS41Njh6bTYuNzk5IDcuNjggNC44NDQgMS40MzQgMS40NzMtNC45NDNIMTkuMTh6bS0zLjA2NC03LjY4LS45MjUgNS45NjIgMS4yODItMy4zMTUgNC4zNy0xLjA3OC0xLjY2My0xLjU2OHoiLz48cGF0aCBmaWxsPSIjZmY4ZDVkIiBkPSJtMyAxOC44OCAxLjQ3My01LjQ4OWgzLjE2OWwuMDEyIDIuODg3IDQuMzcgMS4wNzggMS4yODIgMy4zMTQtLjY1OS43My0zLjMzLTIuNTIySDN6bTIyLjQ5NyAwLTEuNDczLTUuNDg5aC0zLjE3bC0uMDEgMi44ODctNC4zNzEgMS4wNzgtMS4yODIgMy4zMTQuNjU5LjczIDMuMzMtMi41MjJoNi4zMTd6TTE2LjQ1NSA3LjQ5NWgtNC40MTNsLS4zIDMuMDg3IDEuNTY1IDEwLjA4NGgxLjg4NGwxLjU2NS0xMC4wODR6Ii8+PC9nPjxkZWZzPjxjbGlwUGF0aCBpZD0iYSI+PHBhdGggZmlsbD0iI2ZmZiIgZD0iTTMgM2gyMi41djIxLjU2M0gzeiIvPjwvY2xpcFBhdGg+PC9kZWZzPjwvc3ZnPg==";

// 严格检测 MetaMask 是否真实安装（避免 Rabby 等钱包伪装成 MetaMask）
function isMetaMaskInstalled() {
  if (typeof window === "undefined") return false;
  const eth = (window as any).ethereum;
  if (!eth) return false;
  if (eth.providers?.length) {
    return eth.providers.some(
      (p: any) => p.isMetaMask && !p.isRabby
    );
  }
  return eth.isMetaMask && !eth.isRabby;
}

function customMetaMaskWallet() {
  const installed = isMetaMaskInstalled();

  return {
    id: "metaMask",
    name: "MetaMask",
    rdns: "io.metamask",
    iconBackground: "#fff",
    iconAccent: "#f6851a",
    iconUrl: META_MASK_ICON,
    installed: installed || undefined,
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
          customMetaMaskWallet as any,
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
