"use client";

/**
 * 剧本中心 - 主页面组件
 *
 * 定位：剧本分析与资产生成中心
 * 核心流程：导入/创作剧本 → AI分析提取角色/场景/道具文字描述 → 确认后流转到各工厂
 *
 * 文件结构：
 * - ./parts/DialogOverlay.tsx       通用对话框覆盖层（其他文件依赖此导出）
 * - ./parts/ScriptRow.tsx           剧本表格行
 * - ./parts/SimpleTagManager.tsx    标签管理
 * - ./parts/utils-script.ts         工具函数（editorJsonToPlainText / loadScriptContentForAnalysis / mergeExtractedAssets）
 */

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Trash2,
  LayoutGrid,
  List as ListIcon,
  Upload,
  BookOpen,
  Info,
  Loader2,
  Archive,
  RotateCcw,
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
import { Tip } from "@/components/ui/tip";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { useProjectStore } from "@/lib/stores/project-store";
import {
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
import { notify } from "@/lib/notify";
import type { Script } from "@/lib/module-types";

// import { ScriptFormDialog } from "./ScriptFormDialog"; // 已移除：不再需要新建剧本功能
import { AIGenerateDialog } from "./AIGenerateDialog";
import { ScriptImportDialog } from "./ScriptImportDialog";
import { TemplateLibraryDialog } from "./TemplateLibraryDialog";
import { ScriptAnalysisPanel } from "./ScriptAnalysisPanel";
import { ApprovalWorkflowDialog } from "./ApprovalWorkflowDialog";
import { analyzeScriptContent, textToEditorJson } from "./utils";
import type { ViewMode, ExtractedAsset } from "./types";

// 子组件 / 工具函数（来自 ./parts）
import { DialogOverlay } from "./parts/DialogOverlay";
import { ScriptRow } from "./parts/ScriptRow";
import { SimpleTagManager } from "./parts/SimpleTagManager";
import { loadScriptContentForAnalysis, mergeExtractedAssets } from "./parts/utils-script";

// 透传 DialogOverlay（保持向后兼容：3 个文件直接从 ScriptsCenterPage 引入）
export { DialogOverlay } from "./parts/DialogOverlay";

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
  // const [isFormOpen, setIsFormOpen] = useState(false); // 已移除：不再需要新建剧本功能
  // const [editingScript, setEditingScript] = useState<Script | null>(null);
  // const [isSaving, setIsSaving] = useState(false);

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
  // 方案 A：列表数据源改用 Path B（script_documents 表），与"继续编辑"页面共享同一份数据
  const [scripts, setScripts] = useState<Script[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const reloadScripts = async () => {
    if (!selectedProjectId) {
      setScripts([]);
      return;
    }
    setIsLoading(true);
    try {
      // 方案 A：从 /api/script-documents?projectId=... 拉剧本列表（自带 title/author/status/genre/words/chapters）
      const docs = await scriptCenterService.getDocuments(selectedProjectId);
      setScripts(docs as unknown as Script[]);
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

  // 打开剧本编辑器（新标签页）
  const handleOpenEditor = (scriptId: string) => {
    window.open(`/scripts/${scriptId}`, '_blank');
  };

  // 保存剧本功能已移除：不再需要新建/编辑剧本对话框
  // 剧本应通过导入、AI生成或模板库创建
  // const handleSave = async (...) => { ... };

  // 软删剧本：移到回收站
  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    const target = deleteConfirm;
    try {
      await scriptCenterService.deleteDocument(target.id);
      setDeleteConfirm(null);
      clearApiCache();
      setScripts((prev) => prev.filter((script) => script.id !== target.id));
      console.log("剧本已移到回收站");
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
      const data = await scriptCenterService.listDeletedDocuments(selectedProjectId);
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
      await scriptCenterService.restoreDocument(script.id);
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
      const result = await scriptCenterService.purgeDocument(script.id);
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

      // 调用真实 AI 生成剧本（POST /api/ai/script-generate）
      // 不传 project_id，避免后端自动创建剧本文档；由前端统一创建带完整元数据的剧本。
      const { content } = await scriptCenterService.generateScript({
        prompt,
        style: style || undefined,
        genre: genre || undefined,
        length: targetLength,
      });

      await scriptCenterService.createDocument({
        project_id: selectedProjectId,
        title: `AI生成剧本 - ${prompt.slice(0, 20)}...`,
        author: "AI助手",
        status: "draft",
        editor_json: JSON.stringify(textToEditorJson(content)),
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

      await scriptCenterService.createDocument({
        project_id: selectedProjectId,
        title: `${templateName} - ${new Date().toLocaleDateString()}`,
        author: "当前用户",
        status: "draft",
        editor_json: JSON.stringify(textToEditorJson(description)),
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
  const handleOpenAnalysis = async (script: Script) => {
    setSelectedScript(script);
    setShowAnalysis(true);
    // 尝试加载已保存的分析资产
    try {
      const assets = await scriptCenterService.getAnalyzedAssets(script.id);
      const mapped: ExtractedAsset[] = [
        ...assets.characters.map((c) => ({
          id: c.id,
          type: "character" as const,
          name: c.name,
          description: c.description,
          confirmed: c.status === "confirmed" || c.status === "transferred",
          role: c.role,
          gender: c.gender,
          age: parseInt(c.age, 10) || 0,
          appearance: c.appearance,
          personality: c.personality,
          traits: c.traits,
          // === AI 剧本分析扩展字段 ===
          identity: c.identity,
          face: c.face,
          hair: c.hair,
          body: c.body,
          temperament: c.temperament,
          costumeName: c.costume_name,
          costumeDescription: c.costume_description,
          costumeColor: c.costume_color,
          costumeMaterial: c.costume_material,
          costumeStyle: c.costume_style,
          accessories: c.accessories,
          emotionStates: c.emotion_states,
          actionAssets: c.action_assets,
          relationships: c.relationships,
          firstAppearance: c.first_appearance,
          dialogueCount: c.dialogue_count,
          generationPrompt: c.generation_prompt,
          confidence: c.confidence,
        })),
        ...assets.scenes.map((s) => ({
          id: s.id,
          type: "scene" as const,
          name: s.name,
          description: s.description,
          confirmed: s.status === "confirmed" || s.status === "transferred",
          sceneType: s.scene_type,
          lighting: s.lighting,
          timeOfDay: s.time_of_day,
          weather: s.weather,
          // === AI 剧本分析扩展字段 ===
          sceneCategory: s.category,
          indoorOutdoor: s.indoor_outdoor,
          location: s.location,
          architecture: s.architecture,
          terrain: s.terrain,
          plants: s.plants,
          objects: s.objects,
          period: s.period,
          tone: s.tone,
          visualStyle: s.visual_style,
          atmosphereEmotion: s.atmosphere_emotion,
          suitableShots: s.suitable_shots,
          reusableElements: s.reusable_elements,
          generationPrompt: s.generation_prompt,
          firstAppearance: s.first_appearance,
          confidence: s.confidence,
        })),
        ...assets.props.map((p) => ({
          id: p.id,
          type: "prop" as const,
          name: p.name,
          description: p.description,
          confirmed: p.status === "confirmed" || p.status === "transferred",
          category: p.category,
          material: p.material,
          color: p.color,
          // === AI 剧本分析扩展字段 ===
          importanceLevel: p.importance_level,
          owner: p.owner,
          shape: p.shape,
          texture: p.texture,
          storyFunction: p.story_function,
          visualFeatures: p.visual_features,
          cameraUsage: p.camera_usage,
          generationPrompt: p.generation_prompt,
          firstAppearance: p.first_appearance,
          confidence: p.confidence,
        })),
      ];
      setExtractedAssets(mapped);
    } catch {
      // 无已保存资产则清空
      setExtractedAssets([]);
    }
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
      // 实际使用的模型 id（后端回填，用于展示"使用 xxx 解析成功"）
      // 必须在 try/catch 外层声明，因为 catch (本地兜底) 分支也要在外层 toast 中读取
      let usedModel = "";
      try {
        // 180s 默认：与 AI_TIMEOUTS.analyzeScript 一致；可通过 env AGNES_TIMEOUT_ANALYZE_SCRIPT_MS 覆盖
        const timeoutMs = 180_000;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        let response: Response;
        try {
          response = await fetch("/api/ai/script-analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: selectedScript.title, content, format: "txt", timeoutMs }),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timer);
        }
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
        // 实际使用的模型 id（后端回填，用于展示"使用 xxx 解析成功"）
        usedModel = String(data?.model || "").trim();
        const charList: any[] = Array.isArray(data.characters) ? data.characters : [];
        const sceneList: any[] = Array.isArray(data.scenes) ? data.scenes : [];
        const propList: any[] = Array.isArray(data.props) ? data.props : [];

        const mapCharacter = (a: any, idx: number): ExtractedAsset => ({
          id: `character-${idx + 1}-${Date.now()}`,
          type: "character",
          name: a.name || "",
          description: a.description ?? a.generation_prompt ?? "",
          confirmed: true,
          role: a.role,
          gender: a.gender,
          age: a.age,
          appearance: a.appearance,
          personality: a.personality,
          traits: Array.isArray(a.traits) ? a.traits : [],
          // === AI 剧本分析扩展字段 ===
          identity: a.basic?.identity ?? a.identity,
          face: a.appearance?.face ?? a.face,
          hair: a.appearance?.hair ?? a.hair,
          body: a.appearance?.body ?? a.body,
          temperament: a.appearance?.temperament ?? a.temperament,
          costumeName: a.costume?.name ?? a.costume_name,
          costumeDescription: a.costume?.description ?? a.costume_description,
          costumeColor: a.costume?.color ?? a.costume_color,
          costumeMaterial: a.costume?.material ?? a.costume_material,
          costumeStyle: a.costume?.style ?? a.costume_style,
          accessories: Array.isArray(a.accessories) ? a.accessories : [],
          emotionStates: JSON.stringify(a.emotion_states || []),
          actionAssets: JSON.stringify(a.action_assets || []),
          relationships: JSON.stringify(a.relationships || []),
          firstAppearance: a.first_appearance,
          dialogueCount: a.dialogue_count,
          generationPrompt: a.generation_prompt,
          confidence: a.confidence,
        });
        const mapScene = (a: any, idx: number): ExtractedAsset => ({
          id: `scene-${idx + 1}-${Date.now()}`,
          type: "scene",
          name: a.scene_name || a.location_name || a.name || "",
          description: a.description ?? a.generation_prompt ?? "",
          confirmed: true,
          sceneType: a.indoor_outdoor ?? a.sceneType,
          lighting: a.time?.lighting ?? a.lighting,
          timeOfDay: a.time?.period ?? a.time_of_day ?? a.timeOfDay,
          weather: a.time?.weather ?? a.weather,
          // === AI 剧本分析扩展字段 ===
          sceneCategory: a.category,
          indoorOutdoor: a.indoor_outdoor,
          location: a.environment?.location ?? a.location,
          architecture: a.environment?.architecture ?? a.architecture,
          terrain: a.environment?.terrain ?? a.terrain,
          plants: a.environment?.plants ?? a.plants,
          objects: a.environment?.objects ?? a.objects,
          period: a.time?.period ?? a.period,
          tone: a.atmosphere?.tone ?? a.tone,
          visualStyle: a.atmosphere?.visual_style ?? a.visual_style,
          atmosphereEmotion: a.atmosphere?.emotion ?? a.atmosphere_emotion,
          suitableShots: JSON.stringify(a.camera_reference?.suitable_shots || []),
          reusableElements: JSON.stringify(a.reusable_elements || []),
          generationPrompt: a.generation_prompt,
          firstAppearance: a.first_appearance,
          confidence: a.confidence,
        });
        const mapProp = (a: any, idx: number): ExtractedAsset => ({
          id: `prop-${idx + 1}-${Date.now()}`,
          type: "prop",
          name: a.name || "",
          description: a.description ?? a.generation_prompt ?? a.story_function ?? "",
          confirmed: true,
          category: a.importance_level ?? a.category,
          material: a.appearance?.material ?? a.material,
          color: a.appearance?.color ?? a.color,
          // === AI 剧本分析扩展字段 ===
          importanceLevel: a.importance_level,
          owner: a.owner,
          shape: a.appearance?.shape ?? a.shape,
          texture: a.appearance?.texture ?? a.texture,
          storyFunction: a.story_function,
          visualFeatures: JSON.stringify(a.visual_features || []),
          cameraUsage: JSON.stringify(a.camera_usage || []),
          generationPrompt: a.generation_prompt,
          firstAppearance: a.first_appearance,
          confidence: a.confidence,
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
      // 解析成功 toast：把"使用了哪个大模型"明确告诉用户（"使用 agnes-2.0-flash 解析成功"）
      // AI 走通时 usedModel 必有值；走本地规则兜底时 usedModel 为空
      if (usedModel) {
        notify.success("解析成功", `使用 ${usedModel} 完成`);
      } else {
        notify.info("解析完成", "已使用本地规则提取资产");
      }
      // 保存分析结果到后端关联表
      if (selectedScript && selectedProjectId) {
        try {
          await scriptCenterService.saveAnalyzedAssets(
            selectedScript.id,
            selectedProjectId,
            {
              characters: assets
                .filter((a) => a.type === "character")
                .map((a) => ({
                  name: a.name,
                  role: a.role || "minor",
                  gender: a.gender || "other",
                  age: String(a.age || ""),
                  description: a.description || "",
                  appearance: a.appearance || "",
                  personality: a.personality || "",
                  traits: a.traits || [],
                  tags: a.tags || [],
                  status: a.confirmed ? "confirmed" : "extracted",
                  // === AI 剧本分析扩展字段 ===
                  identity: a.identity,
                  face: a.face,
                  hair: a.hair,
                  body: a.body,
                  temperament: a.temperament,
                  costume_name: a.costumeName,
                  costume_description: a.costumeDescription,
                  costume_color: a.costumeColor,
                  costume_material: a.costumeMaterial,
                  costume_style: a.costumeStyle,
                  accessories: a.accessories,
                  emotion_states: a.emotionStates,
                  action_assets: a.actionAssets,
                  relationships: a.relationships,
                  first_appearance: a.firstAppearance,
                  dialogue_count: a.dialogueCount,
                  generation_prompt: a.generationPrompt,
                  confidence: a.confidence,
                })),
              scenes: assets
                .filter((a) => a.type === "scene")
                .map((a) => ({
                  name: a.name,
                  type: a.sceneType || "indoor",
                  scene_type: a.sceneType || "indoor",
                  description: a.description || "",
                  lighting: a.lighting || "",
                  time_of_day: a.timeOfDay || "",
                  weather: a.weather || "",
                  tags: a.tags || [],
                  status: a.confirmed ? "confirmed" : "extracted",
                  // === AI 剧本分析扩展字段 ===
                  category: a.sceneCategory,
                  indoor_outdoor: a.indoorOutdoor,
                  location: a.location,
                  architecture: a.architecture,
                  terrain: a.terrain,
                  plants: a.plants,
                  objects: a.objects,
                  period: a.period,
                  tone: a.tone,
                  visual_style: a.visualStyle,
                  atmosphere_emotion: a.atmosphereEmotion,
                  suitable_shots: a.suitableShots,
                  reusable_elements: a.reusableElements,
                  generation_prompt: a.generationPrompt,
                  first_appearance: a.firstAppearance,
                  confidence: a.confidence,
                })),
              props: assets
                .filter((a) => a.type === "prop")
                .map((a) => ({
                  name: a.name,
                  category: a.category || "other",
                  description: a.description || "",
                  appearance: a.appearance || "",
                  material: a.material || "",
                  size: a.size || "",
                  color: a.color || "",
                  tags: a.tags || [],
                  status: a.confirmed ? "confirmed" : "extracted",
                  // === AI 剧本分析扩展字段 ===
                  importance_level: a.importanceLevel,
                  owner: a.owner,
                  shape: a.shape,
                  texture: a.texture,
                  story_function: a.storyFunction,
                  visual_features: a.visualFeatures,
                  camera_usage: a.cameraUsage,
                  generation_prompt: a.generationPrompt,
                  first_appearance: a.firstAppearance,
                  confidence: a.confidence,
                })),
            }
          );
        } catch (saveErr) {
          console.warn("保存分析资产到后端失败:", saveErr);
        }
      }
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
              // === AI 剧本分析扩展字段 ===
              identity: asset.identity,
              face: asset.face,
              hair: asset.hair,
              body: asset.body,
              temperament: asset.temperament,
              costume_name: asset.costumeName,
              costume_description: asset.costumeDescription,
              costume_color: asset.costumeColor,
              costume_material: asset.costumeMaterial,
              costume_style: asset.costumeStyle,
              accessories: asset.accessories,
              emotion_states: asset.emotionStates,
              action_assets: asset.actionAssets,
              relationships: asset.relationships,
              first_appearance: asset.firstAppearance,
              dialogue_count: asset.dialogueCount,
              generation_prompt: asset.generationPrompt,
              confidence: asset.confidence,
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
              // === AI 剧本分析扩展字段 ===
              generation_prompt: asset.generationPrompt,
              confidence: asset.confidence,
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
              // === AI 剧本分析扩展字段 ===
              appearance: `${asset.shape || ""} ${asset.texture || ""}`.trim() || undefined,
              generation_prompt: asset.generationPrompt,
              confidence: asset.confidence,
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
      const transferredIds: string[] = [];
      setExtractedAssets((prev) =>
        prev.map((a) => {
          if (a.type === type && a.confirmed && !a.id.startsWith("transferred-")) {
            transferredIds.push(a.id);
            return { ...a, confirmed: false, id: `transferred-${a.id}` };
          }
          return a;
        })
      );
      // 同步更新后端关联表状态为 transferred
      for (const assetId of transferredIds) {
        if (!assetId.startsWith("character-") && !assetId.startsWith("scene-") && !assetId.startsWith("prop-")) {
          try {
            if (type === "character") {
              await scriptCenterService.updateAnalyzedCharacter(assetId, { status: "transferred" });
            } else if (type === "scene") {
              await scriptCenterService.updateAnalyzedScene(assetId, { status: "transferred" });
            } else if (type === "prop") {
              await scriptCenterService.updateAnalyzedProp(assetId, { status: "transferred" });
            }
          } catch (err) {
            console.warn(`更新后端分析资产状态失败 (${assetId}):`, err);
          }
        }
      }
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
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${viewMode === "list" ? "bg-emerald-500/20 text-emerald-400" : "text-[#888] hover:text-white"
                  }`}
                onClick={() => setViewMode("list")}
                title="列表视图"
              >
                <ListIcon className="h-3 w-3" />
                列表
              </button>
              <button
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${viewMode === "classification" ? "bg-emerald-500/20 text-emerald-400" : "text-[#888] hover:text-white"
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
              description={searchQuery || statusFilter ? "尝试调整搜索条件" : "点击上方按钮导入剧本"}
            />
          )
        ) : filteredScripts.length > 0 ? (
          <>
            <div className="rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>剧本标题</TableHead>
                    <TableHead className="hidden md:table-cell">作者</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead className="hidden sm:table-cell">字数</TableHead>
                    <TableHead className="hidden lg:table-cell">章节</TableHead>
                    <TableHead className="hidden md:table-cell">更新时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedScripts.map((script) => (
                    <ScriptRow
                      key={script.id}
                      script={script}
                      onOpenEditor={() => handleOpenEditor(script.id)}
                      onDelete={() => setDeleteConfirm({ id: script.id, title: script.title })}
                      onTagManager={() => handleOpenTagManager(script)}
                      onAnalysis={() => handleOpenAnalysis(script)}
                      onApproval={() => handleOpenApproval(script)}
                    />
                  ))}
                </TableBody>
              </Table>
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
            description={searchQuery || statusFilter ? "尝试调整搜索条件" : "点击上方按钮导入剧本"}
          />
        )}
      </PageCard>

      {/* 新建/编辑对话框已移除 */}

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
              <div className="rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>标题</TableHead>
                      <TableHead>作者</TableHead>
                      <TableHead>删除时间</TableHead>
                      <TableHead>剩余天数</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deletedScripts.map((script) => {
                      const remaining = scriptRemainingDays(script.deleted_at);
                      const canPurge = remaining <= 0;
                      return (
                        <TableRow key={script.id}>
                          <TableCell className="text-foreground">{script.title}</TableCell>
                          <TableCell className="text-muted-foreground">{script.author}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {script.deleted_at ? new Date(script.deleted_at).toLocaleString() : "—"}
                          </TableCell>
                          <TableCell>
                            {canPurge ? (
                              <Badge variant="success">可清理</Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">{remaining} 天后自动清理</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="inline-flex items-center gap-2">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleRestoreScript(script)}
                              >
                                <RotateCcw className="mr-1 h-3 w-3" />
                                恢复
                              </Button>
                              <Tip
                                label={canPurge ? "彻底删除（级联清理所有关联数据）" : `需软删满 30 天才能彻底删除（还剩 ${remaining} 天）`}
                                side="top"
                              >
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  disabled={!canPurge}
                                  onClick={() => setRecycleBinAction({ type: "purge", script })}
                                >
                                  <Trash2 className="mr-1 h-3 w-3" />
                                  彻底删除
                                </Button>
                              </Tip>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
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
            analyzeStatus={analyzeStatus}
            onAnalyze={handleAnalyzeScript}
            onOpenEditor={() => handleOpenEditor(selectedScript.id)}
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
          // 导入成功后自动关闭导入弹框（修复：之前只重置内部预览层，
          // 外层 ScriptImportDialog 一直保留，挡住了剧本列表）
          setShowImport(false);
        }}
      />
    </PageContainer>
  );
}
