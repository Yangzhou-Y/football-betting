import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  // 代理 Conflux eSpace RPC 请求，避免浏览器 CORS 限制
  async rewrites() {
    return [
      {
        source: "/rpc/conflux-testnet",
        destination: "https://evmtestnet.confluxrpc.com",
      },
    ];
  },
};

export default nextConfig;
