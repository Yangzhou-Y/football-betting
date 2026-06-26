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
import { injected } from "wagmi/connectors";
import type { CreateConnectorFn } from "wagmi";
import { supportedChains } from "@/lib/wagmi";
import { useLang } from "@/lib/i18n";
import "@rainbow-me/rainbowkit/styles.css";
import { useState, type ReactNode } from "react";

const META_MASK_ICON =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyOCIgaGVpZ2h0PSIyOCIgZmlsbD0ibm9uZSIgdmlld0JveD0iMCAwIDI4IDI4Ij48cGF0aCBmaWxsPSIjZmZmIiBkPSJNMCAwaDI4djI4SDB6Ii8+PGcgY2xpcC1wYXRoPSJ1cmwoI2EpIj48cGF0aCBmaWxsPSIjZmY1YzE2IiBkPSJtMjQuMDI0IDIzLjgyNC00Ljg0Ni0xLjQzNC0zLjY1NSAyLjE3Mi0yLjU1LS4wMDEtMy42NTYtMi4xNzEtNC44NDQgMS40MzRMMyAxOC44OGwxLjQ3My01LjQ4OEwzIDguNzUxIDQuNDczIDNsNy41NjkgNC40OTZoNC40MTNMMjQuMDI0IDNsMS40NzMgNS43NTEtMS40NzMgNC42NCAxLjQ3MyA1LjQ4OHoiLz48cGF0aCBmaWxsPSIjZmY1YzE2IiBkPSJtNC40NzQgMyA3LjU3IDQuNDk5LS4zMDIgMy4wODd6bTQuODQ0IDE1Ljg4MSAzLjMzIDIuNTIyLTMuMzMuOTg3em0zLjA2NC00LjE3LS42NC00LjEyMy00LjA5NyAyLjgwNGgtLjAwMnYuMDAxbC4wMTMgMi44ODYgMS42NjEtMS41Njd6TTI0LjAyNCAzbC03LjU3IDQuNDk5LjMgMy4wODd6TTE5LjE4IDE4Ljg4MWwtMy4zMyAyLjUyMiAzLjMzLjk4N3ptMS42NzQtNS40ODh2LS4wMDJsLTQuMDk3LTIuODA0LS42NCA0LjEyNGgzLjA2NGwxLjY2MiAxLjU2N3oiLz48cGF0aCBmaWxsPSIjZTM0ODA3IiBkPSJtOS4zMTcgMjIuMzktNC44NDQgMS40MzRMMyAxOC44ODFoNi4zMTd6bTMuMDY0LTcuNjguOTI1IDUuOTYyLTEuMjgyLTMuMzE1LTQuMzctMS4wNzggMS42NjItMS41Njh6bTYuNzk5IDcuNjggNC44NDQgMS40MzQgMS40NzMtNC45NDNIMTkuMTh6bS0zLjA2NC03LjY4LS45MjUgNS45NjIgMS4yODItMy4zMTUgNC4zNy0xLjA3OC0xLjY2My0xLjU2OHoiLz48cGF0aCBmaWxsPSIjZmY4ZDVkIiBkPSJtMyAxOC44OCAxLjQ3My01LjQ4OWgzLjE2OWwuMDEyIDIuODg3IDQuMzcgMS4wNzggMS4yODIgMy4zMTQtLjY1OS43My0zLjMzLTIuNTIySDN6bTIyLjQ5NyAwLTEuNDczLTUuNDg5aC0zLjE3bC0uMDEgMi44ODctNC4zNzEgMS4wNzgtMS4yODIgMy4zMTQuNjU5LjczIDMuMzMtMi41MjJoNi4zMTd6TTE2LjQ1NSA3LjQ5NWgtNC40MTNsLS4zIDMuMDg3IDEuNTY1IDEwLjA4NGgxLjg4NGwxLjU2NS0xMC4wODR6Ii8+PC9nPjxkZWZzPjxjbGlwUGF0aCBpZD0iYSI+PHBhdGggZmlsbD0iI2ZmZiIgZD0iTTMgM2gyMi41djIxLjU2M0gzeiIvPjwvY2xpcFBhdGg+PC9kZWZzPjwvc3ZnPg==";

function isMetaMaskInstalled() {
  if (typeof window === "undefined") return false;
  const eth = (window as any).ethereum;
  if (!eth) return false;
  if (eth._metamask) return true;
  if (eth.providers?.length) {
    return eth.providers.some(
      (p: any) => p._metamask || (p.isMetaMask && !p.isRabby && !p.isCoinbaseWallet && !p.isOKExWallet),
    );
  }
  return eth.isMetaMask && !eth.isRabby && !eth.isCoinbaseWallet && !eth.isOKExWallet && !eth.isBraveWallet && !eth.isTrust;
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
      chrome: "https://chrome.google.com/webstore/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn",
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
        wallets: [customMetaMaskWallet as any, rabbyWallet],
      },
    ],
    { appName: "Football Betting" } as any,
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
