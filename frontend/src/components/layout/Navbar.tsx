"use client";

import { useState, useEffect } from "react";
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

export function Navbar() {
  const { t, lang, setLang } = useLang();
  const pathname = usePathname();
  const { address, isConnected } = useAccount();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

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
    { href: "/", label: t("nav.home") },
    { href: "/matches", label: t("nav.matches") },
    { href: "/my-bets", label: t("nav.myBets") },
    { href: "/leaderboard", label: t("nav.leaderboard") },
  ];

  const linkCls = (active: boolean) =>
    `block px-3 py-2.5 rounded-lg text-sm font-medium transition ${
      active ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50"
    }`;

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
                {link.label}
              </Link>
            ))}
            {mounted && isConnected && !isAdminLoading && isAdmin && (
              <Link href="/admin" className={desktopLinkCls(pathname === "/admin")}>
                {t("nav.admin")}
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
          <button
            onClick={() => setMenuOpen(true)}
            className="sm:hidden p-1.5 -mr-1 text-slate-600"
            aria-label={t("nav.menu")}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-[60] sm:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-64 bg-white shadow-2xl flex flex-col">
            {/* Drawer header */}
            <div className="flex items-center justify-between px-4 h-14 border-b border-slate-200 shrink-0">
              <span className="font-bold text-blue-600 text-base">{t("app.title")}</span>
              <button onClick={() => setMenuOpen(false)} className="p-2 text-slate-400 hover:text-slate-700">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* User info */}
            {mounted && isConnected && (
              <div className="px-4 py-3 border-b border-slate-100 shrink-0">
                {usdtBalance !== undefined && (
                  <p className="text-sm text-green-700 font-semibold mb-1">
                    {formatUSDT(usdtBalance as bigint, 4)} USDT
                  </p>
                )}
                {!isAdminLoading && (
                  <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    isAdmin ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-500"
                  }`}>
                    {isAdmin ? t("role.admin") : t("role.user")}
                  </span>
                )}
              </div>
            )}

            {/* Nav links */}
            <nav className="flex-1 overflow-y-auto overscroll-contain px-2 py-3">
              {navItems.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={linkCls(pathname === link.href)}
                >
                  {link.label}
                </Link>
              ))}
              {mounted && isConnected && !isAdminLoading && isAdmin && (
                <Link
                  href="/admin"
                  className={`${linkCls(pathname === "/admin")} mt-1 ${
                    pathname === "/admin" ? "bg-red-50 text-red-700" : ""
                  }`}
                >
                  {t("nav.admin")}
                </Link>
              )}
            </nav>
          </div>
        </div>
      )}
    </nav>
  );
}
