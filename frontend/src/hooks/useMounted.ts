"use client";

import { useEffect, useState } from "react";

/**
 * 解决 SSR hydration 问题的通用 hook
 * 服务端渲染时 mounted=false，客户端挂载后为 true。
 * 搭配条件渲染可避免 useAccount() 等服务端/客户端状态不一致导致的 hydration error。
 */
export function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
