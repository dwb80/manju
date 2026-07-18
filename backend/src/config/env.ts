/**
 * @file env.ts
 * @description 环境配置模块。负责：
 *   - 加载项目根目录的 .env 文件到 process.env
 *   - 汇总当前运行配置（API Key 状态、Base URL 等）
 * 
 * 所有 AI 能力必须通过真实 API（AGNES_API_KEY），无 Key 时相关功能会降级或报错。
 */

import { readFileSync } from "node:fs";
import path from "node:path";

export interface RuntimeConfig {
  agnesApiKeyConfigured: boolean;
  agnesApiBaseUrl: string;
}

/** 读取项目根目录的 .env 文件，并把其中变量补充到 process.env。 */
export function loadEnv(root = process.cwd()): void {
  const file = path.join(root, ".env");
  let content = "";
  try {
    content = readFileSync(file, "utf8");
  } catch {
    return;
  }

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index <= 0) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] ??= value;
  }
}

/**
 * getRuntimeConfig - 获取当前运行配置
 * @returns {RuntimeConfig} 运行配置对象（API Key 状态、Base URL）
 */
export function getRuntimeConfig(): RuntimeConfig {
  const hasKey = Boolean(process.env.AGNES_API_KEY);
  const rawBaseUrl = process.env.AGNES_API_BASE_URL ?? "https://apihub.agnes-ai.com";
  const agnesApiBaseUrl = rawBaseUrl === "https://agnes-ai.com/api" || rawBaseUrl === "https://www.agnes-ai.com/api"
    ? "https://apihub.agnes-ai.com"
    : rawBaseUrl;
  return {
    agnesApiKeyConfigured: hasKey,
    agnesApiBaseUrl,
  };
}
