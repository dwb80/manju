/**
 * 剧本导入模块 - 工具函数
 *
 * 注意：本文件已移除所有"本地正则解析"逻辑（按项目硬约束，不使用正则解析剧本）。
 * 所有剧本内容都走 `aiAnalyzeScript` 大模型路径；失败时返回 null，调用方需直接报错。
 */

import type {
  PreviewScene,
  PreviewEpisode,
  PreviewCharacter,
  PreviewSceneAsset,
  PreviewPropAsset,
} from "./types";

/** 规范化时间段枚举 */
export function normalizeTimeOfDay(value: string): "day" | "night" | "dawn" | "dusk" {
  const v = (value || "").toLowerCase();
  if (v.includes("夜") || v.includes("night")) return "night";
  if (v.includes("黄昏") || v.includes("傍晚") || v.includes("dusk")) return "dusk";
  if (v.includes("晨") || v.includes("黎明") || v.includes("dawn")) return "dawn";
  return "day";
}

/**
 * 调用后端 AI 剧本分析接口（POST /api/ai/script-analyze）
 *
 * 返回的 aiRawResponse 字段会保存后端原始 data，导入时整体持久化到剧本文档，
 * 不丢失任何 AI 返回的字段（即使前端预览不展示的也保留）。
 *
 * 失败时抛出 Error，message 中带具体原因（HTTP 状态 / 后端 error 字段 / 超时 / 网络），
 * 调用方需捕获并直接展示给用户。
 */
export async function aiAnalyzeScript(
  content: string,
  format: string,
  options: { timeoutMs?: number; model?: string } = {}
): Promise<{
  source: "ai" | "local";
  /** 实际使用的大模型 id（如 "agnes-2.0-flash"），调用方用它展示"使用 xxx 解析成功" */
  model: string;
  characters: PreviewCharacter[];
  sceneAssets: PreviewSceneAsset[];
  propAssets: PreviewPropAsset[];
  episodes: PreviewEpisode[];
  title: string;
  warnings: string[];
  /** 后端 AI 接口的完整原始 data 对象（不做字段裁剪） */
  aiRawResponse: Record<string, any>;
}> {
  // 默认 180s：与后端 AI_TIMEOUTS.analyzeScript 一致；环境变量 AGNES_TIMEOUT_ANALYZE_SCRIPT_MS 可覆盖
  const timeoutMs = options.timeoutMs ?? 180_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let resp: Response;
  try {
    resp = await fetch("/api/ai/script-analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // options.model 透传给后端：非空字符串才传；空/undefined 让后端走 DEFAULT_MODEL
      body: JSON.stringify({
        content,
        format,
        timeoutMs,
        ...(typeof options.model === "string" && options.model.trim() ? { model: options.model.trim() } : {}),
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if ((err as any)?.name === "AbortError") {
      throw new Error(`AI 分析超时（>${Math.round(timeoutMs / 1000)}s），请稍后重试或缩短剧本内容`);
    }
    const msg = err instanceof Error ? err.message : "网络错误";
    throw new Error(`网络请求失败：${msg}`);
  }
  clearTimeout(timer);

  if (!resp.ok) {
    // 尝试解析后端错误体
    let errMsg = `HTTP ${resp.status}`;
    try {
      const errJson = await resp.json();
      errMsg = errJson?.message || errJson?.error || errMsg;
    } catch {
      // body 不是 JSON
    }
    throw new Error(`AI 接口返回错误：${errMsg}`);
  }

  let json: any;
  try {
    json = await resp.json();
  } catch (err) {
    throw new Error("AI 接口返回非 JSON 数据");
  }

  // 后端包装：{ code, message, data: { success, data, error? } }
  const payload = json?.data ?? json;
  if (!payload) {
    throw new Error("AI 接口返回数据为空");
  }
  if (payload.success === false) {
    // 把后端的真实 error 透传给用户
    throw new Error(payload.error || "AI 分析失败（未提供具体原因）");
  }
  const aiData = payload.success === true ? payload.data : payload;
  if (!aiData) {
    throw new Error("AI 接口 data 字段为空");
  }

  // 完整保留 AI 原始响应（用于导入时持久化）
  const aiRawResponse: Record<string, any> = { ...aiData };

  // 转换 AI 输出为 PreviewResult 友好结构（仅供预览展示用，不丢任何 aiRawData 字段）
  // 适配新版嵌套 Schema（basic/appearance/costume/environment/time/atmosphere 等）
  const characters: PreviewCharacter[] = (aiData.characters || []).map((c: any) => ({
    name: String(c.name || "").trim(),
    description:
      c.generation_prompt ||
      `${c.basic?.identity || ""} ${c.appearance?.face || ""}`.trim() ||
      c.description ||
      "",
    role: c.basic?.role_type || c.role || "minor",
    gender: c.basic?.gender || c.gender || "other",
    age: c.basic?.age_range || c.age || "",
    appearance: c.appearance?.face || c.appearance || "",
    personality: (c.personality_keywords || []).join(", ") || c.personality || "",
    traits: c.personality_keywords || c.traits || [],
    aiRawData: c,
    dialogueCount: Number(c.dialogue_count) || 0,
    episodes: [],
    matchStatus: "unresolved" as const,
  }));

  const sceneAssets: PreviewSceneAsset[] = (aiData.scenes || []).map((s: any) => ({
    location_name: String(s.scene_name || s.location_name || "").trim(),
    time_of_day: String(s.time?.period || s.time_of_day || "day"),
    atmosphere: s.atmosphere?.tone || s.atmosphere || "",
    description:
      s.generation_prompt ||
      `${s.environment?.location || ""} ${s.atmosphere?.emotion || ""}`.trim() ||
      s.description ||
      "",
    visual_keywords: s.reusable_elements || s.visual_keywords || [],
    first_appearance: s.first_appearance,
    aiRawData: s,
    matchStatus: "unresolved" as const,
  }));

  const propAssets: PreviewPropAsset[] = (aiData.props || []).map((p: any) => ({
    name: String(p.name || "").trim(),
    category: String(p.importance_level || p.category || "other"),
    description: p.generation_prompt || p.story_function || p.description || "",
    color: p.appearance?.color || p.color || "",
    material: p.appearance?.material || p.material || "",
    size: p.appearance?.shape || p.size || "",
    owner: p.owner || "",
    first_appearance: p.first_appearance,
    aiRawData: p,
    matchStatus: "unresolved" as const,
  }));

  const episodes: PreviewEpisode[] = (aiData.episodes || []).map((e: any) => ({
    episode_no: Number(e.episode_no) || 1,
    title: String(e.title || "").trim() || `第${e.episode_no}集`,
    synopsis: String(e.summary || e.synopsis || "").trim(),
    status: "draft",
    scenes: (e.scenes || []).map((s: any) => ({
      scene_no: Number(s.scene_no) || 1,
      scene_name: String(s.scene_name || "").trim() ||
        s.location_name ||
        `第${Number(s.scene_no) || 1}场`,
      location_name: String(s.location_name || s.location || "").trim(),
      time_of_day: String(s.time_of_day || s.time || "day"),
      description: String(s.description || "").trim(),
      dialogues: (s.dialogues || []).map((d: any, idx: number) => ({
        character: String(d.character || "").trim(),
        text: String(d.text || "").trim(),
        emotion: String(d.emotion || "").trim(),
        order: idx,
      })),
    })),
  }));

  return {
    source: "ai",
    // 后端会回填"实际使用的模型 id"；若后端未回填（极旧版本），回落为 options.model，
    // 都没有则空字符串——UI 端必须做好"未识别模型"的兜底展示。
    model: String(aiData.model || options.model || "").trim(),
    characters,
    sceneAssets,
    propAssets,
    episodes,
    title: String(aiData.title || "").trim(),
    warnings: aiData.warnings || [],
    aiRawResponse,
  };
}

/**
 * 把 AI 返回的 episodes 数组转成 Tiptap editor_json。
 * 保留剧集-场景-对白三段式结构，方便剧本编辑器加载后还原。
 */
export function aiEpisodesToEditorJson(episodes: PreviewEpisode[]): any {
  const doc: any = { type: "doc", content: [] };
  for (const ep of episodes) {
    // 剧集节点
    const epContent: any[] = [];
    if (ep.synopsis) {
      epContent.push({
        type: "paragraph",
        content: [{ type: "text", text: `【简介】${ep.synopsis}`, marks: [{ type: "italic" }] }],
      });
    }
    for (const scene of ep.scenes) {
      // 场景标题
      const sceneTitle = formatSceneAnchor(scene);
      const scHeader = `景${scene.scene_no} · ${sceneTitle}${
        scene.time_of_day ? " · " + scene.time_of_day : ""
      }`;
      epContent.push({
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: scHeader }],
      });
      if (scene.description) {
        epContent.push({
          type: "paragraph",
          content: [{ type: "text", text: scene.description }],
        });
      }
      for (const d of scene.dialogues) {
        // 对白节点
        const dContent: any[] = [];
        const label = d.character || "未知角色";
        if (d.emotion) {
          dContent.push({
            type: "text",
            text: `${label}（${d.emotion}）：${d.text}`,
            marks: [{ type: "bold" }],
          });
        } else {
          dContent.push({
            type: "text",
            text: `${label}：${d.text}`,
            marks: [{ type: "bold" }],
          });
        }
        epContent.push({ type: "paragraph", content: dContent });
      }
    }
    doc.content.push({
      type: "heading",
      attrs: { level: 1 },
      content: [{ type: "text", text: `第${ep.episode_no}集 · ${ep.title}` }],
    });
    doc.content.push(...epContent);
  }
  if (doc.content.length === 0) doc.content.push({ type: "paragraph" });
  return doc;
}

export function formatSceneAnchor(scene: Pick<PreviewScene, "scene_name" | "location_name">): string {
  const name = scene.scene_name?.trim();
  const location = scene.location_name?.trim();
  if (name && location && name !== location && !name.includes(location)) {
    return `${name} · ${location}`;
  }
  return name || location || "未命名场景";
}
