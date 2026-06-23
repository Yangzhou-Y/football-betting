"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { type ReactNode } from "react";

/**
 * 页面切换动画 — 卡片级逐一下滑
 */
export function PageTransition({ children, refreshKey = 0, accountKey }: {
  children: ReactNode; refreshKey?: number; accountKey?: string;
}) {
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  const trigger = `${pathname}-${refreshKey}-${accountKey || ""}`;

  useEffect(() => {
    setVisible(false);
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, [trigger]);

  useEffect(() => {
    if (!visible || !ref.current) return;

    const root = ref.current.children[0] as HTMLElement | undefined;
    if (!root) return;

    const blocks: HTMLElement[] = [];
    const collect = (parent: HTMLElement) => {
      for (const child of Array.from(parent.children) as HTMLElement[]) {
        const tag = child.tagName.toLowerCase();
        if (/^h[1-6]$/.test(tag)) continue;
        if (child.classList.contains("grid") || child.className.includes("grid ")) {
          for (const gc of Array.from(child.children) as HTMLElement[]) blocks.push(gc);
        } else {
          blocks.push(child);
        }
      }
    };
    collect(root);

    if (blocks.length === 0) {
      root.style.animation = "pageEnter 0.3s ease-out both";
      return () => { root.style.animation = ""; };
    }

    const delayStep = 60;
    blocks.forEach((el, i) => {
      el.style.animation = `pageEnter 0.3s ease-out both`;
      el.style.animationDelay = `${i * delayStep}ms`;
    });

    return () => {
      blocks.forEach((el) => {
        el.style.animation = "";
        el.style.animationDelay = "";
      });
    };
  }, [visible, pathname]);

  return (
    <div ref={ref} style={{ opacity: visible ? 1 : 0 }}>
      {children}
    </div>
  );
}
