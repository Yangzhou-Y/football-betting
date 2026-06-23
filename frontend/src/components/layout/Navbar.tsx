"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useMemo } from "react";
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

  const NAV_LINKS = useMemo(() => [
    { href: "/", label: t("nav.home") },
    { href: "/matches", label: t("nav.matches") },
    { href: "/my-bets", label: t("nav.myBets") },
    { href: "/leaderboard", label: t("nav.leaderboard") },
  ], [t]);
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

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-3 h-14 flex items-center justify-between">
        {/* Logo + 导航链接 */}
        <div className="flex items-center gap-2 sm:gap-4">
          <Link href="/" className="text-base sm:text-lg font-bold text-blue-600 whitespace-nowrap">
            {t("app.title")}
          </Link>
          <div className="hidden sm:flex items-center gap-0.5">
            {NAV_LINKS.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-2 py-1.5 rounded-md text-xs sm:text-sm transition ${
                    active
                      ? "bg-blue-100 text-blue-700 font-medium"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
            {mounted && isConnected && (
              <Link
                href="/admin"
                className={`px-2 py-1.5 rounded-md text-xs sm:text-sm transition ${
                  pathname === "/admin"
                    ? "bg-red-100 text-red-700 font-medium"
                    : "text-slate-500 hover:text-red-600 hover:bg-red-50"
                }`}
              >
                {t("nav.admin")}
              </Link>
            )}
          </div>
        </div>

        {/* 钱包连接 + 标识 */}
        <div className="flex items-center gap-1.5">
          <ConnectButton
            showBalance={false}
            accountStatus="address"
            chainStatus="icon"
          />
          {mounted && isConnected && usdtBalance !== undefined && (
            <span className="hidden md:inline text-xs text-green-800 bg-green-100 px-2 py-0.5 rounded-lg border border-green-300 font-semibold whitespace-nowrap">
              {formatUSDT(usdtBalance as bigint)} USDT
            </span>
          )}
          {mounted && isConnected && !isAdminLoading && (
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap ${
                isAdmin
                  ? "bg-red-100 text-red-600"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {isAdmin ? t("role.admin") : t("role.user")}
            </span>
          )}
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as "zh" | "en")}
            className="px-1.5 py-0.5 rounded text-xs border border-slate-200 text-slate-500 bg-white cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            <option value="zh">中</option>
            <option value="en">EN</option>
          </select>
        </div>
      </div>
    </nav>
  );
}
