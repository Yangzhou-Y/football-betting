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
