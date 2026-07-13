"use client";

/**
 * 剧本中心 - 主页面组件
 *
 * 定位：剧本分析与资产生成中心
 * 核心流程：导入/创作剧本 → AI分析提取角色/场景/道具文字描述 → 确认后流转到各工厂
 */

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Plus,
  Sparkles,
  Trash2,
  LayoutGrid,
  List as ListIcon,
  Upload,
  BookOpen,
  Tag as TagIcon,
  Info,
  X,
  Loader2,
  CheckCircle,
  ArrowLeft,
  Archive,
  RotateCcw,
  Pencil,
} from "lucide-react";
import { PageContainer, PageCard } from "@/components/layout/page-container";
import {
  ModuleToolbar,
  SearchInput,
  FilterSelect,
  EmptyState,
  Pagination,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { useProjectStore } from "@/lib/stores/project-store";
import {
  listScripts,
  createScript,
  updateScript,
  deleteScript as deleteScriptApi,
  restoreScript as restoreScriptApi,
  purgeScript as purgeScriptApi,
  listDeletedScripts as listDeletedScriptsApi,
  createCharacter,
  createScene,
  createProp,
  createReview,
  listCharacters,
  listScenes,
  listProps,
} from "@/services/module.service";
import { clearApiCache } from "@/lib/api-client";
import { scriptCenterService } from "@/services/script-center.service";
import { ClassificationView } from "@/components/dashboard/script-center";
import type { Script } from "@/lib/module-types";

import { ScriptFormDialog } from "./ScriptFormDialog";
import { AIGenerateDialog } from "./AIGenerateDialog";
import { ScriptImportDialog } from "./ScriptImportDialog";
import { TemplateLibraryDialog } from "./TemplateLibraryDialog";
import { ScriptAnalysisPanel } from "./ScriptAnalysisPanel";
import { ApprovalWorkflowDialog } from "./ApprovalWorkflowDialog";
import { analyzeScriptContent, generateLocalScriptOutline, textToEditorJson } from "./utils";
import type { ViewMode, ExtractedAsset } from "./types";

/** 通用对话框覆盖层组件 */
export function DialogOverlay({
  title,
  children,
  onClose,
  wide,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className={`relative w-full ${wide ? "max-w-5xl" : "max-w-2xl"} max-h-[85vh] mx-4 rounded-lg bg-[#1a1a1a] border border-white/10 flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 对话框头部 */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10 transition-colors"
          >
            <X className="h-5 w-5 text-[#888]" />
          </button>
        </div>
        {/* 对话框内容 */}
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}

async function loadScriptContentForAnalysis(script: Script): Promise<string> {
  let documentText = "";
  try {
    const resp = await fetch(`/api/script-documents/${encodeURIComponent(script.id)}`);
    if (resp.ok) {
      const payload = await resp.json();
      const document = payload?.data ?? payload;
      documentText = editorJsonToPlainText(document?.editor_json);
    }
  } catch (err) {
    console.warn("读取剧本文档正文失败，回退到 description:", err);
  }
  return (documentText || script.description || "").trim();
}

function editorJsonToPlainText(input: unknown): string {
  if (!input) return "";
  let value: any = input;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return value;
    }
  }
  const walk = (node: any): string => {
    if (!node) return "";
    if (typeof node === "string") return node;
    if (typeof node.text === "string") return node.text;
    if (Array.isArray(node.content)) {
      const text = node.content.map(walk).filter(Boolean).join(node.type === "doc" ? "\n" : "");
      return node.type && node.type !== "doc" && node.type !== "text" ? `${text}\n` : text;
    }
    return "";
  };
  return walk(value).replace(/\n{3,}/g, "\n\n").trim();
}

function mergeExtractedAssets(primary: ExtractedAsset[], fallback: ExtractedAsset[]): ExtractedAsset[] {
  const result = [...primary].filter((asset) => asset.name.trim());
  const seen = new Set(result.map((asset) => `${asset.type}:${asset.name.trim()}`));
  for (const asset of fallback) {
    const key = `${asset.type}:${asset.name.trim()}`;
    if (!asset.name.trim() || seen.has(key)) continue;
    seen.add(key);
    result.push({
      ...asset,
      id: `local-${asset.id}-${Date.now()}`,
      confirmed: true,
    });
  }
  return result;
}

export function ScriptsCenterPage({
  initialProjectId,
  initialAction,
}: {
  /** 从项目中心跳转过来时携带的 projectId，组件 mount 时自动选中 */
  initialProjectId?: string;
  /** 自动行为：import = 自动打开导入对话框 */
  initialAction?: string;
} = {}) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  // 对话框状态
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingScript, setEditingScript] = useState<Script | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // 删除确认状态（统一改为软删语义：移到回收站）
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; title: string } | null>(null);

  // 回收站对话框
  const [showRecycleBin, setShowRecycleBin] = useState(false);
  const [deletedScripts, setDeletedScripts] = useState<Script[]>([]);
  const [isRecycleBinLoading, setIsRecycleBinLoading] = useState(false);
  // 回收站确认（恢复 / 彻底删除）操作状态
  const [recycleBinAction, setRecycleBinAction] = useState<{ type: "restore" | "purge"; script: Script } | null>(null);

  // 高级功能对话框状态
  const [showTemplateLibrary, setShowTemplateLibrary] = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);
  const [showAIGenerate, setShowAIGenerate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showApproval, setShowApproval] = useState(false);
  const [selectedScript, setSelectedScript] = useState<Script | null>(null);
  const [isAIGenerating, setIsAIGenerating] = useState(false);

  // 剧本分析状态
  const [extractedAssets, setExtractedAssets] = useState<ExtractedAsset[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeStatus, setAnalyzeStatus] = useState("分析中...");
  const [isTransferring, setIsTransferring] = useState(false);

  // 从 store 获取选中的项目ID
  const storeProjectId = useProjectStore((state) => state.selectedProjectId);
  const setStoreProjectId = useProjectStore((s) => s.setSelectedProjectId);

  // 有效选中项目：URL > store
  const selectedProjectId = initialProjectId || storeProjectId;

  // 根据 selectedProjectId 加载剧本数据
  const [scripts, setScripts] = useState<Script[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const reloadScripts = async () => {
    if (!selectedProjectId) {
      setScripts([]);
      return;
    }
    setIsLoading(true);
    try {
      const data = await listScripts(selectedProjectId);
      setScripts(data as unknown as Script[]);
    } catch (err) {
      console.error("Failed to load scripts:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    reloadScripts();
  }, [selectedProjectId]);

  // 方案 A（软约束）：组件 mount 时根据 URL 参数自动设置项目 + 打开导入
  // - initialProjectId 存在时同步到 store（只一次）
  // - initialAction=import 时，等 listScripts 加载完成且为空则自动打开导入框
  const isInitialMountRef = useRef(true);
  useEffect(() => {
    if (!isInitialMountRef.current) return;
    isInitialMountRef.current = false;
    if (initialProjectId && initialProjectId !== storeProjectId) {
      setStoreProjectId(initialProjectId);
    }
  }, [initialProjectId, storeProjectId, setStoreProjectId]);

  // 自动打开导入框（项目无剧本时）
  useEffect(() => {
    if (initialAction !== "import") return;
    if (!selectedProjectId) return;
    if (isLoading) return;
    if (scripts.length > 0) return; // 已有剧本，不自动开
    setShowImport(true);
  }, [initialAction, selectedProjectId, isLoading, scripts.length]);

  // 筛选剧本列表
  const filteredScripts = useMemo(() => {
    return scripts.filter((script) => {
      const matchesSearch =
        script.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (script.author ?? "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = !statusFilter || script.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [scripts, searchQuery, statusFilter]);

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const totalPages = Math.ceil(filteredScripts.length / pageSize);
  const paginatedScripts = useMemo(() => {
    return filteredScripts.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [filteredScripts, currentPage, pageSize]);

  // 为 ClassificationView 映射数据
  const classificationScripts = useMemo(() => {
    return filteredScripts.map((s) => ({
      id: s.id,
      title: s.title,
      status: (s.status === "archived" ? "completed" : s.status === "active" ? "draft" : s.status) as
        | "draft" | "review" | "approved" | "rejected" | "completed",
      genre: s.tags?.[0],
      progress: s.status === "completed" ? 100 : s.status === "active" ? 50 : 0,
      updatedAt: s.updated_at,
    }));
  }, [filteredScripts]);

  // 打开新建对话框
  const handleCreate = () => {
    setEditingScript(null);
    setIsFormOpen(true);
  };

  const handleEdit = (script: Script) => {
    setEditingScript(script);
    setIsFormOpen(true);
  };

  // 打开剧本编辑器（新标签页）
  const handleOpenEditor = (scriptId: string) => {
    window.open(`/scripts/${scriptId}`, '_blank');
  };

  // 保存剧本（新建或编辑）
  const handleSave = async (values: Record<string, string | number | string[]>) => {
    setIsSaving(true);
    try {
      const payload = { ...values, project_id: selectedProjectId } as any;
      if (editingScript) {
        await updateScript(selectedProjectId, editingScript.id, payload);
        try {
          await scriptCenterService.updateDocument(editingScript.id, {
            title: String(values.title ?? editingScript.title),
            project_id: selectedProjectId,
          } as any);
        } catch (docErr) {
          console.warn("同步更新剧本文档标题失败:", docErr);
        }
      } else {
        // 新建剧本：先创建 scripts 记录，再把 description 同步写入 ScriptDocument.editor_json
        const created = await createScript(selectedProjectId, payload);
        const description = String(values.description ?? "").trim();
        if (description) {
          try {
            const editorJson = textToEditorJson(description);
            await scriptCenterService.createDocument({
              id: created.id,
              project_id: created.project_id,
              editor_json: editorJson,
              version: 1,
            });
          } catch (docErr) {
            // 同步失败不阻塞主流程：编辑器的 loadDocument 仍会兜底创建
            console.error("同步创建剧本文档失败:", docErr);
          }
        }
      }
      setIsFormOpen(false);
      setEditingScript(null);
      clearApiCache();
      await reloadScripts();
    } finally {
      setIsSaving(false);
    }
  };

  // 软删剧本：移到回收站
  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    const target = deleteConfirm;
    try {
      const result = await deleteScriptApi(selectedProjectId, target.id);
      setDeleteConfirm(null);
      clearApiCache();
      setScripts((prev) => prev.filter((script) => script.id !== target.id));
      console.log(`剧本已移到回收站：${result.deleted_at}`);
    } catch (err) {
      console.error("剧本删除失败:", err);
      alert("剧本删除失败，请重试");
    }
  };

  // 回收站：打开对话框并加载
  const openRecycleBin = async () => {
    setShowRecycleBin(true);
    if (!selectedProjectId) return;
    setIsRecycleBinLoading(true);
    try {
      const data = await listDeletedScriptsApi(selectedProjectId);
      setDeletedScripts(data as unknown as Script[]);
    } catch (err) {
      console.error("加载回收站失败:", err);
      alert("加载回收站失败");
    } finally {
      setIsRecycleBinLoading(false);
    }
  };

  // 回收站：恢复剧本
  const handleRestoreScript = async (script: Script) => {
    try {
      await restoreScriptApi(selectedProjectId, script.id);
      // 从回收站移除 + 重新加载主列表
      setDeletedScripts((prev) => prev.filter((s) => s.id !== script.id));
      clearApiCache();
      await reloadScripts();
    } catch (err) {
      console.error("恢复失败:", err);
      alert(`恢复失败：${(err as Error).message}`);
    }
  };

  // 回收站：彻底删除剧本
  const handlePurgeScript = async (script: Script) => {
    try {
      const result = await purgeScriptApi(selectedProjectId, script.id);
      setDeletedScripts((prev) => prev.filter((s) => s.id !== script.id));
      const total = Object.values(result.cascade ?? {}).reduce((sum, count) => sum + count, 0);
      console.log(`剧本已彻底删除（联动删除 ${total} 条记录）`);
    } catch (err) {
      console.error("彻底删除失败:", err);
      alert(`彻底删除失败：${(err as Error).message}`);
    }
  };

  // 距 30 天保留期还差几天（负数 = 已可彻底删除）
  const scriptRemainingDays = (deletedAt?: string): number => {
    if (!deletedAt) return 0;
    const deletedTime = new Date(deletedAt).getTime();
    if (Number.isNaN(deletedTime)) return 0;
    return Math.ceil((deletedTime + 30 * 24 * 60 * 60 * 1000 - Date.now()) / (24 * 60 * 60 * 1000));
  };

  // AI生成剧本
  const handleAIGenerate = async (values: Record<string, string | number | string[]>) => {
    if (!selectedProjectId) {
      alert("请先选择一个项目");
      return;
    }
    setIsAIGenerating(true);
    try {
      const targetLength = Number(values.length) || 8000;
      const prompt = values.prompt as string;
      const style = values.style as string;
      const genre = values.genre as string;

      // 本地生成剧本大纲（AI服务的后备方案）
      const content = generateLocalScriptOutline(prompt, style, genre, targetLength);

      await createScript(selectedProjectId, {
        title: `AI生成剧本 - ${prompt.slice(0, 20)}...`,
        author: "AI助手",
        status: "draft",
        description: content,
        project_id: selectedProjectId,
        words: content.replace(/\s/g, "").length,
        chapters: 1,
        tags: ["AI生成", style ? `风格:${style}` : "", genre ? `类型:${genre}` : ""].filter(Boolean),
      } as any);

      setShowAIGenerate(false);
      clearApiCache();
      await reloadScripts();
    } catch (err) {
      console.error("AI生成剧本失败:", err);
      alert("AI生成剧本失败，请重试");
    } finally {
      setIsAIGenerating(false);
    }
  };

  // 从模板创建剧本
  const handleCreateFromTemplate = async (template: any) => {
    const templateName = typeof template === "object" ? template?.name : "模板";
    const templateTags = typeof template === "object" ? template?.tags : [];
    const templateDesc = typeof template === "object" ? template?.description : "基于模板创建的剧本";
    const templateStructure = typeof template === "object" ? template?.structure : [];

    try {
      const description = templateStructure && templateStructure.length > 0
        ? `${templateDesc}\n\n剧本结构：\n${templateStructure.map((s: string, i: number) => `${i + 1}. ${s}`).join("\n")}`
        : templateDesc;

      await createScript(selectedProjectId, {
        title: `${templateName} - ${new Date().toLocaleDateString()}`,
        author: "当前用户",
        status: "draft",
        description,
        project_id: selectedProjectId,
        words: description.replace(/\s/g, "").length,
        chapters: templateStructure?.length ?? 1,
        tags: templateTags ?? [],
      } as any);
      setShowTemplateLibrary(false);
      clearApiCache();
      await reloadScripts();
    } catch (err) {
      console.error("从模板创建失败:", err);
      alert("从模板创建失败，请重试");
    }
  };

  // 打开标签管理
  const handleOpenTagManager = (script: Script) => {
    setSelectedScript(script);
    setShowTagManager(true);
  };

  // 打开剧本分析
  const handleOpenAnalysis = (script: Script) => {
    setSelectedScript(script);
    setExtractedAssets([]);
    setShowAnalysis(true);
  };

  // 打开审批工作流
  const handleOpenApproval = (script: Script) => {
    setSelectedScript(script);
    setShowApproval(true);
  };

  // 标签更新回调
  const handleTagsUpdated = (updatedScript: Script) => {
    setScripts((prev) => prev.map((s) => (s.id === updatedScript.id ? updatedScript : s)));
  };

  // 审批状态更新回调 - 审批通过后流转到审核中心
  const handleStatusUpdated = async (updatedScript: Script) => {
    setScripts((prev) => prev.map((s) => (s.id === updatedScript.id ? updatedScript : s)));

    // 如果状态变为 completed（审批通过），自动创建审核记录流转到审核中心
    if (updatedScript.status === "completed" && selectedProjectId) {
      try {
        await createReview(selectedProjectId, {
          target_type: "script",
          target_id: updatedScript.id,
          reviewer: "系统自动",
          status: "open",
          comment: `剧本「${updatedScript.title}」审批通过，自动转入审核中心`,
          project_id: selectedProjectId,
        } as any);
      } catch (err) {
        console.error("创建审核记录失败:", err);
      }
    }
  };

  // ==================== 剧本分析：提取资产 ====================

  const handleAnalyzeScript = async () => {
    if (!selectedScript) return;
    // 区分首次分析与重新分析的提示文案
    const hasExisting = extractedAssets.length > 0;
    setAnalyzeStatus(hasExisting ? "重新分析中..." : "分析中...");
    setIsAnalyzing(true);
    try {
      const content = await loadScriptContentForAnalysis(selectedScript);
      if (!content.trim()) {
        throw new Error("剧本文档内容为空，请先在编辑器中保存正文后再分析");
      }
      let assets: ExtractedAsset[] = [];
      try {
        const response = await fetch("/api/ai/script-analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: selectedScript.title, content, format: "txt" }),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(payload?.message || `AI 分析失败（HTTP ${response.status}）`);
        }
        const result = payload?.data ?? payload ?? {};
        if (result?.success === false) {
          throw new Error(result.error || payload?.message || "AI 分析失败");
        }
        // 后端 sendJson 会包一层 data，AI 分析服务内部也有 data 字段：这里必须解两层。
        const data = result?.data ?? result;
        const charList: any[] = Array.isArray(data.characters) ? data.characters : [];
        const sceneList: any[] = Array.isArray(data.scenes) ? data.scenes : [];
        const propList: any[] = Array.isArray(data.props) ? data.props : [];

        const mapCharacter = (a: any, idx: number): ExtractedAsset => ({
          id: `character-${idx + 1}-${Date.now()}`,
          type: "character",
          name: a.name || "",
          description: a.description ?? "",
          confirmed: true,
          role: a.role,
          gender: a.gender,
          age: a.age,
          appearance: a.appearance,
          personality: a.personality,
          traits: Array.isArray(a.traits) ? a.traits : [],
        });
        const mapScene = (a: any, idx: number): ExtractedAsset => ({
          id: `scene-${idx + 1}-${Date.now()}`,
          type: "scene",
          name: a.location_name || a.name || "",
          description: a.description ?? "",
          confirmed: true,
          sceneType: a.sceneType,
          lighting: a.lighting,
          timeOfDay: a.time_of_day ?? a.timeOfDay,
          weather: a.weather,
        });
        const mapProp = (a: any, idx: number): ExtractedAsset => ({
          id: `prop-${idx + 1}-${Date.now()}`,
          type: "prop",
          name: a.name || "",
          description: a.description ?? "",
          confirmed: true,
          category: a.category,
          material: a.material,
          color: a.color,
        });

        assets = [
          ...charList.map(mapCharacter),
          ...sceneList.map(mapScene),
          ...propList.map(mapProp),
        ];
        const localAssets = analyzeScriptContent(content);
        assets = mergeExtractedAssets(assets, localAssets);
      } catch (err) {
        console.warn("AI 分析失败，使用本地提取兜底:", err);
        assets = analyzeScriptContent(content);
        if (assets.length === 0) throw err;
      }
      setExtractedAssets(assets);
    } catch (err) {
      console.error("分析失败:", err);
      const message = (err as Error)?.message || "请重试";
      alert(`剧本分析失败：${message}\n\n请检查网络或 AI 配置后重试。`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 确认单个资产
  const toggleAssetConfirmed = (assetId: string) => {
    setExtractedAssets((prev) =>
      prev.map((a) => (a.id === assetId ? { ...a, confirmed: !a.confirmed } : a))
    );
  };

  // 编辑保存资产内容
  const updateAsset = (assetId: string, patch: Partial<ExtractedAsset>) => {
    setExtractedAssets((prev) =>
      prev.map((a) => (a.id === assetId ? { ...a, ...patch } : a))
    );
  };

  // 批量确认/取消确认
  const confirmAllAssets = (type: "character" | "scene" | "prop", confirm: boolean) => {
    setExtractedAssets((prev) =>
      prev.map((a) => (a.type === type ? { ...a, confirmed: confirm } : a))
    );
  };

  // 将指定类型的已确认资产流转到对应工厂
  const transferAssetsByType = async (type: "character" | "scene" | "prop") => {
    if (!selectedProjectId) {
      alert("请先选择一个项目");
      return;
    }
    const targets = extractedAssets.filter((a) => a.type === type && a.confirmed && !a.id.startsWith("transferred-"));
    if (targets.length === 0) {
      alert("请先勾选要流转的资产");
      return;
    }
    const factoryName = type === "character" ? "角色工厂" : type === "scene" ? "场景工厂" : "道具工厂";
    setIsTransferring(true);
    try {
      // 流转前查询工厂已有资产，按 name 去重
      const existingNames = new Set<string>();
      if (type === "character") {
        const existing = await listCharacters(selectedProjectId);
        existing.forEach((c) => existingNames.add(c.name));
      } else if (type === "scene") {
        const existing = await listScenes(selectedProjectId);
        existing.forEach((s) => existingNames.add(s.name));
      } else {
        const existing = await listProps(selectedProjectId);
        existing.forEach((p) => existingNames.add(p.name));
      }

      let successCount = 0;
      let skipCount = 0;
      for (const asset of targets) {
        // 跳过工厂中已存在的同名资产
        if (existingNames.has(asset.name)) {
          skipCount++;
          continue;
        }
        try {
          if (type === "character") {
            await createCharacter({
              name: asset.name,
              role: asset.role || "minor",
              gender: (asset.gender as any) || "other",
              age: asset.age || 0,
              traits: asset.traits || [],
              description: asset.description,
              project_id: selectedProjectId,
              tags: ["剧本分析提取"],
            } as any);
          } else if (type === "scene") {
            await createScene({
              name: asset.name,
              type: (asset.sceneType as any) || "indoor",
              description: asset.description,
              lighting: asset.lighting || "",
              time_of_day: asset.timeOfDay || "",
              weather: asset.weather || "",
              project_id: selectedProjectId,
              tags: ["剧本分析提取"],
            } as any);
          } else if (type === "prop") {
            await createProp({
              name: asset.name,
              category: (asset.category as any) || "other",
              description: asset.description,
              material: asset.material || "",
              color: asset.color || "",
              project_id: selectedProjectId,
              tags: ["剧本分析提取"],
            } as any);
          }
          successCount++;
        } catch (err) {
          console.error(`流转资产 ${asset.name} 失败:`, err);
        }
      }
      const skipMsg = skipCount > 0 ? `\n（跳过 ${skipCount} 个已存在资产）` : "";
      alert(`成功流转 ${successCount} 个资产到${factoryName}！${skipMsg}`);
      // 标记已流转的资产（包括跳过的，因为它们已存在于工厂）
      setExtractedAssets((prev) =>
        prev.map((a) =>
          a.type === type && a.confirmed && !a.id.startsWith("transferred-")
            ? { ...a, confirmed: false, id: `transferred-${a.id}` }
            : a
        )
      );
    } finally {
      setIsTransferring(false);
    }
  };

  // 将确认的资产流转到对应工厂（全部类型）
  const handleTransferAssets = async () => {
    if (!selectedProjectId) {
      alert("请先选择一个项目");
      return;
    }
    const confirmedAssets = extractedAssets.filter((a) => a.confirmed && !a.id.startsWith("transferred-"));
    if (confirmedAssets.length === 0) {
      alert("请先勾选要流转的资产");
      return;
    }
    setIsTransferring(true);
    try {
      // 流转前查询三种工厂已有资产，按 name 去重
      const [existingCharacters, existingScenes, existingProps] = await Promise.all([
        listCharacters(selectedProjectId),
        listScenes(selectedProjectId),
        listProps(selectedProjectId),
      ]);
      const existingNamesByType: Record<string, Set<string>> = {
        character: new Set(existingCharacters.map((c) => c.name)),
        scene: new Set(existingScenes.map((s) => s.name)),
        prop: new Set(existingProps.map((p) => p.name)),
      };

      let successCount = 0;
      let skipCount = 0;
      for (const asset of confirmedAssets) {
        // 跳过工厂中已存在的同名资产
        if (existingNamesByType[asset.type]?.has(asset.name)) {
          skipCount++;
          continue;
        }
        try {
          if (asset.type === "character") {
            await createCharacter({
              name: asset.name,
              role: asset.role || "minor",
              gender: (asset.gender as any) || "other",
              age: asset.age || 0,
              traits: asset.traits || [],
              description: asset.description,
              project_id: selectedProjectId,
              tags: ["剧本分析提取"],
            } as any);
          } else if (asset.type === "scene") {
            await createScene({
              name: asset.name,
              type: (asset.sceneType as any) || "indoor",
              description: asset.description,
              lighting: asset.lighting || "",
              time_of_day: asset.timeOfDay || "",
              weather: asset.weather || "",
              project_id: selectedProjectId,
              tags: ["剧本分析提取"],
            } as any);
          } else if (asset.type === "prop") {
            await createProp({
              name: asset.name,
              category: (asset.category as any) || "other",
              description: asset.description,
              material: asset.material || "",
              color: asset.color || "",
              project_id: selectedProjectId,
              tags: ["剧本分析提取"],
            } as any);
          }
          successCount++;
        } catch (err) {
          console.error(`流转资产 ${asset.name} 失败:`, err);
        }
      }
      const skipMsg = skipCount > 0 ? `\n（跳过 ${skipCount} 个已存在资产）` : "";
      alert(`成功流转 ${successCount} 个资产到对应工厂！\n- 角色工厂\n- 场景工厂\n- 道具工厂${skipMsg}`);
      // 标记已流转的资产（包括跳过的，因为它们已存在于工厂）
      setExtractedAssets((prev) =>
        prev.map((a) => (a.confirmed && !a.id.startsWith("transferred-") ? { ...a, confirmed: false, id: `transferred-${a.id}` } : a))
      );
    } finally {
      setIsTransferring(false);
    }
  };

  const statusOptions = [
    { value: "", label: "全部状态" },
    { value: "draft", label: "草稿" },
    { value: "active", label: "进行中" },
    { value: "review", label: "审核中" },
    { value: "completed", label: "已完成" },
  ];

  return (
    <PageContainer
      title={initialProjectId ? "剧本中心 · 导入剧本" : "剧本中心"}
      description={
        initialProjectId
          ? "项目暂无剧本，请先导入或新建一份剧本"
          : "剧本分析与资产生成中心"
      }
      showBackButton={!!initialProjectId}
      backPath="/projects"
    >
      {/* 工作流程提示 - 修正为正确的定位 */}
      <div className="mb-6 flex items-start gap-3 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
        <Info className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-200">
          <p className="font-medium mb-1">剧本分析与资产生成流程</p>
          <p className="text-blue-300/80 text-xs">
            导入/创作剧本 → AI分析提取角色、场景、道具文字描述 → 确认后流转到角色工厂、场景工厂、道具工厂 → 审批通过后转入审核中心
          </p>
        </div>
      </div>

      {/* 工具栏 */}
      <ModuleToolbar
        left={
          <>
            <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="搜索剧本标题或作者..." />
            <FilterSelect value={statusFilter} onChange={setStatusFilter} options={statusOptions} placeholder="状态筛选" />
            {/* 视图切换 */}
            <div className="flex items-center gap-1 p-1 rounded-lg bg-[#252525] border border-white/10">
              <button
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                  viewMode === "list" ? "bg-emerald-500/20 text-emerald-400" : "text-[#888] hover:text-white"
                }`}
                onClick={() => setViewMode("list")}
                title="列表视图"
              >
                <ListIcon className="h-3 w-3" />
                列表
              </button>
              <button
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                  viewMode === "classification" ? "bg-emerald-500/20 text-emerald-400" : "text-[#888] hover:text-white"
                }`}
                onClick={() => setViewMode("classification")}
                title="分类视图"
              >
                <LayoutGrid className="h-3 w-3" />
                分类
              </button>
            </div>
          </>
        }
        right={
          <>
            <Button variant="secondary" size="sm" onClick={openRecycleBin}>
              <Archive className="mr-2 h-4 w-4" />
              回收站
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowImport(true)}>
              <Upload className="mr-2 h-4 w-4" />
              导入剧本
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowTemplateLibrary(true)}>
              <BookOpen className="mr-2 h-4 w-4" />
              模板库
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowAIGenerate(true)}>
              <Sparkles className="mr-2 h-4 w-4" />
              AI生成
            </Button>
            <Button size="sm" onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              新建剧本
            </Button>
          </>
        }
      />

      {/* 剧本列表/分类视图 */}
      <PageCard title={viewMode === "list" ? "剧本列表" : "分类视图"}>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 text-emerald-400 animate-spin" />
            <span className="ml-2 text-[#888]">加载中...</span>
          </div>
        ) : viewMode === "classification" ? (
          classificationScripts.length > 0 ? (
            <ClassificationView
              scripts={classificationScripts}
              onScriptSelect={(id) => handleOpenEditor(id)}
            />
          ) : (
            <EmptyState
              type="no-results"
              title="未找到剧本"
              description={searchQuery || statusFilter ? "尝试调整搜索条件" : "点击上方按钮创建新剧本"}
              action={{ label: "新建剧本", onClick: handleCreate }}
            />
          )
        ) : filteredScripts.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="px-4 py-3 text-left text-sm font-medium text-[#888]">剧本标题</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-[#888] hidden md:table-cell">作者</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-[#888]">状态</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-[#888] hidden sm:table-cell">字数</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-[#888] hidden lg:table-cell">章节</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-[#888] hidden md:table-cell">更新时间</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-[#888]">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedScripts.map((script) => (
                    <ScriptRow
                      key={script.id}
                      script={script}
                      onOpenEditor={() => handleOpenEditor(script.id)}
                      onEdit={() => handleEdit(script)}
                      onDelete={() => setDeleteConfirm({ id: script.id, title: script.title })}
                      onTagManager={() => handleOpenTagManager(script)}
                      onAnalysis={() => handleOpenAnalysis(script)}
                      onApproval={() => handleOpenApproval(script)}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* 分页 */}
            {totalPages > 1 && (
              <div className="mt-4">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={filteredScripts.length}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={setPageSize}
                />
              </div>
            )}
          </>
        ) : (
          <EmptyState
            type="no-results"
            title="未找到剧本"
            description={searchQuery || statusFilter ? "尝试调整搜索条件" : "点击上方按钮创建新剧本"}
            action={{ label: "新建剧本", onClick: handleCreate }}
          />
        )}
      </PageCard>

      {/* 新建/编辑对话框 */}
      <ScriptFormDialog
        editingScript={editingScript}
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingScript(null);
        }}
        onSave={handleSave}
        isSaving={isSaving}
      />

      {/* AI生成剧本对话框 */}
      <AIGenerateDialog
        isOpen={showAIGenerate}
        onClose={() => setShowAIGenerate(false)}
        onSave={handleAIGenerate}
        isLoading={isAIGenerating}
      />

      {/* 删除确认对话框（软删：移到回收站） */}
      {deleteConfirm && (
        <ConfirmDialog
          title="删除剧本"
          description={`将剧本「${deleteConfirm.title}」移到回收站？剧本可在 30 天保留期内恢复或彻底删除。`}
          confirmLabel="移到回收站"
          onClose={() => setDeleteConfirm(null)}
          onConfirm={handleDeleteConfirm}
        />
      )}

      {/* 回收站对话框 */}
      {showRecycleBin && (
        <DialogOverlay
          title="剧本回收站"
          onClose={() => setShowRecycleBin(false)}
          wide
        >
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-200">
              回收站内的剧本会在 30 天后自动清理。30 天内可恢复剧本或彻底删除（会级联清理剧集/场景/对白等所有关联数据）。
            </div>
            {isRecycleBinLoading ? (
              <div className="flex items-center justify-center py-12 text-[#888]">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                加载中...
              </div>
            ) : deletedScripts.length === 0 ? (
              <div className="rounded-lg border border-white/10 bg-[#1f1f1f] py-12 text-center text-[#888]">
                回收站是空的
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-[#888]">
                      <th className="px-3 py-2 text-left">标题</th>
                      <th className="px-3 py-2 text-left">作者</th>
                      <th className="px-3 py-2 text-left">删除时间</th>
                      <th className="px-3 py-2 text-left">剩余天数</th>
                      <th className="px-3 py-2 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deletedScripts.map((script) => {
                      const remaining = scriptRemainingDays(script.deleted_at);
                      const canPurge = remaining <= 0;
                      return (
                        <tr key={script.id} className="border-b border-white/5">
                          <td className="px-3 py-2 text-white">{script.title}</td>
                          <td className="px-3 py-2 text-[#888]">{script.author}</td>
                          <td className="px-3 py-2 text-[#888]">
                            {script.deleted_at ? new Date(script.deleted_at).toLocaleString() : "—"}
                          </td>
                          <td className="px-3 py-2">
                            {canPurge ? (
                              <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-400">
                                可清理
                              </span>
                            ) : (
                              <span className="text-[#888]">{remaining} 天后自动清理</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="inline-flex items-center gap-2">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleRestoreScript(script)}
                              >
                                <RotateCcw className="mr-1 h-3 w-3" />
                                恢复
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                disabled={!canPurge}
                                title={canPurge ? "彻底删除（级联清理所有关联数据）" : `需软删满 30 天才能彻底删除（还剩 ${remaining} 天）`}
                                onClick={() => setRecycleBinAction({ type: "purge", script })}
                              >
                                <Trash2 className="mr-1 h-3 w-3" />
                                彻底删除
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </DialogOverlay>
      )}

      {/* 回收站二次确认（恢复/彻底删除） */}
      {recycleBinAction && (
        <ConfirmDialog
          title={recycleBinAction.type === "restore" ? "恢复剧本" : "彻底删除剧本"}
          description={
            recycleBinAction.type === "restore"
              ? `确认将剧本「${recycleBinAction.script.title}」恢复到剧本列表？`
              : `确认彻底删除「${recycleBinAction.script.title}」？此操作会级联清理所有剧集、场景、对白、备份等关联数据，且不可恢复。`
          }
          confirmLabel={recycleBinAction.type === "restore" ? "恢复" : "彻底删除"}
          onClose={() => setRecycleBinAction(null)}
          onConfirm={async () => {
            if (recycleBinAction.type === "restore") {
              await handleRestoreScript(recycleBinAction.script);
            } else {
              await handlePurgeScript(recycleBinAction.script);
            }
            setRecycleBinAction(null);
          }}
        />
      )}

      {/* 模板库对话框 */}
      <TemplateLibraryDialog
        isOpen={showTemplateLibrary}
        onClose={() => setShowTemplateLibrary(false)}
        onCreateFromTemplate={handleCreateFromTemplate}
      />

      {/* 标签管理对话框 */}
      {showTagManager && selectedScript && (
        <DialogOverlay
          title={`标签管理 - ${selectedScript.title}`}
          onClose={() => setShowTagManager(false)}
        >
          <SimpleTagManager
            script={selectedScript}
            onTagsUpdated={handleTagsUpdated}
          />
        </DialogOverlay>
      )}

      {/* 剧本分析对话框 - 核心功能：提取角色/场景/道具 */}
      {showAnalysis && selectedScript && (
        <DialogOverlay
          title={`剧本分析 - ${selectedScript.title}`}
          onClose={() => setShowAnalysis(false)}
          wide
        >
          <ScriptAnalysisPanel
            script={selectedScript}
            extractedAssets={extractedAssets}
            isAnalyzing={isAnalyzing}
            isTransferring={isTransferring}
            analyzeStatus={analyzeStatus}
            onAnalyze={handleAnalyzeScript}
            onToggleAsset={toggleAssetConfirmed}
            onConfirmAll={confirmAllAssets}
            onTransfer={handleTransferAssets}
            onTransferByType={transferAssetsByType}
            onUpdateAsset={updateAsset}
          />
        </DialogOverlay>
      )}

      {/* 审批工作流对话框 */}
      <ApprovalWorkflowDialog
        script={selectedScript}
        isOpen={showApproval}
        onClose={() => setShowApproval(false)}
        onStatusUpdated={handleStatusUpdated}
      />

      {/* 导入剧本对话框 */}
      <ScriptImportDialog
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        projectId={selectedProjectId}
        onImported={async () => {
          clearApiCache();
          await reloadScripts();
        }}
      />
    </PageContainer>
  );
}

/** 剧本表格行组件 */
function ScriptRow({
  script,
  onOpenEditor,
  onEdit,
  onDelete,
  onTagManager,
  onAnalysis,
  onApproval,
}: {
  script: Script;
  onOpenEditor: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTagManager: () => void;
  onAnalysis: () => void;
  onApproval: () => void;
}) {
  const statusLabels: Record<string, string> = {
    draft: "草稿",
    active: "进行中",
    review: "审核中",
    completed: "已完成",
    archived: "已归档",
  };

  const statusColors: Record<string, string> = {
    draft: "bg-gray-500/20 text-gray-400",
    active: "bg-blue-500/20 text-blue-400",
    review: "bg-yellow-500/20 text-yellow-400",
    completed: "bg-emerald-500/20 text-emerald-400",
    archived: "bg-[#252525] text-[#888]",
  };

  return (
    <tr
      className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors"
      onClick={onOpenEditor}
      title="点击进入编辑器"
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-white/5">
            <FileText className="h-4 w-4 text-emerald-400" />
          </div>
          <div>
            <div className="font-medium text-white">{script.title}</div>
            {script.description && (
              <div className="text-xs text-[#666] line-clamp-1">{script.description}</div>
            )}
            {script.tags && script.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {script.tags.slice(0, 3).map((tag, idx) => (
                  <span
                    key={idx}
                    className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400"
                  >
                    {tag}
                  </span>
                ))}
                {script.tags.length > 3 && (
                  <span className="text-[10px] text-[#666]">+{script.tags.length - 3}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-[#888] hidden md:table-cell">{script.author}</td>
      <td className="px-4 py-3">
        <span className={`px-2 py-0.5 rounded text-xs ${statusColors[script.status]}`}>
          {statusLabels[script.status]}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-[#888] hidden sm:table-cell">
        {script.words?.toLocaleString() ?? 0}
      </td>
      <td className="px-4 py-3 text-sm text-[#888] hidden lg:table-cell">{script.chapters ?? 0}</td>
      <td className="px-4 py-3 text-sm text-[#888] hidden md:table-cell">
        {new Date(script.updated_at).toLocaleDateString()}
      </td>
      <td
        className="px-4 py-3 text-right"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 justify-end">
          {/* 主操作：进入编辑器继续编辑（替代原先的铅笔图标） */}
          <Button
            size="sm"
            variant="outline"
            onClick={onOpenEditor}
            className="text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/10 hover:border-emerald-500/60"
            title="进入编辑器继续编辑"
          >
            继续编辑 →
          </Button>
          <Button variant="ghost" size="sm" onClick={onEdit} title="编辑标题和基础信息">
            <Pencil className="h-4 w-4 text-emerald-400" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onAnalysis} title="剧本分析（提取角色/场景/道具）">
            <Sparkles className="h-4 w-4 text-blue-400" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onTagManager} title="标签管理">
            <TagIcon className="h-4 w-4 text-purple-400" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onApproval} title="审批流程">
            <CheckCircle className="h-4 w-4 text-yellow-400" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete} title="删除">
            <Trash2 className="h-4 w-4 text-red-400" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

// ==================== 本地组件：标签管理 ====================

function SimpleTagManager({
  script,
  onTagsUpdated,
}: {
  script: Script;
  onTagsUpdated: (script: Script) => void;
}) {
  const selectedProjectId = useProjectStore((s) => s.selectedProjectId);
  const [tags, setTags] = useState<string[]>(script.tags ?? []);
  const [newTag, setNewTag] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleAdd = () => {
    const trimmed = newTag.trim();
    if (!trimmed || tags.includes(trimmed)) return;
    setTags([...tags, trimmed]);
    setNewTag("");
  };

  const handleRemove = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateScript(selectedProjectId, script.id, { tags } as any);
      onTagsUpdated({ ...script, tags });
      clearApiCache();
    } catch (err) {
      console.error("保存标签失败:", err);
      alert("保存标签失败");
    } finally {
      setIsSaving(false);
    }
  };

  const presetTags = ["古装", "现代", "科幻", "奇幻", "悬疑", "喜剧", "言情", "动作", "AI生成", "导入", "已审核", "需修改"];

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs text-[#888] mb-2">当前标签 ({tags.length})</div>
        {tags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag, idx) => (
              <span
                key={idx}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-emerald-500/10 text-emerald-400"
              >
                {tag}
                <button onClick={() => handleRemove(tag)} className="ml-1 hover:text-red-400">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <div className="text-sm text-[#666]">暂无标签</div>
        )}
      </div>

      <div>
        <div className="text-xs text-[#888] mb-2">添加新标签</div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="输入标签名称后回车"
            className="flex-1 h-9 px-3 rounded-lg bg-[#252525] border border-white/10 text-sm text-white focus:outline-none focus:border-emerald-500/50"
          />
          <Button size="sm" onClick={handleAdd} disabled={!newTag.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div>
        <div className="text-xs text-[#888] mb-2">快捷标签</div>
        <div className="flex flex-wrap gap-2">
          {presetTags.map((tag) => (
            <button
              key={tag}
              onClick={() => !tags.includes(tag) && setTags([...tags, tag])}
              disabled={tags.includes(tag)}
              className={`px-2 py-1 rounded text-xs transition-colors ${
                tags.includes(tag)
                  ? "bg-white/5 text-[#666] cursor-not-allowed"
                  : "bg-white/5 text-[#888] hover:bg-white/10 hover:text-white"
              }`}
            >
              + {tag}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
        <Button size="sm" onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              保存中...
            </>
          ) : (
            <>
              <CheckCircle className="mr-2 h-4 w-4" />
              保存标签
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
