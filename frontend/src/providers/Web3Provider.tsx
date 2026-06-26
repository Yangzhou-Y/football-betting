/**
 * ============================================================================
 * Web3Provider — Web3 基础设施配置（Wagmi + RainbowKit + TanStack Query）
 * ============================================================================
 *
 * 【技术栈关系】
 *   TanStack Query → 数据缓存层（所有合约读请求）
 *   wagmi          → 以太坊交互层（封装 viem 的 hooks）
 *   RainbowKit     → UI 层（连接按钮、钱包选择弹窗、链切换）
 *
 * 【MetaMask 自定义钱包 — 三级检测 + 全平台展示】
 *   详见下方 isMetaMaskInstalled()。
 *   核心目的：让 MetaMask 连接按钮在手机上也出现（常规 RainbowKit
 *   在手机端隐藏 MetaMask，因为手机浏览器没有拓展）。
 *
 * 【TanStack Query 缓存策略】
 *   staleTime: 0          → 组件挂载即重新获取
 *   refetchOnWindowFocus  → 切回标签页自动刷新
 *   refetchOnMount        → 每次挂载都重新获取
 *   交易完成后通过 invalidateQueries 主动刷新。
 *
 * 【RainbowKit 多语言】
 *   locale 从 LangContext 读取，用户切换中英文时 ConnectButton 同步更新。
 */
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

/** MetaMask 狐狸图标 — Base64 编码的 SVG，内联避免额外 HTTP 请求 */
const META_MASK_ICON =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyOCIgaGVpZ2h0PSIyOCIgZmlsbD0ibm9uZSIgdmlld0JveD0iMCAwIDI4IDI4Ij48cGF0aCBmaWxsPSIjZmZmIiBkPSJNMCAwaDI4djI4SDB6Ii8+PGcgY2xpcC1wYXRoPSJ1cmwoI2EpIj48cGF0aCBmaWxsPSIjZmY1YzE2IiBkPSJtMjQuMDI0IDIzLjgyNC00Ljg0Ni0xLjQzNC0zLjY1NSAyLjE3Mi0yLjU1LS4wMDEtMy42NTYtMi4xNzEtNC44NDQgMS40MzRMMyAxOC44OGwxLjQ3My01LjQ4OEwzIDguNzUxIDQuNDczIDNsNy41NjkgNC40OTZoNC40MTNMMjQuMDI0IDNsMS40NzMgNS43NTEtMS40NzMgNC42NCAxLjQ3MyA1LjQ4OHoiLz48cGF0aCBmaWxsPSIjZmY1YzE2IiBkPSJtNC40NzQgMyA3LjU3IDQuNDk5LS4zMDIgMy4wODd6bTQuODQ0IDE1Ljg4MSAzLjMzIDIuNTIyLTMuMzMuOTg3em0zLjA2NC00LjE3LS42NC00LjEyMy00LjA5NyAyLjgwNGgtLjAwMnYuMDAxbC4wMTMgMi44ODYgMS42NjEtMS41Njd6TTI0LjAyNCAzbC03LjU3IDQuNDk5LjMgMy4wODd6TTE5LjE4IDE4Ljg4MWwtMy4zMyAyLjUyMiAzLjMzLjk4N3ptMS42NzQtNS40ODh2LS4wMDJsLTQuMDk3LTIuODA0LS42NCA0LjEyNGgzLjA2NGwxLjY2MiAxLjU2N3oiLz48cGF0aCBmaWxsPSIjZTM0ODA3IiBkPSJtOS4zMTcgMjIuMzktNC44NDQgMS40MzRMMyAxOC44ODFoNi4zMTd6bTMuMDY0LTcuNjguOTI1IDUuOTYyLTEuMjgyLTMuMzE1LTQuMzctMS4wNzggMS42NjItMS41Njh6bTYuNzk5IDcuNjggNC44NDQgMS40MzQgMS40NzMtNC45NDNIMTkuMTh6bS0zLjA2NC03LjY4LS45MjUgNS45NjIgMS4yODItMy4zMTUgNC4zNy0xLjA3OC0xLjY2My0xLjU2OHoiLz48cGF0aCBmaWxsPSIjZmY4ZDVkIiBkPSJtMyAxOC44OCAxLjQ3My01LjQ4OWgzLjE2OWwuMDEyIDIuODg3IDQuMzcgMS4wNzggMS4yODIgMy4zMTQtLjY1OS43My0zLjMzLTIuNTIySDN6bTIyLjQ5NyAwLTEuNDczLTUuNDg5aC0zLjE3bC0uMDEgMi44ODctNC4zNzEgMS4wNzgtMS4yODIgMy4zMTQuNjU5LjczIDMuMzMtMi41MjJoNi4zMTd6TTE2LjQ1NSA3LjQ5NWgtNC40MTNsLS4zIDMuMDg3IDEuNTY1IDEwLjA4NGgxLjg4NGwxLjU2NS0xMC4wODR6Ii8+PC9nPjxkZWZzPjxjbGlwUGF0aCBpZD0iYSI+PHBhdGggZmlsbD0iI2ZmZiIgZD0iTTMgM2gyMi41djIxLjU2M0gzeiIvPjwvY2xpcFBhdGg+PC9kZWZzPjwvc3ZnPg==";

/**
 * MetaMask 钱包检测 — 三级优先级降级策略
 *
 * 【为什么需要自定义检测？】
 *   MetaMask App 内置浏览器中的 ethereum provider 不暴露标准的 isMetaMask 标记。
 *   同时，Rabby/Coinbase/OKEx/Brave/Trust 等钱包也会注入自己的 provider
 *   并设置 isMetaMask=true 来伪装成 MetaMask 以兼容 DApp。
 *   此函数通过三级检测准确识别真正的 MetaMask 并排除伪装者。
 *
 *   优先级 1: _metamask 内部 API → MetaMask 独有，其他钱包不模仿
 *   优先级 2: EIP-6963 providers[] 扫描 → 遍历所有注入的 provider，
 *             找到 _metamask 或 isMetaMask(true) 且非伪装者的那个
 *   优先级 3: isMetaMask 标记 → 排除已知伪装者后使用
 */
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

/**
 * 自定义 MetaMask 钱包配置 — 覆盖 RainbowKit 默认的 MetaMask 检测逻辑
 *
 * 使用自定义的 isMetaMaskInstalled() 判断安装状态，并在所有平台（含手机）
 * 显示 MetaMask 连接选项。createConnector 使用 wagmi 的 injected connector，
 * target: "metaMask" 确保优先连接 MetaMask 而非其他注入的 provider。
 */
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

/** wagmi 核心配置 — chains + connectors + transports 三要素 */
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

/** RainbowKit 内部包装 — 分离 useLang() 依赖，避免整棵树因语言切换重渲染 */
function RainbowKitInner({ children }: { children: ReactNode }) {
  const { lang } = useLang();
  const locale: Locale = lang === "zh" ? "zh-CN" : "en";

  return (
    <RainbowKitProvider coolMode locale={locale} theme={lightTheme()}>
      {children}
    </RainbowKitProvider>
  );
}

/**
 * Web3 根 Provider — 三层嵌套结构
 *   WagmiProvider (wagmi 配置)
 *     → QueryClientProvider (TanStack Query 缓存)
 *       → RainbowKitInner (钱包 UI + 多语言)
 *         → children (页面内容)
 *
 * QueryClient 用 useState 创建，确保在组件生命周期内只有单例。
 */
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
