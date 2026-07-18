"use client";

/**
 * 系统管理 · 个人设置（评审优化 P2）
 *
 * 包含：
 * - 个人信息（用户名 / 邮箱）
 * - 偏好设置（主题 / 字号 / 默认模型 / 默认尺寸 / 默认比例）
 * - API Key 管理（provider / key / base url）
 *
 * 复用新公共组件（StandalonePageHeader / StatsOverview / Alert），
 * 与 notify() 工具配合（替代误用 toast.success）。
 */

import { useEffect, useState } from "react";
import {
  Settings as SettingsIcon,
  Save,
  Key,
  User,
  Eye,
  EyeOff,
  Copy,
  Trash2,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import {
  StandalonePageHeader,
  Alert,
} from "@/components/layout";
import { AdminPanels } from "@/components/admin/admin-panels";
import { createLogger } from "@/lib/logger";
import { notify } from "@/lib/notify";
import { api } from "@/lib/api-client";
import { AdminRouteGuard } from "@/components/auth/admin-route-guard";

// 模块级 logger
const log = createLogger("settings-page");

// Settings API 响应
interface Settings {
  theme?: "light" | "dark" | "system";
  language?: "zh-CN" | "en-US";
  fontSize?: "small" | "medium" | "large";
  defaultChatModel?: string;
  defaultImageSize?: string;
  defaultVideoRatio?: string;
  apiKey?: string;
  apiKeyConfigured?: boolean;
  clearApiKey?: boolean;
  apiProvider?: "openai" | "agnes" | "claude" | "custom";
  apiBaseUrl?: string;
  userName?: string;
  userEmail?: string;
}

const DEFAULT_SETTINGS: Settings = {
  theme: "dark",
  language: "zh-CN",
  fontSize: "medium",
  defaultChatModel: "gpt-4",
  defaultImageSize: "1024x1024",
  defaultVideoRatio: "16:9",
  apiProvider: "agnes",
  userName: "",
  userEmail: "",
};

function SettingsContent() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await api<Settings>("/api/settings", { cache: "no-store" });
      setSettings({ ...DEFAULT_SETTINGS, ...data });
      log.info("load settings success");
    } catch (err) {
      log.error("load settings failed", { error: (err as Error).message });
      notify.error("加载设置失败", (err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  async function handleSave() {
    setSaving(true);
    try {
      const data = await api<Settings>("/api/settings", {
        method: "PUT",
        body: JSON.stringify(settings),
      });
      log.info("save settings success");
      notify.success("设置已保存", "个性化配置已生效");
      setSettings({ ...DEFAULT_SETTINGS, ...data, apiKey: "", clearApiKey: false });
    } catch (err) {
      log.error("save settings failed", { error: (err as Error).message });
      notify.error("保存失败", (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    if (!confirm("确定重置为默认设置？")) return;
    setSettings(DEFAULT_SETTINGS);
    log.debug("reset settings to defaults");
    notify.info("已重置为默认设置（请保存以生效）");
  }

  function handleClearApiKey() {
    if (!settings.apiKey && !settings.apiKeyConfigured) return;
    if (!confirm("确定清除 API Key？清除后需要重新配置。")) return;
    update("apiKey", "");
    update("apiKeyConfigured", false);
    update("clearApiKey", true);
    log.debug("clear api key requested");
    notify.warn("API Key 已清空（请保存以生效）");
  }

  function handleCopyApiKey() {
    if (!settings.apiKey) {
      notify.warn("当前没有 API Key 可复制");
      return;
    }
    navigator.clipboard.writeText(settings.apiKey)
      .then(() => notify.success("已复制到剪贴板"))
      .catch(() => notify.error("复制失败"));
  }

  // 脱敏显示 api key
  const maskedApiKey = settings.apiKey
    ? settings.apiKey.length > 8
      ? `${settings.apiKey.slice(0, 4)}${"*".repeat(settings.apiKey.length - 8)}${settings.apiKey.slice(-4)}`
      : "****"
    : "";

  return (
    <main className="min-h-screen bg-[#181818] text-[#ececec]">
      <StandalonePageHeader
        title="系统管理"
        description="个人偏好与 API Key 管理"
        breadcrumbs={["首页", "系统管理"]}
        extraRight={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-white/10 bg-[#1a1a1a] px-2 text-xs text-[#aaa] hover:text-white"
            >
              <RotateCcw className="h-3 w-3" />
              重置
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex h-7 items-center gap-1 rounded-md bg-emerald-500 px-2 text-xs text-white hover:bg-emerald-400 disabled:opacity-50"
            >
              <Save className="h-3 w-3" />
              {saving ? "保存中..." : "保存设置"}
            </button>
          </div>
        }
      />

      <div className="px-6 py-4 space-y-6">
        {loading && (
          <Alert tone="info" title="加载中">
            正在读取系统设置…
          </Alert>
        )}

        {/* === 个人信息 === */}
        <section className="rounded-lg border border-white/10 bg-[#1a1a1a] p-5">
          <div className="mb-4 flex items-center gap-2">
            <User className="h-4 w-4 text-emerald-400" />
            <h2 className="text-sm font-medium text-white">个人信息</h2>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-[#888]">用户名</label>
              <input
                value={settings.userName ?? ""}
                onChange={(e) => update("userName", e.target.value)}
                placeholder="您的显示名"
                className="w-full rounded-md border border-white/10 bg-[#0f0f0f] px-3 py-2 text-sm text-white focus:border-emerald-500/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[#888]">邮箱</label>
              <input
                type="email"
                value={settings.userEmail ?? ""}
                onChange={(e) => update("userEmail", e.target.value)}
                placeholder="your.email@example.com"
                className="w-full rounded-md border border-white/10 bg-[#0f0f0f] px-3 py-2 text-sm text-white focus:border-emerald-500/50 focus:outline-none"
              />
            </div>
          </div>
        </section>

        {/* === API Key === */}
        <section className="rounded-lg border border-white/10 bg-[#1a1a1a] p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-amber-400" />
              <h2 className="text-sm font-medium text-white">API Key 管理</h2>
            </div>
            <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
              <CheckCircle2 className="mr-1 inline h-3 w-3" />
              {settings.apiKeyConfigured ? "已配置（不回显）" : "未配置"}
            </span>
          </div>

          <Alert tone="warn" title="安全提示">
            API Key 仅由本机后端保存，读取接口不会回显。当前版本未接入操作系统密钥库，请保护本机数据目录和系统账号。
          </Alert>

          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-[#888]">API 提供方</label>
                <select
                  value={settings.apiProvider ?? "agnes"}
                  onChange={(e) => update("apiProvider", e.target.value as Settings["apiProvider"])}
                  className="w-full rounded-md border border-white/10 bg-[#0f0f0f] px-3 py-2 text-sm text-white"
                >
                  <option value="agnes">Agnes AI（默认）</option>
                  <option value="openai">OpenAI</option>
                  <option value="claude">Claude</option>
                  <option value="custom">自定义</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#888]">API Base URL</label>
                <input
                  value={settings.apiBaseUrl ?? ""}
                  onChange={(e) => update("apiBaseUrl", e.target.value)}
                  placeholder={
                    settings.apiProvider === "openai"
                      ? "https://api.openai.com/v1"
                      : settings.apiProvider === "claude"
                      ? "https://api.anthropic.com/v1"
                      : "https://apihub.agnes-ai.com/v1"
                  }
                  className="w-full rounded-md border border-white/10 bg-[#0f0f0f] px-3 py-2 text-sm text-white focus:border-emerald-500/50 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs text-[#888]">API Key</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showApiKey ? "text" : "password"}
                    value={settings.apiKey ?? ""}
                    onChange={(e) => {
                      update("apiKey", e.target.value);
                      update("clearApiKey", false);
                    }}
                    placeholder="sk-..."
                    className="w-full rounded-md border border-white/10 bg-[#0f0f0f] px-3 py-2 pr-10 text-sm text-white focus:border-emerald-500/50 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[#888] hover:text-white"
                    aria-label={showApiKey ? "隐藏" : "显示"}
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleCopyApiKey}
                  disabled={!settings.apiKey}
                  className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-[#0f0f0f] px-3 text-xs text-[#aaa] hover:text-white disabled:opacity-40"
                >
                  <Copy className="h-3 w-3" />
                  复制
                </button>
                <button
                  type="button"
                  onClick={handleClearApiKey}
                  disabled={!settings.apiKey && !settings.apiKeyConfigured}
                  className="inline-flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/5 px-3 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-40"
                >
                  <Trash2 className="h-3 w-3" />
                  清除
                </button>
              </div>
              {settings.apiKey && !showApiKey && (
                <p className="mt-1 text-[10px] text-[#666]">
                  当前值：<span className="font-mono text-[#888]">{maskedApiKey}</span>
                </p>
              )}
            </div>
          </div>
        </section>

        {/* === 偏好设置 === */}
        <section className="rounded-lg border border-white/10 bg-[#1a1a1a] p-5">
          <div className="mb-4 flex items-center gap-2">
            <SettingsIcon className="h-4 w-4 text-blue-400" />
            <h2 className="text-sm font-medium text-white">偏好设置</h2>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-[#888]">主题</label>
              <select
                value={settings.theme ?? "dark"}
                onChange={(e) => update("theme", e.target.value as Settings["theme"])}
                className="w-full rounded-md border border-white/10 bg-[#0f0f0f] px-3 py-2 text-sm text-white"
              >
                <option value="dark">深色</option>
                <option value="light">浅色</option>
                <option value="system">跟随系统</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs text-[#888]">语言</label>
              <select
                value={settings.language ?? "zh-CN"}
                onChange={(e) => update("language", e.target.value as Settings["language"])}
                className="w-full rounded-md border border-white/10 bg-[#0f0f0f] px-3 py-2 text-sm text-white"
              >
                <option value="zh-CN">简体中文</option>
                <option value="en-US">English</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs text-[#888]">字号</label>
              <select
                value={settings.fontSize ?? "medium"}
                onChange={(e) => update("fontSize", e.target.value as Settings["fontSize"])}
                className="w-full rounded-md border border-white/10 bg-[#0f0f0f] px-3 py-2 text-sm text-white"
              >
                <option value="small">小</option>
                <option value="medium">中</option>
                <option value="large">大</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs text-[#888]">默认对话模型</label>
              <input
                value={settings.defaultChatModel ?? ""}
                onChange={(e) => update("defaultChatModel", e.target.value)}
                placeholder="例如 gpt-4 / claude-3-opus"
                className="w-full rounded-md border border-white/10 bg-[#0f0f0f] px-3 py-2 text-sm text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-[#888]">默认图片尺寸</label>
              <select
                value={settings.defaultImageSize ?? "1024x1024"}
                onChange={(e) => update("defaultImageSize", e.target.value)}
                className="w-full rounded-md border border-white/10 bg-[#0f0f0f] px-3 py-2 text-sm text-white"
              >
                <option value="1024x1024">1024 × 1024</option>
                <option value="1024x768">1024 × 768</option>
                <option value="768x1024">768 × 1024</option>
                <option value="1152x768">1152 × 768</option>
                <option value="768x1152">768 × 1152</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs text-[#888]">默认视频比例</label>
              <select
                value={settings.defaultVideoRatio ?? "16:9"}
                onChange={(e) => update("defaultVideoRatio", e.target.value)}
                className="w-full rounded-md border border-white/10 bg-[#0f0f0f] px-3 py-2 text-sm text-white"
              >
                <option value="16:9">16:9 横屏</option>
                <option value="9:16">9:16 竖屏</option>
                <option value="1:1">1:1 方形</option>
              </select>
            </div>
          </div>
        </section>

        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-xs text-[#888]">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-400" />
            <span className="text-amber-200">提示</span>
          </div>
          <p className="mt-2 leading-relaxed">
            偏好设置在保存后会在下次启动项目时生效。
            API Key 只会在调用所选 AI Provider 时作为认证信息发送；页面和普通设置接口不会回显已保存密钥。
          </p>
        </div>

        {/* === spec 4.4 系统管理 4 折叠面板（敏感词/平台模板/审计/项目权限） === */}
        <div className="space-y-3">
          <h2 className="px-1 text-xs font-medium uppercase tracking-wider text-[#888]">spec 4.4 · 系统管理面板</h2>
          <AdminPanels />
        </div>
      </div>
    </main>
  );
}

export default function SettingsPage() {
  return <AdminRouteGuard><SettingsContent /></AdminRouteGuard>;
}
