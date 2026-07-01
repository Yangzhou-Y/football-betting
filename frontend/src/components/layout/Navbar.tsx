"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useReadContract } from "wagmi";
import { useMounted } from "@/hooks/useMounted";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useDeploymentConfig } from "@/lib/config";
import MockERC20ABI from "@/lib/abi/MockERC20.json";
import { formatUSDT } from "@/lib/utils";
import { useLang } from "@/lib/i18n";

/**
 * ============================================================================
 * Navbar — 顶部导航栏（桌面端横排导航 + 移动端底部 Tab Bar）
 * ============================================================================
 *
 * 【响应式策略】
 *   桌面端（sm+）：横排导航链接 + USDT 余额 + 角色标签 + 语言切换 + ConnectButton
 *   移动端（<sm）：底部固定 Tab Bar，一键直达各页面
 *
 * 【权限感知】
 *   非管理员用户看不到"管理"菜单项，管理员看到的是红色高亮的管理入口。
 *   通过 useIsAdmin() 自动检测，无需手动配置。
 *
 * 【USDT 余额显示】
 *   只读查询 usdt.balanceOf(user)，钱包连接后自动显示在导航栏右侧。
 *   注意：此处连接的是 MockERC20 的 ABI，因为 USDT 合约也实现了相同的
 *   balanceOf 接口（ERC-20 标准）。
 */
export function Navbar() {
  const { t, lang, setLang } = useLang();
  const pathname = usePathname();
  const { address, isConnected } = useAccount();

  const mounted = useMounted();
  const { isAdmin, isLoading: isAdminLoading } = useIsAdmin();
  const { usdtAddress, isReady, chainId } = useDeploymentConfig();
  const { data: usdtBalance } = useReadContract({
    address: usdtAddress!,
    abi: MockERC20ABI.abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId,
    query: { enabled: isReady && !!usdtAddress && !!address },
  });

  const navItems = [
    { href: "/", label: t("nav.home"), icon: "🏠" },
    { href: "/matches", label: t("nav.matches"), icon: "⚽" },
    { href: "/my-bets", label: t("nav.myBets"), icon: "📋" },
    { href: "/leaderboard", label: t("nav.leaderboard"), icon: "🏆" },
  ];

  const desktopLinkCls = (active: boolean) =>
    `px-2 py-1.5 rounded-md text-xs sm:text-sm transition ${
      active ? "bg-blue-100 text-blue-700 font-medium" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
    }`;

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-2 sm:px-3 h-14 flex items-center justify-between">
        {/* Left */}
        <div className="flex items-center gap-1 sm:gap-2 min-w-0">
          <Link href="/" className="text-sm sm:text-lg font-bold text-blue-600 whitespace-nowrap shrink-0">
            {t("app.title")}
          </Link>
          <div className="hidden sm:flex items-center gap-0.5">
            {navItems.map((link) => (
              <Link key={link.href} href={link.href} className={desktopLinkCls(pathname === link.href)}>
                <span className="mr-0.5">{link.icon}</span>{link.label}
              </Link>
            ))}
            {mounted && isConnected && !isAdminLoading && isAdmin && (
              <Link href="/admin" className={desktopLinkCls(pathname === "/admin")}>
                <span className="mr-0.5">⚙</span>{t("nav.admin")}
              </Link>
            )}
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-0.5 sm:gap-1.5 shrink-0">
          {mounted && isConnected && usdtBalance !== undefined && (
            <span className="hidden sm:inline text-xs text-green-800 bg-green-100 px-2 py-0.5 rounded-lg border border-green-300 font-semibold whitespace-nowrap">
              {formatUSDT(usdtBalance as bigint, 4)} USDT
            </span>
          )}
          {mounted && isConnected && !isAdminLoading && (
            <span className={`hidden sm:inline text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap ${
              isAdmin ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-500"
            }`}>
              {isAdmin ? t("role.admin") : t("role.user")}
            </span>
          )}
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as "zh" | "en")}
            className="px-1 py-0.5 rounded text-xs border border-slate-200 text-slate-500 bg-white cursor-pointer"
          >
            <option value="zh">中</option>
            <option value="en">EN</option>
          </select>
          <div className="max-sm:[&_[data-rk]]:!max-w-[120px]">
            <ConnectButton showBalance={false} accountStatus="address" chainStatus="none" />
          </div>
        </div>
      </div>

      {/* Mobile bottom tab bar */}
      <div className="sm:hidden fixed bottom-0 inset-x-0 z-50 bg-white/95 backdrop-blur border-t border-slate-200 pb-[env(safe-area-inset-bottom,0px)]">
        <div className="flex items-center justify-around h-14 max-w-lg mx-auto">
          {navItems.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex flex-col items-center justify-center gap-0.5 w-full h-full transition ${
                  active ? "text-blue-600" : "text-slate-400 hover:text-slate-600"
                }`}
              >
                <span className="text-lg leading-none">{link.icon}</span>
                <span className={`text-[10px] font-medium leading-none ${active ? "text-blue-600" : ""}`}>
                  {link.label}
                </span>
              </Link>
            );
          })}
          {mounted && isConnected && !isAdminLoading && isAdmin && (
            <Link
              href="/admin"
              className={`flex flex-col items-center justify-center gap-0.5 w-full h-full transition ${
                pathname === "/admin" ? "text-red-600" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <span className="text-lg leading-none">⚙</span>
              <span className={`text-[10px] font-medium leading-none ${pathname === "/admin" ? "text-red-600" : ""}`}>
                {t("nav.admin")}
              </span>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
