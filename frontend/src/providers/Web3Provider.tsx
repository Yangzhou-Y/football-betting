"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import {
  RainbowKitProvider,
  lightTheme,
  connectorsForWallets,
  getWalletConnectConnector,
  type Locale,
} from "@rainbow-me/rainbowkit";
import { walletConnectWallet } from "@rainbow-me/rainbowkit/wallets";
import { injected } from "wagmi/connectors";
import type { CreateConnectorFn } from "wagmi";
import { supportedChains } from "@/lib/wagmi";
import { useLang } from "@/lib/i18n";
import "@rainbow-me/rainbowkit/styles.css";
import { useState, type ReactNode } from "react";

const projectId = "c3ab3b19085ebe629d528e219ebd3546";

// MetaMask icon as inline data URL
const METAMASK_ICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28' fill='none'%3E%3Cpath fill='%23fff' d='M0 0h28v28H0z'/%3E%3Cg clip-path='url(%23a)'%3E%3Cpath fill='%23ff5c16' d='m24.024 23.824-4.846-1.434-3.655 2.172-2.55-.001-3.656-2.171-4.844 1.434L3 18.88l1.473-5.488L3 8.751 4.473 3l7.569 4.496h4.413L24.024 3l1.473 5.751-1.473 4.64 1.473 5.488z'/%3E%3Cpath fill='%23ff5c16' d='m4.474 3 7.57 4.499-.302 3.087zm4.844 15.881 3.33 2.522-3.33.987zm3.064-4.17-.64-4.123-4.097 2.804h-.002v.001l.013 2.886 1.661-1.567zM24.024 3l-7.57 4.499.3 3.087zM19.18 18.881l-3.33 2.522 3.33.987zm1.674-5.488v-.002l-4.097-2.804-.64 4.124h3.064l1.662 1.567z'/%3E%3Cpath fill='%23e34807' d='m9.317 22.39-4.844 1.434L3 18.881h6.317zm3.064-7.68.925 5.962-1.282-3.315-4.37-1.078 1.662-1.568zm6.799 7.68 4.844 1.434 1.473-4.943H19.18zm-3.064-7.68-.925 5.962 1.282-3.315 4.37-1.078-1.663-1.568z'/%3E%3Cpath fill='%23ff8d5d' d='m3 18.88 1.473-5.489h3.169l.012 2.887 4.37 1.078 1.282 3.314-.659.73-3.33-2.522H3zm22.497 0-1.473-5.489h-3.17l-.01 2.887-4.371 1.078-1.282 3.314.659.73 3.33-2.522h6.317zM16.455 7.495h-4.413l-.3 3.087 1.565 10.084h1.884l1.565-10.084z'/%3E%3C/svg%3E";

function isMobile() {
  return /Android|iPhone|iPad|iPod/i.test(
    typeof navigator !== "undefined" ? navigator.userAgent : "",
  );
}

function isMetaMaskInjected() {
  if (typeof window === "undefined") return false;
  const ethereum = window.ethereum as any;
  if (!ethereum?.isMetaMask) return false;
  // 排除 Brave 等伪装的 MetaMask
  if (ethereum.isBraveWallet && !ethereum._events && !ethereum._state)
    return false;
  const impersonators = [
    "isApexWallet", "isAvalanche", "isBitKeep", "isBlockWallet",
    "isKuCoinWallet", "isMathWallet", "isOkxWallet", "isOKExWallet",
    "isOneInchIOSWallet", "isOneInchAndroidWallet", "isOpera",
    "isPhantom", "isPortal", "isRabby", "isTokenPocket",
    "isTokenary", "isUniswapWallet", "isZerion",
  ];
  for (const flag of impersonators) {
    if (ethereum[flag]) return false;
  }
  return true;
}

// MetaMask 钱包：注入可用 → injected，否则 → WalletConnect 扫码
function customMetaMaskWallet() {
  const metaMaskInstalled = isMetaMaskInjected();
  const shouldUseWalletConnect = !metaMaskInstalled;
  const mobile = isMobile();

  return {
    id: "metaMask",
    name: "MetaMask",
    rdns: "io.metamask",
    iconBackground: "#fff",
    iconAccent: "#f6851a",
    iconUrl: METAMASK_ICON,
    installed: metaMaskInstalled || undefined,
    downloadUrls: {
      android: "https://play.google.com/store/apps/details?id=io.metamask",
      ios: "https://apps.apple.com/us/app/metamask/id1438144202",
      mobile: "https://metamask.io/download",
      chrome:
        "https://chrome.google.com/webstore/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn",
      browserExtension: "https://metamask.io/download",
    },
    // 桌面端未安装 MetaMask 时，走 WalletConnect 扫码；否则用 injected
    ...(shouldUseWalletConnect && !mobile
      ? {
          qrCode: {
            getUri: (uri: string) =>
              `https://metamask.app.link/wc?uri=${encodeURIComponent(uri)}`,
          },
          createConnector: getWalletConnectConnector({ projectId }),
        }
      : {
          createConnector: (walletDetails: any): CreateConnectorFn => {
            return (config: any) => ({
              ...injected({ target: "metaMask" })(config),
              ...walletDetails,
            });
          },
        }),
  };
}

const wagmiConfig = createConfig({
  chains: supportedChains as any,
  connectors: connectorsForWallets(
    [
      {
        groupName: "Recommended",
        wallets: [customMetaMaskWallet as any, walletConnectWallet],
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
