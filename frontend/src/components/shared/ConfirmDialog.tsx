/**
 * ============================================================================
 * ConfirmDialog — 通用确认弹窗组件
 * ============================================================================
 *
 * 【使用场景】
 *   所有需要用户二次确认的操作（投注、取消投注、领取奖励、删除赛事等）
 *   都通过此组件弹窗确认。避免误触导致的不可逆链上操作。
 *
 * 【渲染方式】
 *   使用 createPortal 将弹窗渲染到 document.body 下（而非组件所在 DOM 位置），
 *   确保弹窗始终在最顶层（z-index: 99999），不受父级 overflow/z-index 影响。
 *
 * 【可配置项】
 *   confirmVariant: "blue"（投注）/ "green"（领奖）/ "red"（删除/取消）
 *   loading: true 时按钮禁用 + 显示"处理中..."
 *   children: 弹窗正文内容（可自定义 JSX）
 *
 * 【关闭方式】
 *   ① 点击取消按钮 → onCancel()
 *   ② 点击背景遮罩 → onCancel()
 *   ③ 点击确认按钮 → onConfirm()（不自动关闭弹窗，由父组件控制）
 *   ④ 点击弹窗内部 → 阻止冒泡（e.stopPropagation），不关闭
 */
"use client";

import { type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/lib/i18n";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  confirmVariant?: "blue" | "green" | "red";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open, title, children, confirmLabel, confirmVariant = "blue", loading, onConfirm, onCancel,
}: ConfirmDialogProps) {
  const t = useT();
  if (!open) return null;

  const btnColor = confirmVariant === "blue" ? "bg-blue-600 hover:bg-blue-700"
    : confirmVariant === "green" ? "bg-green-600 hover:bg-green-700"
    : "bg-red-600 hover:bg-red-700";

  return createPortal(
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[99999] p-4" onClick={onCancel}>
      <div className="bg-white rounded-xl p-6 shadow-xl max-w-sm w-full mx-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-lg mb-3 text-center">{title}</h3>
        <div className="text-sm text-slate-600 mb-5 leading-relaxed">{children}</div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 disabled:opacity-50 transition"
          >
            {t("confirm.cancel")}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 py-2.5 text-white rounded-lg font-medium disabled:opacity-50 transition ${btnColor}`}
          >
            {loading ? t("common.processing") : (confirmLabel || t("confirm.confirm"))}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
