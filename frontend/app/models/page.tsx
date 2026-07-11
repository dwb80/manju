"use client";

/**
 * 模型中心独立页面
 *
 * 功能：
 * - 展示和管理所有AI模型（聊天、图片、视频）
 * - 模型配置完整 CRUD（新建、编辑、删除、查看详情）
 * - 配置模型API（endpoint、method、状态查询endpoint）
 * - 能力标签、参数配置、价格信息管理
 * - 设置默认模型、启用/禁用模型
 *
 * 页面布局：
 * - 顶部：页面标题 + 返回首页 + 模型类型统计概览
 * - 主体：ModelCenter 组件（列表 + 搜索 + 类型切换）
 * - 弹窗：ModelFormDialog（新建/编辑表单，含API配置）
 *
 * @module models/page
 */

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, LayoutDashboard, Settings2 } from "lucide-react";
import {
  ModelCenter,
  type ModelInfo,
} from "@/components/dashboard/model-center";
import {
  ModelFormDialog,
  type ModelFormData,
} from "@/components/model/model-form-dialog";
import { useModuleCrud } from "@/hooks/use-module-crud";
import { clearApiCache } from "@/lib/api-client";

/**
 * 将表单数据转换为后端 API 请求体
 */
function formToApiData(form: ModelFormData) {
  const isChat = form.type === "chat";
  const isImage = form.type === "image";
  const isVideo = form.type === "video";

  // 解析逗号分隔的列表字段
  const parseList = (s: string): string[] =>
    s.split(",").map((x) => x.trim()).filter(Boolean);

  // 构建参数对象（按模型类型）
  const parameters: ModelInfo["parameters"] = {};
  if (isChat) {
    if (form.maxContext) parameters.maxContext = Number(form.maxContext);
    if (form.maxTokens) parameters.maxTokens = Number(form.maxTokens);
    if (form.defaultTemperature) parameters.defaultTemperature = Number(form.defaultTemperature);
  }
  if (isImage) {
    if (form.supportedSizes) parameters.supportedSizes = parseList(form.supportedSizes);
    if (form.defaultSteps) parameters.defaultSteps = Number(form.defaultSteps);
    if (form.responseFormats) parameters.responseFormats = parseList(form.responseFormats);
  }
  if (isVideo) {
    if (form.supportedRatios) parameters.supportedRatios = parseList(form.supportedRatios);
    if (form.maxDuration) parameters.maxDuration = Number(form.maxDuration);
    if (form.maxFrames) parameters.maxFrames = Number(form.maxFrames);
  }

  // 构建价格对象
  const pricing: ModelInfo["pricing"] = { standard: {}, current: {} };
  if (isChat) {
    if (form.priceStandardInput || form.priceStandardOutput) {
      pricing.standard.chat = { input: form.priceStandardInput, output: form.priceStandardOutput };
    }
    if (form.priceCurrentInput || form.priceCurrentOutput) {
      pricing.current.chat = { input: form.priceCurrentInput, output: form.priceCurrentOutput };
    }
  }
  if (isImage) {
    if (form.priceStandardImage) pricing.standard.image = form.priceStandardImage;
    if (form.priceCurrentImage) pricing.current.image = form.priceCurrentImage;
  }
  if (isVideo) {
    if (form.priceStandardVideo) pricing.standard.video = form.priceStandardVideo;
    if (form.priceCurrentVideo) pricing.current.video = form.priceCurrentVideo;
  }

  // 构建API配置
  const api_config: ModelInfo["api_config"] = {
    endpoint: form.apiEndpoint,
    method: form.apiMethod,
    ...(form.apiStatusEndpoint ? { statusEndpoint: form.apiStatusEndpoint } : {}),
  };

  // 构建性能指标
  const performance: ModelInfo["performance"] = {
    avgResponseTime: form.avgResponseTime ? Number(form.avgResponseTime) : 0,
    successRate: form.successRate ? Number(form.successRate) : 0,
    concurrency: form.concurrency ? Number(form.concurrency) : 0,
  };

  // 构建参数规则（视频模型遵循 8n+1 帧数约束）
  const parameter_rules: ModelInfo["parameter_rules"] = isVideo
    ? { num_frames: { min: 1, max: Number(form.maxFrames) || 441, rule: "8n+1", description: "帧数必须小于等于441，且遵循8n+1规则" } }
    : {};

  return {
    name: form.name,
    type: form.type,
    description: form.description,
    version: form.version,
    provider: form.provider,
    isDefault: form.isDefault,
    is_enabled: form.is_enabled,
    api_config,
    capabilities: form.capabilities,
    parameters,
    parameter_rules,
    pricing,
    performance,
    tags: parseList(form.tags),
  };
}

/**
 * 模型中心页面组件
 */
export default function ModelsPage() {
  const router = useRouter();

  // 使用通用 CRUD hook 管理模型数据
  const { items: models, isLoading, error, load, create, update, remove, refresh } =
    useModuleCrud<ModelInfo>("/api/models");

  // 表单对话框状态
  const [formOpen, setFormOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<ModelInfo | null>(null);
  const [saving, setSaving] = useState(false);

  // 删除确认状态
  const [deleteTarget, setDeleteTarget] = useState<ModelInfo | null>(null);

  /** 打开新建模型对话框 */
  const handleCreate = useCallback(() => {
    setEditingModel(null);
    setFormOpen(true);
  }, []);

  /** 打开编辑模型对话框 */
  const handleEdit = useCallback((model: ModelInfo) => {
    setEditingModel(model);
    setFormOpen(true);
  }, []);

  /** 保存模型（新建或编辑） */
  const handleSave = useCallback(
    async (form: ModelFormData) => {
      setSaving(true);
      try {
        const apiData = formToApiData(form);
        if (editingModel) {
          await update(editingModel.id, apiData);
        } else {
          await create(apiData);
        }
        setFormOpen(false);
        setEditingModel(null);
        refresh();
      } catch (err) {
        console.error("保存模型失败:", err);
        alert(err instanceof Error ? err.message : "保存失败");
      } finally {
        setSaving(false);
      }
    },
    [editingModel, update, create, refresh]
  );

  /** 删除模型 */
  const handleDelete = useCallback(
    async (model: ModelInfo) => {
      if (!confirm(`确定删除模型「${model.name}」吗？此操作不可撤销。`)) return;
      try {
        await remove(model.id);
        refresh();
      } catch (err) {
        console.error("删除模型失败:", err);
        alert(err instanceof Error ? err.message : "删除失败");
      }
    },
    [remove, refresh]
  );

  /** 设置默认模型 */
  const handleSetDefault = useCallback(
    async (modelId: string) => {
      try {
        const response = await fetch(`/api/models/${modelId}/set-default`, { method: "POST" });
        const result = await response.json();
        if (!response.ok || result.code !== 0) {
          throw new Error(result.message || "设置默认失败");
        }
        refresh();
      } catch (err) {
        console.error("设置默认模型失败:", err);
        alert(err instanceof Error ? err.message : "设置失败");
      }
    },
    [refresh]
  );

  /** 切换模型启用状态 */
  const handleToggleEnabled = useCallback(
    async (modelId: string, enabled: boolean) => {
      try {
        const response = await fetch(`/api/models/${modelId}/toggle`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled }),
        });
        const result = await response.json();
        if (!response.ok || result.code !== 0) {
          throw new Error(result.message || "切换状态失败");
        }
        refresh();
      } catch (err) {
        console.error("切换模型状态失败:", err);
        alert(err instanceof Error ? err.message : "操作失败");
      }
    },
    [refresh]
  );

  /** 刷新数据 */
  const handleRefresh = useCallback(() => {
    clearApiCache("/api/models");
    load();
  }, [load]);

  /** 返回首页 */
  const goBackToHome = () => router.push("/");

  // 统计信息计算
  const chatModels = models.filter((m) => m.type === "chat");
  const imageModels = models.filter((m) => m.type === "image");
  const videoModels = models.filter((m) => m.type === "video");

  return (
    <main className="min-h-screen bg-[#181818] text-[#ececec]">
      {/* 页面头部 */}
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[#181818]/95 px-6 py-4 backdrop-blur">
        <div className="flex items-center justify-between">
          {/* 左侧：返回按钮和标题 */}
          <div className="flex items-center gap-4">
            <button
              onClick={goBackToHome}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-[#888] transition-colors hover:bg-white/10 hover:text-white"
              aria-label="返回首页"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>返回首页</span>
            </button>
            <div className="h-4 w-px bg-white/20" />
            <nav className="flex items-center gap-2 text-sm text-[#888]">
              <button onClick={goBackToHome} className="flex items-center gap-1 hover:text-white">
                <LayoutDashboard className="h-3 w-3" />
                <span>首页</span>
              </button>
              <span className="text-white/40">/</span>
              <span className="text-white font-medium">模型中心</span>
            </nav>
          </div>

          {/* 右侧：页面信息 */}
          <div className="flex items-center gap-6 text-xs text-[#888]">
            <div className="flex items-center gap-3">
              <Settings2 className="h-4 w-4" />
              <span>配置管理</span>
            </div>
            <div>共 {models.length} 个模型</div>
          </div>
        </div>

        {/* 页面标题和描述 */}
        <div className="mt-4">
          <h1 className="text-2xl font-bold text-white">模型中心</h1>
          <p className="mt-1 text-sm text-[#888]">
            管理AI模型配置、API接口、能力标签和价格信息，支持模型注册、编辑、删除和启用/禁用
          </p>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* 模型类型统计概览 */}
        <div className="mt-4 grid grid-cols-3 gap-4">
          {/* 聊天模型统计 */}
          <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <svg className="h-4 w-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">聊天模型</div>
                  <div className="text-xs text-blue-300">
                    {chatModels.filter((m) => m.is_enabled).length} 个可用
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-white">{chatModels.length}</div>
              </div>
            </div>
          </div>

          {/* 图片模型统计 */}
          <div className="rounded-lg border border-purple-500/20 bg-purple-500/10 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <svg className="h-4 w-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">图片模型</div>
                  <div className="text-xs text-purple-300">
                    {imageModels.filter((m) => m.is_enabled).length} 个可用
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-white">{imageModels.length}</div>
              </div>
            </div>
          </div>

          {/* 视频模型统计 */}
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <svg className="h-4 w-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">视频模型</div>
                  <div className="text-xs text-amber-300">
                    {videoModels.filter((m) => m.is_enabled).length} 个可用
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-white">{videoModels.length}</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 页面主体：模型中心组件 */}
      <section className="px-6 py-6">
        <ModelCenter
          models={models}
          isLoading={isLoading}
          onRefresh={handleRefresh}
          onCreate={handleCreate}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onSetDefault={handleSetDefault}
          onToggleEnabled={handleToggleEnabled}
        />
      </section>

      {/* 模型表单对话框 */}
      <ModelFormDialog
        isOpen={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingModel(null);
        }}
        onSave={handleSave}
        editingModel={editingModel}
        isLoading={saving}
      />

      {/* 页面底部信息 */}
      <footer className="border-t border-white/10 px-6 py-4 text-xs text-[#666]">
        <div className="flex items-center justify-between">
          <div>数据来源：后端API接口 /api/models</div>
          <div>加载状态：{isLoading ? "加载中" : "已就绪"}</div>
        </div>
      </footer>
    </main>
  );
}
