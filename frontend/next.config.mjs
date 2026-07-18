import path from "node:path";
import { fileURLToPath } from "node:url";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendUrl = process.env.AGNES_BACKEND_URL || "http://127.0.0.1:3000";

/** @type {import('next').NextConfig} */
const createNextConfig = (phase) => ({
  devIndicators: false,
  distDir: process.env.NEXT_DIST_DIR || (phase === PHASE_DEVELOPMENT_SERVER ? ".next" : ".next-build"),
  outputFileTracingRoot: __dirname,
  webpack(config) {
    config.watchOptions = {
      ...(config.watchOptions ?? {}),
      // webpack watchOptions 要求 ignored 是 string/RegExp/数组形式。
      // 注意：这里不能用反斜杠绝对路径（如 D:\），glob 引擎会把它当成正则字符，
      //       拼接出来的 RegExp 会在 Node 24 上抛 "Unmatched ')'"。
      //       改用纯目录名通配即可。
      ignored: [
        "**/node_modules/**",
        "**/.git/**",
        "**/.next/**",
        "**/.next-build/**",
        "**/test-results/**",
        "**/playwright-report/**",
        // 系统目录（不需要写盘符，绝对路径含 \ 在 glob 里会出错）
        "**/System Volume Information/**",
        "**/\$RECYCLE.BIN/**",
        "**/Thumbs.db",
        "**/desktop.ini",
      ],
      // 减少高频变化触发的重编译
      aggregateTimeout: 300,
    };
    return config;
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: "/media/:path*",
        destination: `${backendUrl}/media/:path*`,
      },
    ];
  },
});

export default createNextConfig;
