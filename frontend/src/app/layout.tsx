/**
 * ============================================================================
 * RootLayout — Next.js App Router 根布局（服务端组件）
 * ============================================================================
 *
 * 【此组件为什么是服务端组件？】
 *   metadata 和 viewport 导出需要服务端渲染环境。
 *   实际的客户端逻辑（钱包连接、状态管理）由 LayoutClient 负责，
 *   形成"服务端壳 → 客户端核心"的分层架构。
 *
 * 【viewport 配置说明】
 *   - width=device-width: 响应式适配
 *   - initialScale=1.0: 初始缩放 100%
 *   - maximumScale=1.0 + userScalable=false: 禁用双指缩放
 *     这防止移动端用户在输入框中聚焦时页面意外放大
 *
 * 【字体配置】
 *   使用 Next.js 内置的 Google Fonts 优化方案：
 *   - Geist Sans → 主字体（UI 文本、标题）
 *   - Geist Mono → 等宽字体（地址、金额、数据表格）
 *   - CSS 变量注入 → Tailwind 通过 font-sans/font-mono 引用
 */
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { LayoutClient } from "@/components/layout/LayoutClient";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Football Betting — 世界杯竞猜 DApp",
  description: "基于区块链的去中心化足球竞猜平台，使用 USDT 投注，智能合约自动结算。",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1.0,
  maximumScale: 1.0,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased overflow-x-hidden`}>
      <body className="min-h-full flex flex-col text-slate-900">
        <LayoutClient>{children}</LayoutClient>
      </body>
    </html>
  );
}
