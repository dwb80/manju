"use client";

/**
 * 剧本导入业务逻辑 hook
 *
 * 封装 ScriptImportDialog 内部的状态机：
 *  - 文件选择 / 文本输入
 *  - AI 优先解析 + 本地正则回退
 *  - 角色/场景/道具与工厂资产匹配
 *  - 确认导入（写入 Script / ScriptDocument / Episode / Scene / Dialogue + 自动建资产）
 */

import { useCallback, useRef, useState } from "react";
import {
  listCharacters,
  createCharacter,
  createScriptDocumentApi,
  createScriptEpisodeApi,
  createScriptSceneApi,
  createScriptDialogueApi,
  createScript,
  listScenes,
  createScene,
  listProps,
  createProp,
} from "@/services/module.service";
import {
  aiAnalyzeScript,
  aiEpisodesToEditorJson,
  extractCharactersFromEpisodes,
  extractSceneAssetsFromEpisodes,
  extractPropsFromText,
  formatSceneAnchor,
  markdownToEditorJson,
  normalizeSceneName,
  normalizeTimeOfDay,
  textToEditorJson,
  parseMarkdownToEpisodes,
} from "./utils";
import { parseFountain, parseFDX } from "../utils";
import type { ImportFormat } from "../types";
import type {
  PreviewCharacter,
  PreviewEpisode,
  PreviewPropAsset,
  PreviewResult,
  PreviewSceneAsset,
} from "./types";

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

  /** 选择文件后回填文本框 + 自动按扩展名选格式 */
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

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
   * 对齐需求文档 Feature 4.5 流程：解析 → 预览展示 → 用户确认。
   */
  const handleParsePreview = useCallback(async () => {
    if (!importText.trim()) {
      alert("请输入或上传剧本内容");
      return;
    }

    setIsAnalyzingScript(true);
    setAnalysisStatus("正在调用大模型分析剧本...");

    let title = importFileName || `导入剧本 ${new Date().toLocaleDateString()}`;
    let editorJson: any = textToEditorJson(importText);
    let episodes: PreviewEpisode[] = [];
    let sceneAssets: PreviewSceneAsset[] = [];
    let propAssets: PreviewPropAsset[] = [];
    let characters: PreviewCharacter[] = [];
    let source: "ai" | "local" = "local";
    let warnings: string[] = [];

    // 1) 优先调用 AI 分析（会同时拿到 characters/scenes/props/episodes）
    const aiResult = await aiAnalyzeScript(importText, importFormat);
    if (aiResult) {
      source = aiResult.source;
      characters = aiResult.characters;
      sceneAssets = aiResult.sceneAssets;
      propAssets = aiResult.propAssets;
      episodes = aiResult.episodes;
      warnings = aiResult.warnings;
      if (aiResult.title) {
        title = aiResult.title;
      } else if (aiResult.episodes[0]?.title) {
        title = aiResult.episodes[0].title;
      }
      editorJson = aiEpisodesToEditorJson(episodes);
    } else {
      // 2) 兜底：本地正则解析
      setAnalysisStatus("AI 不可用，回退到本地解析...");
      switch (importFormat) {
        case "json": {
          try {
            const data = JSON.parse(importText);
            title = data.title || data.name || data.document?.title || title;
            if (data.editor_json) {
              editorJson = typeof data.editor_json === "string"
                ? JSON.parse(data.editor_json)
                : data.editor_json;
            } else if (data.document?.editor_json) {
              editorJson = typeof data.document.editor_json === "string"
                ? JSON.parse(data.document.editor_json)
                : data.document.editor_json;
            } else {
              editorJson = textToEditorJson(data.description || data.content || importText);
            }
            if (Array.isArray(data.episodes)) {
              episodes = data.episodes.map((ep: any, idx: number) => ({
                episode_no: ep.episode_no ?? ep.episodeNo ?? idx + 1,
                title: ep.title || `第${idx + 1}集`,
                synopsis: ep.synopsis || "",
                status: ep.status || "draft",
                scenes: Array.isArray(ep.scenes)
                  ? ep.scenes.map((s: any, sIdx: number) => ({
                      scene_no: s.scene_no ?? sIdx + 1,
                      scene_name: normalizeSceneName(s.scene_name || s.name || "", s.location_name || s.location || "", s.scene_no ?? sIdx + 1, s.description || ""),
                      location_name: s.location_name || s.location || "",
                      time_of_day: normalizeTimeOfDay(s.time_of_day || s.time || "day"),
                      description: s.description || "",
                      dialogues: Array.isArray(s.dialogues)
                        ? s.dialogues.map((d: any, dIdx: number) => ({
                            character: d.character || "",
                            text: d.text || "",
                            emotion: d.emotion || "",
                            order: d.order ?? dIdx,
                          }))
                        : [],
                    }))
                  : [],
              }));
            }
          } catch {
            episodes = [];
          }
          break;
        }
        case "fountain": {
          const parsed = parseFountain(importText);
          title = parsed.title || title;
          editorJson = textToEditorJson(parsed.content);
          episodes = parseMarkdownToEpisodes(parsed.content);
          break;
        }
        case "fdx": {
          const parsed = parseFDX(importText);
          title = parsed.title || title;
          editorJson = textToEditorJson(parsed.content);
          episodes = parseMarkdownToEpisodes(parsed.content);
          break;
        }
        case "markdown": {
          const titleMatch = importText.match(/^#\s+(.+)$/m);
          if (titleMatch) title = titleMatch[1];
          editorJson = markdownToEditorJson(importText);
          episodes = parseMarkdownToEpisodes(importText);
          break;
        }
        default: {
          editorJson = textToEditorJson(importText);
          episodes = parseMarkdownToEpisodes(importText);
          break;
        }
      }
      characters = extractCharactersFromEpisodes(episodes);
      sceneAssets = extractSceneAssetsFromEpisodes(episodes);
      propAssets = extractPropsFromText(importText, episodes);
    }

    // 兜底：若没有解析到剧集，则默认生成 1 集
    if (episodes.length === 0) {
      episodes = [
        { episode_no: 1, title, synopsis: "", status: "draft", scenes: [] },
      ];
    }

    episodes = episodes.map((ep, epIdx) => ({
      ...ep,
      episode_no: ep.episode_no || epIdx + 1,
      title: ep.title || `第${ep.episode_no || epIdx + 1}集`,
      scenes: ep.scenes.map((scene, sceneIdx) => ({
        ...scene,
        scene_no: scene.scene_no || sceneIdx + 1,
        scene_name: normalizeSceneName(scene.scene_name, scene.location_name, scene.scene_no || sceneIdx + 1, scene.description),
      })),
    }));
    if (sceneAssets.length === 0) {
      sceneAssets = extractSceneAssetsFromEpisodes(episodes);
    }
    if (propAssets.length === 0) {
      propAssets = extractPropsFromText(importText, episodes);
    }
    editorJson = aiEpisodesToEditorJson(episodes);

    setIsAnalyzingScript(false);
    setAnalysisStatus("");

    setPreview({
      title,
      format: importFormat,
      file_name: importFileName,
      editor_json: editorJson,
      episodes,
      characters,
      sceneAssets,
      propAssets,
      source,
      warnings: warnings.length ? warnings : undefined,
    });
    setShowPreview(true);

    // 异步查现有角色做资产匹配
    void matchCharactersWithFactory(projectId, characters);
    // 异步匹配场景/道具
    void matchScenesAndPropsWithFactory(projectId, sceneAssets, propAssets);
  }, [importText, importFileName, importFormat, projectId]);

  /**
   * 把解析出的角色名与角色工厂已有资产做匹配。
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
   * 确认导入：走新接口（plan B 路线）
   *
   * 步骤：
   * 1. POST /api/projects/:id/scripts        —— 创建基础剧本记录
   * 2. POST /api/script-documents            —— 创建富文本文档（editor_json）
   * 3. 对未匹配角色自动调用 createCharacter 建资产
   * 4. 对未匹配场景自动调用 createScene 建资产
   * 5. 对未匹配道具自动调用 createProp 建资产
   * 6. 逐条 POST episode → scene → dialogue
   */
  const handleConfirmImport = useCallback(async () => {
    if (!preview) return;
    if (!projectId) {
      alert("请先选择一个项目");
      return;
    }
    setIsImporting(true);
    try {
      const finalTitle =
        preview.title.trim() ||
        preview.file_name ||
        `导入剧本 ${new Date().toLocaleDateString()}`;
      // 1. 创建基础剧本记录
      const script = await createScript(projectId, {
        title: finalTitle,
        description: preview.editor_json
          ? `由 ${preview.format.toUpperCase()} 导入 · ${preview.file_name || "粘贴内容"}`
          : `由 ${preview.format.toUpperCase()} 导入`,
        author: "当前用户",
        status: "draft",
      } as any);
      const scriptId = (script as any).id;
      const documentId = (script as any).document_id || scriptId;

      // 2. 创建剧本文档（写入 Tiptap editor_json）。
      //    关键：显式传入 id=scriptId，使 ScriptDocument.id 与 Script.id 一致。
      try {
        await createScriptDocumentApi({
          id: scriptId,
          project_id: projectId,
          editor_json: JSON.stringify(preview.editor_json),
          version: 1,
        });
      } catch (err) {
        // ScriptDocument 是辅助表，失败不阻塞主流程
        console.warn("创建剧本文档失败（不阻塞导入）：", err);
      }

      // 3. 处理未匹配角色：自动创建
      const charIdMap = new Map<string, string>();
      for (const pc of preview.characters) {
        if (pc.matchedCharacterId) {
          charIdMap.set(pc.name, pc.matchedCharacterId);
          continue;
        }
        if (pc.matchStatus === "unresolved") {
          // 匹配未完成的，按"将创建"处理
        }
        try {
          // 组合多段描述：AI 提取的 appearance/personality 优先，其次是 dialogueCount 摘要
          const descParts: string[] = [];
          if (pc.appearance) descParts.push(`【外貌】${pc.appearance}`);
          if (pc.personality) descParts.push(`【性格】${pc.personality}`);
          if (!descParts.length) {
            descParts.push(`从剧本《${finalTitle}》自动导入 · 出现于 ${pc.dialogueCount} 句对白`);
          }
          if (pc.description) descParts.push(pc.description);
          const mergedDescription = descParts.join("\n");

          // 合并 tags：基础标签 + AI 提取的 traits
          const mergedTags = Array.from(
            new Set([
              "从剧本导入",
              ...((pc.traits || []).filter(Boolean) as string[]),
            ])
          );

          const created = await createCharacter({
            project_id: projectId,
            name: pc.name,
            role: pc.role || "minor",
            gender: pc.gender || "other",
            description: mergedDescription,
            traits: pc.traits || [],
            tags: mergedTags,
          } as any);
          charIdMap.set(pc.name, (created as any).id);
        } catch (err) {
          console.warn(`创建角色 ${pc.name} 失败：`, err);
        }
      }

      // 3.5 处理未匹配场景：自动创建到场景工厂
      const sceneIdMap = new Map<string, string>();
      for (const sa of preview.sceneAssets) {
        if (sa.matchedSceneId) {
          sceneIdMap.set(sa.location_name, sa.matchedSceneId);
          continue;
        }
        try {
          const created = await createScene({
            project_id: projectId,
            name: sa.location_name || "未命名场景",
            location_name: sa.location_name || "未命名场景",
            time_of_day: (sa.time_of_day as any) || "day",
            atmosphere: sa.atmosphere || "",
            description: sa.description || "",
            tags: sa.visual_keywords || ["从剧本导入"],
          } as any);
          sceneIdMap.set(sa.location_name, (created as any).id);
        } catch (err) {
          console.warn(`创建场景 ${sa.location_name} 失败：`, err);
        }
      }

      // 3.6 处理未匹配道具：自动创建到道具工厂
      const propIdMap = new Map<string, string>();
      for (const pa of preview.propAssets) {
        if (pa.matchedPropId) {
          propIdMap.set(pa.name, pa.matchedPropId);
          continue;
        }
        try {
          const created = await createProp({
            project_id: projectId,
            name: pa.name,
            category: (pa.category as any) || "other",
            description: pa.description || "",
            color: pa.color || "",
            material: pa.material || "",
            size: pa.size || "",
            owner: pa.owner || "",
            tags: ["从剧本导入"],
          } as any);
          propIdMap.set(pa.name, (created as any).id);
        } catch (err) {
          console.warn(`创建道具 ${pa.name} 失败：`, err);
        }
      }

      // 4. 逐条写入 episode → scene → dialogue
      for (const ep of preview.episodes) {
        const epResp = await createScriptEpisodeApi({
          project_id: projectId,
          document_id: documentId,
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
            const characterId = charIdMap.get(d.character);
            if (!characterId) continue; // 跳过没有 character_id 的对白（不阻塞）
            try {
              await createScriptDialogueApi({
                project_id: projectId,
                scene_id: sceneId,
                character_id: characterId,
                dialogue: d.text || "",
                emotion: d.emotion || "",
                order: d.order ?? 0,
              });
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
    } catch (err) {
      console.error("导入失败:", err);
      alert(
        "导入失败，请检查内容格式是否正确：" +
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

  /** 关闭整个对话框，重置状态 */
  const handleClose = useCallback(() => {
    setShowPreview(false);
    setPreview(null);
    setImportText("");
    setImportFileName("");
  }, []);

  /** 同步更新预览中的标题（用户在预览弹窗里编辑） */
  const updatePreviewTitle = useCallback((title: string) => {
    setPreview((prev) => (prev ? { ...prev, title } : prev));
  }, []);

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
