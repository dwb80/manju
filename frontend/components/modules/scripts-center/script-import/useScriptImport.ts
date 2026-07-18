"use client";

/**
 * 剧本导入业务逻辑 hook
 *
 * 封装 ScriptImportDialog 内部的状态机：
 *  - 文件选择 / 文本输入
 *  - AI 大模型分析（按项目硬约束，不使用本地正则解析兜底）
 *  - 角色/场景/道具与工厂资产匹配
 *  - 确认导入：写入 Script / ScriptDocument / Episode / Scene / Dialogue
 *    + 持久化完整 AI 原始数据到 ScriptDocument.ai_raw_data
 *    + 不写入角色工厂 / 场景工厂 / 道具工厂
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { notify } from "@/lib/notify";
import { api } from "@/lib/api-client";
import {
  listCharacters,
  listScenes,
  listProps,
  createScriptEpisodeApi,
  createScriptSceneApi,
  createScriptDialogueApi,
} from "@/services/module.service";
import { scriptCenterService } from "@/services/script-center.service";
import {
  aiAnalyzeScript,
  aiEpisodesToEditorJson,
  formatSceneAnchor,
} from "./utils";
import type { ImportFormat } from "../types";
import type {
  PreviewCharacter,
  PreviewEpisode,
  PreviewPropAsset,
  PreviewResult,
  PreviewSceneAsset,
} from "./types";

/** 模型中心 - 剧本分析可用的聊天模型（仅取 is_enabled=true 的子集） */
export interface ImportChatModel {
  id: string;
  name: string;
  description?: string;
  isDefault: boolean;
  is_enabled: boolean;
  provider?: string;
}

export function useScriptImport({
  projectId,
  onImported,
}: {
  projectId: string | null;
  onImported: () => void | Promise<void>;
}) {
  // 导入状态机
  const [importFormat, setImportFormat] = useState<ImportFormat>("txt");
  const [importText, setImportText] = useState("");
  const [importFileName, setImportFileName] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [isAnalyzingScript, setIsAnalyzingScript] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 模型选择状态：剧本分析只能用聊天模型（按 type=chat 过滤；后端 model_configs 中每个 type 仅一个 isDefault）
  const [chatModels, setChatModels] = useState<ImportChatModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  /**
   * 从模型中心拉取所有聊天模型（type=chat），只保留 is_enabled=true 的；
   * 默认选中"默认模型"（isDefault=true），若没有则选第一个。
   */
  const loadChatModels = useCallback(async () => {
    setIsLoadingModels(true);
    try {
      const data = await api<ImportChatModel[]>("/api/models?type=chat");
      const enabled = (Array.isArray(data) ? data : []).filter((m) => m && m.is_enabled);
      setChatModels(enabled);
      // 默认值优先级：isDefault=true > 第一项；保持当前选择若仍在启用列表中
      setSelectedModelId((prev) => {
        if (prev && enabled.some((m) => m.id === prev)) return prev;
        const def = enabled.find((m) => m.isDefault);
        return def?.id || enabled[0]?.id || "";
      });
    } catch (err) {
      console.warn("[ScriptImport] 加载聊天模型失败：", err);
      setChatModels([]);
      // 留空 selectedModelId：UI 端需显示"无模型"提示，让用户去模型中心配置
    } finally {
      setIsLoadingModels(false);
    }
  }, []);

  /** 选择文件后回填文本框 + 自动按扩展名选格式 */
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 文件大小上限 5MB：超出后拒绝读取并提示
    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      notify.error(
        "文件过大",
        `${file.name} 大小为 ${(file.size / 1024 / 1024).toFixed(2)} MB，超过 5MB 上限`
      );
      // 重置 input 以允许用户重选同一文件
      event.target.value = "";
      return;
    }

    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setImportText(text);
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext === "md" || ext === "markdown") setImportFormat("markdown");
      else if (ext === "fountain") setImportFormat("fountain");
      else if (ext === "json") setImportFormat("json");
      else if (ext === "fdx") setImportFormat("fdx");
      else setImportFormat("txt");
    };
    reader.readAsText(file);
  }, []);

  /**
   * 解析剧本内容，生成预览（不写入数据库）。
   * 按项目硬约束：仅走 AI 大模型分析，失败时直接报错，不做正则兜底。
   */
  const handleParsePreview = useCallback(async () => {
    if (!importText.trim()) {
      notify.warn("请输入或上传剧本内容");
      return;
    }
    // 兜底：万一模型列表还没拉完（极短窗口），等一次
    if (chatModels.length === 0 && !isLoadingModels) {
      await loadChatModels();
    }
    if (!selectedModelId) {
      notify.error(
        "无可用的聊天模型",
        "请先到「模型中心」配置并启用至少一个聊天模型（type=chat），再返回剧本中心重试。"
      );
      return;
    }

    setIsAnalyzingScript(true);
    setAnalysisStatus("正在调用大模型分析剧本...");

    // 1) 仅调用 AI 分析（不再有正则兜底）；失败时 aiAnalyzeScript 会抛出带原因的 Error
    let aiResult: Awaited<ReturnType<typeof aiAnalyzeScript>>;
    try {
      aiResult = await aiAnalyzeScript(importText, importFormat, { model: selectedModelId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "未知错误";
      console.warn("[ScriptImport] AI 分析失败：", msg, err);
      setIsAnalyzingScript(false);
      setAnalysisStatus("");
      notify.error("AI 分析失败", msg);
      return;
    }

    const {
      characters,
      sceneAssets,
      propAssets,
      episodes,
      title: aiTitle,
      warnings,
      aiRawResponse,
      model: aiModel,
    } = aiResult;

    const title =
      aiTitle ||
      (episodes[0]?.title ? `${episodes[0].title}` : "") ||
      importFileName ||
      `导入剧本 ${new Date().toLocaleDateString()}`;

    const editorJson = aiEpisodesToEditorJson(episodes);

    setIsAnalyzingScript(false);
    setAnalysisStatus("");

    // 解析成功：把"使用了哪个大模型"明确告诉用户（"使用 agnes-2.0-flash 解析成功"）
    // 后端已确保 aiModel === 实际请求的模型 id；如果为空则只显示"解析成功"
    if (aiModel) {
      notify.success("解析成功", `使用 ${aiModel} 完成`);
    } else {
      notify.success("解析成功", "已完成 AI 解析");
    }

    try {
      setPreview({
        title,
        format: importFormat,
        file_name: importFileName,
        editor_json: editorJson,
        episodes,
        characters,
        sceneAssets,
        propAssets,
        source: "ai",
        warnings: warnings.length ? warnings : undefined,
        aiRawResponse,
      });
      setShowPreview(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "未知错误";
      console.error("[ScriptImport] setPreview 失败：", err);
      notify.error(
        "预览数据准备失败",
        msg + "\n请检查 AI 返回的数据结构是否与预期一致（console 看完整堆栈）"
      );
      return;
    }

    // 异步查现有角色做资产匹配（只读，不写入）
    void matchCharactersWithFactory(projectId, characters);
    // 异步匹配场景/道具（只读，不写入）
    void matchScenesAndPropsWithFactory(projectId, sceneAssets, propAssets);
  }, [importText, importFileName, importFormat, projectId, selectedModelId, chatModels, isLoadingModels, loadChatModels]);

  /**
   * 把解析出的角色名与角色工厂已有资产做匹配。
   * 注意：仅做"匹配/显示"，不会写入角色工厂。
   */
  const matchCharactersWithFactory = useCallback(async (
    projId: string | null,
    chars: PreviewCharacter[]
  ) => {
    if (!projId || chars.length === 0) return;
    try {
      const existing = (await listCharacters(projId)) as Array<{
        id: string;
        name: string;
        description?: string;
        image_url?: string;
        image?: string;
      }>;
      const byName = new Map(
        existing
          .filter((c) => c && c.name)
          .map((c) => [String(c.name).trim().toLowerCase(), c])
      );
      setPreview((prev) => {
        if (!prev) return prev;
        const updated = prev.characters.map((c) => {
          const hit = byName.get(c.name.trim().toLowerCase());
          if (hit) {
            return {
              ...c,
              matchedCharacterId: hit.id,
              matchedCharacterDescription: hit.description,
              matchedImageUrl: hit.image_url || hit.image,
              matchStatus: "matched" as const,
            };
          }
          // 未命中：仅在 Preview 中标记，导入时不会再写入角色工厂
          return { ...c, matchStatus: "will_create" as const };
        });
        return { ...prev, characters: updated };
      });
    } catch (err) {
      console.warn("角色资产匹配失败：", err);
      setPreview((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          characters: prev.characters.map((c) => ({ ...c, matchStatus: "will_create" as const })),
        };
      });
    }
  }, []);

  /**
   * 把解析出的场景/道具资产与工厂已有资产做匹配。
   * 注意：仅做"匹配/显示"，不会写入场景/道具工厂。
   */
  const matchScenesAndPropsWithFactory = useCallback(async (
    projId: string | null,
    sceneAssets: PreviewSceneAsset[],
    propAssets: PreviewPropAsset[]
  ) => {
    if (!projId) return;
    try {
      const [existingScenes, existingProps] = await Promise.all([
        (listScenes(projId) as any) as Promise<
          Array<{
            id: string;
            name?: string;
            location_name?: string;
            image_url?: string;
            image?: string;
          }>
        >,
        (listProps(projId) as any) as Promise<
          Array<{ id: string; name: string; image_url?: string; image?: string }>
        >,
      ]);

      const sceneByKey = new Map<string, any>();
      for (const s of existingScenes || []) {
        if (!s) continue;
        const key = `${s.location_name || s.name || ""}`.trim().toLowerCase();
        if (key) sceneByKey.set(key, s);
      }
      const propByKey = new Map<string, any>();
      for (const p of existingProps || []) {
        if (!p || !p.name) continue;
        propByKey.set(p.name.trim().toLowerCase(), p);
      }

      setPreview((prev) => {
        if (!prev) return prev;
        const updatedScenes = prev.sceneAssets.map((s) => {
          const key = (s.location_name || "").trim().toLowerCase();
          const hit = sceneByKey.get(key);
          if (hit) {
            return {
              ...s,
              matchedSceneId: hit.id,
              matchedImageUrl: hit.image_url || hit.image,
              matchStatus: "matched" as const,
            };
          }
          return { ...s, matchStatus: "will_create" as const };
        });
        const updatedProps = prev.propAssets.map((p) => {
          const key = (p.name || "").trim().toLowerCase();
          const hit = propByKey.get(key);
          if (hit) {
            return {
              ...p,
              matchedPropId: hit.id,
              matchedImageUrl: hit.image_url || hit.image,
              matchStatus: "matched" as const,
            };
          }
          return { ...p, matchStatus: "will_create" as const };
        });
        return { ...prev, sceneAssets: updatedScenes, propAssets: updatedProps };
      });
    } catch (err) {
      console.warn("场景/道具资产匹配失败：", err);
      setPreview((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          sceneAssets: prev.sceneAssets.map((s) => ({ ...s, matchStatus: "will_create" as const })),
          propAssets: prev.propAssets.map((p) => ({ ...p, matchStatus: "will_create" as const })),
        };
      });
    }
  }, []);

  /**
   * 确认导入（按项目硬约束：不写入角色/场景/道具工厂）
   *
   * 步骤：
   * 1. POST /api/projects/:id/scripts        —— 创建剧本文档，editor_json + 完整 ai_raw_data
   * 2. 对未匹配角色：在对白写入时直接用角色名（character_id 留空），不创建工厂角色
   * 3. 对未匹配场景/道具：不创建工厂资产，AI 完整数据已存在 ai_raw_data 中
   * 4. 逐条 POST episode → scene → dialogue
   */
  const handleConfirmImport = useCallback(async () => {
    if (!preview) return;
    if (!projectId) {
      notify.warn("请先选择一个项目");
      return;
    }
    // 拦截：资产匹配未完成时，禁止导入（避免重复创建）
    const hasUnresolved = [...preview.characters, ...preview.sceneAssets, ...preview.propAssets]
      .some((a) => a.matchStatus === "unresolved");
    if (hasUnresolved) {
      notify.warn(
        "资产匹配未完成",
        "请等待角色/场景/道具与现有工厂资产的匹配完成后再确认"
      );
      return;
    }
    setIsImporting(true);
    try {
      const finalTitle =
        preview.title.trim() ||
        preview.file_name ||
        `导入剧本 ${new Date().toLocaleDateString()}`;

      // 把 AI 完整数据序列化后保存到 ScriptDocument.ai_raw_data（不写入任何工厂）
      const aiRawDataJson = JSON.stringify(preview.aiRawResponse ?? {});

      // 1. 创建剧本文档（统一数据源）+ 携带完整 AI 原始数据
      const script = await scriptCenterService.createDocument({
        project_id: projectId,
        title: finalTitle,
        author: "当前用户",
        status: "draft",
        editor_json: JSON.stringify(preview.editor_json),
        ai_raw_data: aiRawDataJson,
        version: 1,
      } as any);
      const scriptId = script.id;

      // 1.5 写入剧本中心 analyzed-assets（独立表），让"剧本编辑器右侧面板"能从这里读到
      //   - 这里不复用工厂：角色/场景/道具的"剧本侧"和"工厂侧"解耦
      //   - 工厂那条路只在用户主动点"流转到工厂"时触发（见 updateAnalyzedCharacter 等 PATCH）
      //   - matched* 字段映射成 factory_*_id，方便后续 PATCH 关联，不影响右侧面板显示
      await scriptCenterService.saveAnalyzedAssets(
        scriptId,
        projectId,
        {
          characters: preview.characters.map((c) => ({
            name: c.name,
            role: c.role || "",
            gender: c.gender || "",
            age: c.age || "",
            description: c.description || "",
            appearance: c.appearance || "",
            personality: c.personality || "",
            traits: Array.isArray(c.traits) ? c.traits : [],
            tags: [],
            status: "extracted",
            factory_character_id: c.matchedCharacterId || undefined,
            importance_level: c.role || "",
            dialogue_count: c.dialogueCount || 0,
          })),
          scenes: preview.sceneAssets.map((s) => ({
            name: s.location_name || s.first_appearance || "未命名场景",
            type: "outdoor",
            scene_type: "outdoor",
            description: s.description || "",
            lighting: "",
            time_of_day: s.time_of_day || "",
            weather: "",
            tags: [],
            status: "extracted",
            factory_scene_id: s.matchedSceneId || undefined,
          })),
          props: preview.propAssets.map((p) => ({
            name: p.name,
            category: p.category || "",
            description: p.description || "",
            appearance: "",
            material: p.material || "",
            size: p.size || "",
            color: p.color || "",
            tags: [],
            owner: p.owner || "",
            status: "extracted",
            factory_prop_id: p.matchedPropId || undefined,
            importance_level: "",
          })),
        }
      );

      // 2. 构建"对白角色名 → 工厂中已有角色 id"映射
      //    仅复用 matched 的（已存在工厂中的），不自动创建未匹配的
      const charIdMap = new Map<string, string>();
      for (const pc of preview.characters) {
        if (pc.matchedCharacterId) {
          charIdMap.set(pc.name, pc.matchedCharacterId);
        }
        // 未匹配的角色：character_id 留空，对白仍写入，character 名称保留
      }

      // 3. 逐条写入 episode → scene → dialogue
      //    重要：场景/道具资产不再调用 createScene/createProp，AI 完整数据已在 ai_raw_data 中
      for (const ep of preview.episodes) {
        const epResp = await createScriptEpisodeApi({
          project_id: projectId,
          document_id: scriptId,
          episode_no: ep.episode_no,
          title: ep.title,
          synopsis: ep.synopsis || "",
          status: (ep.status as any) || "draft",
        });
        const episodeId = (epResp as any).id;

        for (const scene of ep.scenes) {
          const scResp = await createScriptSceneApi({
            project_id: projectId,
            episode_id: episodeId,
            scene_no: scene.scene_no,
            location_name: formatSceneAnchor(scene),
            time_of_day: (scene.time_of_day as any) || "day",
            description: [
              scene.location_name ? `地点：${scene.location_name}` : "",
              scene.description || "",
            ].filter(Boolean).join("\n"),
            notes: "",
          });
          const sceneId = (scResp as any).id;

          for (const d of scene.dialogues) {
            // 仅在有匹配角色时填 character_id；否则留空，对白仍然写入以保留完整数据
            const characterId = charIdMap.get(d.character) || "";
            try {
              await createScriptDialogueApi({
                project_id: projectId,
                scene_id: sceneId,
                character_id: characterId,
                character_name: d.character || "",
                dialogue: d.text || "",
                emotion: d.emotion || "",
                order: d.order ?? 0,
              } as any);
            } catch (err) {
              console.warn(`对白写入失败 (${d.character})：`, err);
            }
          }
        }
      }

      setShowPreview(false);
      setPreview(null);
      onImported();
      setImportText("");
      setImportFileName("");
      notify.success(
        "导入成功",
        `《${finalTitle}》已写入：${preview.characters.length} 角色 / ${preview.sceneAssets.length} 场景 / ${preview.propAssets.length} 道具（剧本中心）/ ${preview.episodes.length} 集`
      );
    } catch (err) {
      console.error("导入失败:", err);
      notify.error(
        "导入失败",
        "请检查内容格式是否正确：" +
          (err instanceof Error ? err.message : "未知错误")
      );
    } finally {
      setIsImporting(false);
    }
  }, [preview, projectId, onImported]);

  /** 取消预览，返回编辑 */
  const handleCancelPreview = useCallback(() => {
    setShowPreview(false);
    setPreview(null);
  }, []);

  /**
   * 关闭整个对话框
   * - 若正在 AI 分析或导入中，弹确认对话框询问是否中断
   * - 否则直接重置状态
   */
  const handleClose = useCallback(() => {
    if (isAnalyzingScript || isImporting) {
      const action = isImporting ? "导入" : "AI 解析";
      const ok = window.confirm(
        `${action}正在进行中，确定要中断并关闭吗？\n已输入的内容将被丢弃。`
      );
      if (!ok) return;
    }
    setShowPreview(false);
    setPreview(null);
    setImportText("");
    setImportFileName("");
  }, [isAnalyzingScript, isImporting]);

  /** 同步更新预览中的标题（用户在预览弹窗里编辑） */
  const updatePreviewTitle = useCallback((title: string) => {
    setPreview((prev) => (prev ? { ...prev, title } : prev));
  }, []);

  // 首次挂载时拉取聊天模型
  useEffect(() => {
    void loadChatModels();
  }, [loadChatModels]);

  return {
    // 状态
    importFormat, setImportFormat,
    importText, setImportText,
    importFileName, setImportFileName,
    isImporting,
    isAnalyzingScript,
    analysisStatus,
    preview, setPreview,
    showPreview,
    fileInputRef,

    // 模型选择
    chatModels,
    selectedModelId,
    setSelectedModelId,
    isLoadingModels,
    reloadChatModels: loadChatModels,

    // 行为
    handleFileSelect,
    handleParsePreview,
    handleConfirmImport,
    handleCancelPreview,
    handleClose,
    updatePreviewTitle,
  };
}

export type UseScriptImportReturn = ReturnType<typeof useScriptImport>;
