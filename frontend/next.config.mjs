import path from "node:path";
import { fileURLToPath } from "node:url";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendUrl = process.env.AGNES_BACKEND_URL || "http://127.0.0.1:3000";

/** @type {import('next').NextConfig} */
const createNextConfig = (phase) => ({
  devIndicators: false,
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next" : ".next-build",
  outputFileTracingRoot: __dirname,
  webpack(config) {
    config.watchOptions = {
      ...(config.watchOptions ?? {}),
      ignored: /[\\/]node_modules[\\/]|[\\/]\.git[\\/]|[\\/]\.next[\\/]|[\\/]\.next-build[\\/]|[\\/]test-results[\\/]|[\\/]playwright-report[\\/]/,
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
