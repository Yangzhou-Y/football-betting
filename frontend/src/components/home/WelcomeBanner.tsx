"use client";

import { useT } from "@/lib/i18n";
import { useConnectModal } from "@rainbow-me/rainbowkit";

/** 新用户引导横幅 — 未连接钱包时展示产品价值 */

const STEPS = [
  { key: "step1", icon: "🔌" },
  { key: "step2", icon: "⚽" },
  { key: "step3", icon: "🎉" },
];

const FEATURES = [
  { key: "feature1", icon: "🔍" },
  { key: "feature2", icon: "⚡" },
  { key: "feature3", icon: "🌍" },
];

export function WelcomeBanner() {
  const t = useT();
  const { openConnectModal } = useConnectModal();

  return (
    <div className="bg-gradient-to-b from-blue-50 via-white to-white rounded-2xl border border-blue-100 shadow-sm overflow-hidden">
      {/* Hero */}
      <div className="text-center px-4 pt-8 pb-6 sm:pt-12 sm:pb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-3">
          {t("onboarding.title")}
        </h1>
        <p className="text-sm sm:text-base text-slate-500 max-w-md mx-auto leading-relaxed">
          {t("onboarding.subtitle")}
        </p>
      </div>

      {/* Steps */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 px-4 sm:px-6 pb-6">
        {STEPS.map((step, i) => (
          <div key={step.key} className="bg-white rounded-xl p-4 border border-slate-200 text-center">
            <span className="text-2xl">{step.icon}</span>
            <p className="text-xs text-slate-400 mt-1">{t("onboarding.step")} {i + 1}</p>
            <p className="text-sm font-semibold text-slate-700 mt-1">{t(`onboarding.${step.key}`)}</p>
            <p className="text-xs text-slate-400 mt-1">{t(`onboarding.${step.key}Desc`)}</p>
          </div>
        ))}
      </div>

      {/* Features */}
      <div className="bg-slate-50 px-4 sm:px-6 py-4 border-t border-slate-100">
        <div className="grid grid-cols-3 gap-2 max-w-md mx-auto text-center">
          {FEATURES.map((feat) => (
            <div key={feat.key}>
              <span className="text-lg">{feat.icon}</span>
              <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5">{t(`onboarding.${feat.key}`)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="px-4 pb-8 sm:pb-10 pt-4 text-center">
        <button
          onClick={openConnectModal}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm sm:text-base hover:bg-blue-700 shadow-lg shadow-blue-200 transition"
        >
          🔌 {t("onboarding.cta")}
        </button>
        <p className="text-[10px] text-slate-400 mt-2">{t("onboarding.ctaHint")}</p>
      </div>
    </div>
  );
}
