/**
 * 剧本导入模块 - 工具函数
 */

import type {
  PreviewScene,
  PreviewDialogue,
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
 * 从剧集中提取所有出现过的角色名（去重 + 统计次数 + 出现剧集）。
 * 跳过空名 / 包含标点的"伪角色"段落（如"场景"、"时间"等）。
 */
export function extractCharactersFromEpisodes(episodes: PreviewEpisode[]): PreviewCharacter[] {
  const map = new Map<string, PreviewCharacter>();
  for (const ep of episodes) {
    for (const scene of ep.scenes) {
      for (const d of scene.dialogues) {
        const name = (d.character || "").trim();
        if (!name) continue;
        // 排除明显是元信息的伪角色
        const lower = name.toLowerCase();
        if (["地点", "时间", "场景", "集", "scene", "location", "time", "action", "动作", "对白", "dialogue"].includes(lower)) {
          continue;
        }
        // 名字太短（1 个字且不是常见中文名）或太长都可能是误识别
        if (name.length < 1 || name.length > 20) continue;
        const existing = map.get(name);
        if (existing) {
          existing.dialogueCount += 1;
          if (!existing.episodes.includes(ep.episode_no)) {
            existing.episodes.push(ep.episode_no);
          }
        } else {
          map.set(name, {
            name,
            dialogueCount: 1,
            episodes: [ep.episode_no],
            matchStatus: "unresolved",
          });
        }
      }
    }
  }
  // 排序：按出现次数降序
  return Array.from(map.values()).sort((a, b) => b.dialogueCount - a.dialogueCount);
}

/**
 * 调用后端 AI 剧本分析接口（POST /api/ai/script-analyze）
 * 返回 { source, characters, sceneAssets, propAssets, episodes, warnings }
 *
 * 失败或超时（>50s）时返回 null，调用方自动回退本地正则
 */
export async function aiAnalyzeScript(
  content: string,
  format: string
): Promise<{
  source: "ai" | "local";
  characters: PreviewCharacter[];
  sceneAssets: PreviewSceneAsset[];
  propAssets: PreviewPropAsset[];
  episodes: PreviewEpisode[];
  title: string;
  warnings: string[];
} | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 50_000);
    const resp = await fetch("/api/ai/script-analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, format }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!resp.ok) {
      console.warn(`AI 分析失败 HTTP ${resp.status}`);
      return null;
    }
    const json = await resp.json();
    const payload = json?.data ?? json;
    if (!payload) {
      console.warn("AI 分析返回不成功：", json);
      return null;
    }
    if (payload.success === false) {
      console.warn("AI 分析返回不成功：", json);
      return null;
    }
    const aiData = payload.success === true ? payload.data : payload;
    if (!aiData) {
      console.warn("AI 分析返回数据为空：", json);
      return null;
    }

    // 转换 AI 输出为 PreviewResult 友好结构
    // 适配新版嵌套 Schema（basic/appearance/costume/environment/time/atmosphere 等）
    const characters: PreviewCharacter[] = (aiData.characters || []).map((c: any) => ({
      name: String(c.name || "").trim(),
      description: c.generation_prompt || `${c.basic?.identity || ""} ${c.appearance?.face || ""}`.trim() || c.description,
      role: c.basic?.role_type || c.role || "minor",
      gender: c.basic?.gender || c.gender || "other",
      appearance: c.appearance?.face || c.appearance || "",
      personality: (c.personality_keywords || []).join(", ") || c.personality || "",
      traits: c.personality_keywords || c.traits || [],
      dialogueCount: Number(c.dialogue_count) || 0,
      episodes: [],
      matchStatus: "unresolved" as const,
    }));

    const sceneAssets: PreviewSceneAsset[] = (aiData.scenes || []).map((s: any) => ({
      location_name: String(s.scene_name || s.location_name || "").trim(),
      time_of_day: String(s.time?.period || s.time_of_day || "day"),
      atmosphere: s.atmosphere?.tone || s.atmosphere || "",
      description: s.generation_prompt || `${s.environment?.location || ""} ${s.atmosphere?.emotion || ""}`.trim() || s.description,
      visual_keywords: s.reusable_elements || s.visual_keywords || [],
      first_appearance: s.first_appearance,
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
      matchStatus: "unresolved" as const,
    }));

    const episodes: PreviewEpisode[] = (aiData.episodes || []).map((e: any) => ({
      episode_no: Number(e.episode_no) || 1,
      title: String(e.title || "").trim() || `第${e.episode_no}集`,
      synopsis: String(e.summary || e.synopsis || "").trim(),
      status: "draft",
      scenes: (e.scenes || []).map((s: any) => ({
        scene_no: Number(s.scene_no) || 1,
        scene_name: normalizeSceneName(String(s.scene_name || "").trim(), String(s.location_name || s.location || "").trim(), Number(s.scene_no) || 1, String(s.description || "")),
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
      source: aiData.source === "ai" ? "ai" : "local",
      characters,
      sceneAssets,
      propAssets,
      episodes,
      title: String(aiData.title || "").trim(),
      warnings: aiData.warnings || [],
    };
  } catch (err) {
    console.warn("AI 剧本分析异常:", err);
    return null;
  }
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

export function normalizeSceneName(raw: string, location: string, sceneNo: number, description = ""): string {
  const cleaned = raw
    .replace(/^第?[一二三四五六七八九十\d]+[场景幕]\s*[：:、.-]?\s*/u, "")
    .replace(/^场景\s*\d+\s*[：:、.-]?\s*/i, "")
    .trim();
  if (cleaned) return cleaned.slice(0, 24);
  const desc = description
    .replace(/\s+/g, "")
    .replace(/[“”"']/g, "")
    .split(/[。！？!?；;]/)[0]
    ?.slice(0, 18);
  if (desc && desc.length >= 4) return desc;
  if (location) return `${location}场景`;
  return `第${sceneNo}场`;
}

export function formatSceneAnchor(scene: Pick<PreviewScene, "scene_name" | "location_name">): string {
  const name = scene.scene_name?.trim();
  const location = scene.location_name?.trim();
  if (name && location && name !== location && !name.includes(location)) {
    return `${name} · ${location}`;
  }
  return name || location || "未命名场景";
}

/** 解析场景标题，拆出 location / time */
export function parseSceneHeader(header: string): {
  location: string;
  time: string;
  description: string;
} {
  const cleaned = header
    .replace(/^Scene\s*\d+\s*/i, "")
    .replace(/^场景\s*\d+\s*/i, "")
    .trim();
  const parts = cleaned.split(/\s*[-/｜|]\s*/).filter((p) => p);
  if (parts.length >= 2) {
    return {
      location: parts[0] || "",
      time: parts[parts.length - 1] || "day",
      description: parts.length > 2 ? parts.slice(1, -1).join(" ") : "",
    };
  }
  if (parts.length === 1) return { location: parts[0] || "", time: "day", description: "" };
  return { location: "", time: "day", description: "" };
}

/** 解析对白行 */
export function parseDialogueLine(line: string): PreviewDialogue | null {
  const m1 = line.match(/^\*\*([^*]+)\*\*[（(]([^）)]+)[）)]\s*[：:]\s*(.+)$/);
  if (m1) {
    return {
      character: m1[1].trim(),
      emotion: m1[2].trim(),
      text: m1[3].trim(),
      order: 0,
    };
  }
  const m2 = line.match(/^\*\*([^*]+)\*\*\s*[：:]\s*(.+)$/);
  if (m2) {
    return {
      character: m2[1].trim(),
      emotion: "",
      text: m2[2].trim(),
      order: 0,
    };
  }
  const m3 = line.match(/^([^：:\n]{1,20})\s*[：:]\s*(.+)$/);
  if (m3 && !/^[\s*>-]/.test(line)) {
    const name = m3[1].trim();
    if (
      !["地点", "时间", "场景", "集", "scene", "location", "time"].includes(
        name.toLowerCase()
      )
    ) {
      return {
        character: name,
        emotion: "",
        text: m3[2].trim(),
        order: 0,
      };
    }
  }
  return null;
}

/** 从 Markdown 解析为剧集结构（与后端 splitTextIntoEpisodes 保持一致） */
export function parseMarkdownToEpisodes(text: string): PreviewEpisode[] {
  if (!text || text.trim().length === 0) {
    return [
      { episode_no: 1, title: "导入剧集", synopsis: "", status: "draft", scenes: [] },
    ];
  }
  const h1Chunks = text.split(/\n(?=#\s+)/);
  if (h1Chunks.length > 1) {
    return h1Chunks.map((chunk, idx) => parseEpisodeMarkdown(idx + 1, chunk));
  }
  const h2Chunks = text.split(/\n(?=##\s+)/);
  if (h2Chunks.length > 1) {
    return h2Chunks.map((chunk, idx) => {
      const lines = chunk.split("\n");
      const title = lines[0].replace(/^##\s+/, "").trim();
      return parseEpisodeMarkdown(
        idx + 1,
        `# ${title}\n${lines.slice(1).join("\n")}`
      );
    });
  }
  // 兜底：按 2000 字/集 自动分集
  const paragraphs = text.split(/\n+/).filter((p) => p.trim());
  if (paragraphs.length === 0) {
    return [
      { episode_no: 1, title: "导入剧集", synopsis: "", status: "draft", scenes: [] },
    ];
  }
  const CHARS_PER_EP = 2000;
  const PARAS_PER_EP = 30;
  const episodes: PreviewEpisode[] = [];
  let buffer: string[] = [];
  let charCount = 0;
  for (const p of paragraphs) {
    buffer.push(p);
    charCount += p.length;
    if (buffer.length >= PARAS_PER_EP || charCount >= CHARS_PER_EP) {
      episodes.push({
        episode_no: episodes.length + 1,
        title: `第${episodes.length + 1}集`,
        synopsis: buffer.join(" ").slice(0, 300),
        status: "draft",
        scenes: parseScenesFromParagraphs(buffer),
      });
      buffer = [];
      charCount = 0;
    }
  }
  if (buffer.length > 0) {
    episodes.push({
      episode_no: episodes.length + 1,
      title: `第${episodes.length + 1}集`,
      synopsis: buffer.join(" ").slice(0, 300),
      status: "draft",
      scenes: parseScenesFromParagraphs(buffer),
    });
  }
  return episodes;
}

export function parseEpisodeMarkdown(episodeNo: number, block: string): PreviewEpisode {
  const lines = block.split("\n");
  const title = (lines[0] || "").replace(/^#\s+/, "").trim();
  const rest = lines.slice(1).join("\n").trim();
  const sceneChunks = rest.split(/\n(?=##\s+)/);
  const synopsisBefore = sceneChunks[0] || "";
  const synopsis = synopsisBefore
    .split("\n")
    .filter((l) => !/^##\s+/.test(l))
    .join(" ")
    .trim()
    .slice(0, 300);
  const sceneBlocks = sceneChunks.filter((c) => /^##\s+/.test(c));
  const scenes: PreviewScene[] = sceneBlocks.map((sb, idx) =>
    parseSceneMarkdown(idx + 1, sb)
  );
  return {
    episode_no: episodeNo,
    title: title || `第${episodeNo}集`,
    synopsis,
    status: "draft",
    scenes,
  };
}

export function parseSceneMarkdown(sceneNo: number, block: string): PreviewScene {
  const lines = block.split("\n");
  const header = (lines[0] || "").replace(/^##\s+/, "").trim();
  const { location, time, description: headerDesc } = parseSceneHeader(header);
  const body = lines.slice(1).join("\n").trim();
  const fullDescription = [headerDesc, body].filter((s) => s).join("\n").trim();
  const dialogues: PreviewDialogue[] = [];
  for (const line of fullDescription.split(/\n+/)) {
    const trimmed = line
      .trim()
      .replace(/^>\s*/, "")
      .replace(/^[-*]\s+/, "");
    if (!trimmed) continue;
    const d = parseDialogueLine(trimmed);
    if (d) {
      d.order = dialogues.length;
      dialogues.push(d);
    }
  }
  return {
    scene_no: sceneNo,
    scene_name: normalizeSceneName("", location, sceneNo, fullDescription),
    location_name: location,
    time_of_day: normalizeTimeOfDay(time),
    description: fullDescription,
    dialogues,
  };
}

export function parseScenesFromParagraphs(paragraphs: string[]): PreviewScene[] {
  if (paragraphs.length === 0) return [];
  const text = paragraphs.join("\n");
  const dialogues: PreviewDialogue[] = [];
  for (const line of text.split(/\n+/)) {
    const trimmed = line
      .trim()
      .replace(/^>\s*/, "")
      .replace(/^[-*]\s+/, "");
    if (!trimmed) continue;
    const d = parseDialogueLine(trimmed);
    if (d) {
      d.order = dialogues.length;
      dialogues.push(d);
    }
  }
  return [
    {
      scene_no: 1,
      scene_name: normalizeSceneName("", "", 1, text),
      location_name: "",
      time_of_day: "day",
      description: text,
      dialogues,
    },
  ];
}

export function extractSceneAssetsFromEpisodes(episodes: PreviewEpisode[]): PreviewSceneAsset[] {
  const byKey = new Map<string, PreviewSceneAsset>();
  for (const ep of episodes) {
    for (const scene of ep.scenes) {
      const location = scene.location_name || scene.scene_name || "";
      if (!location.trim()) continue;
      const key = `${location.trim().toLowerCase()}-${normalizeTimeOfDay(scene.time_of_day)}`;
      if (byKey.has(key)) continue;
      byKey.set(key, {
        location_name: location,
        time_of_day: normalizeTimeOfDay(scene.time_of_day),
        description: scene.description?.slice(0, 80),
        first_appearance: `EP${String(ep.episode_no).padStart(2, "0")}-Scene${String(scene.scene_no).padStart(2, "0")}`,
        matchStatus: "unresolved",
      });
    }
  }
  return Array.from(byKey.values());
}

export function extractPropsFromText(text: string, episodes: PreviewEpisode[]): PreviewPropAsset[] {
  const propCatalog: Array<{ name: string; category: string; material?: string; color?: string }> = [
    { name: "马车", category: "vehicle", material: "木质" },
    { name: "马匹", category: "vehicle" },
    { name: "长剑", category: "weapon", material: "金属" },
    { name: "短刀", category: "weapon", material: "金属" },
    { name: "匕首", category: "weapon", material: "金属" },
    { name: "玉佩", category: "artifact", material: "玉石" },
    { name: "令牌", category: "artifact", material: "金属" },
    { name: "钥匙", category: "tool", material: "金属" },
    { name: "信件", category: "document", material: "纸质" },
    { name: "书信", category: "document", material: "纸质" },
    { name: "密信", category: "document", material: "纸质" },
    { name: "账册", category: "document", material: "纸质" },
    { name: "灯笼", category: "tool", material: "竹木/纸" },
    { name: "披风", category: "clothing", material: "布料" },
    { name: "斗篷", category: "clothing", material: "布料" },
    { name: "桌子", category: "furniture", material: "木质" },
    { name: "椅子", category: "furniture", material: "木质" },
    { name: "茶杯", category: "food", material: "陶瓷" },
    { name: "酒壶", category: "food", material: "陶瓷" },
  ];
  const fullText = text || episodes.map((ep) => ep.scenes.map((scene) => scene.description).join("\n")).join("\n");
  const out: PreviewPropAsset[] = [];
  for (const item of propCatalog) {
    if (!fullText.includes(item.name)) continue;
    out.push({
      name: item.name,
      category: item.category,
      description: `剧本中出现的${item.name}`,
      material: item.material,
      color: item.color,
      first_appearance: findFirstAppearance(item.name, episodes),
      matchStatus: "unresolved",
    });
  }
  return out;
}

export function findFirstAppearance(keyword: string, episodes: PreviewEpisode[]): string {
  for (const ep of episodes) {
    for (const scene of ep.scenes) {
      const inScene = scene.description.includes(keyword) || scene.dialogues.some((d) => d.text.includes(keyword));
      if (inScene) {
        return `EP${String(ep.episode_no).padStart(2, "0")}-Scene${String(scene.scene_no).padStart(2, "0")}`;
      }
    }
  }
  return "";
}

/** 将纯文本转换为 Tiptap doc JSON（按行拆分为段落） */
export function textToEditorJson(text: string): any {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const content = lines.length > 0
    ? lines.map((line) => ({
        type: "paragraph",
        content: [{ type: "text", text: line }],
      }))
    : [{ type: "paragraph" }];
  return { type: "doc", content };
}

/** 将 Markdown 转换为 Tiptap doc JSON（简单解析标题和段落） */
export function markdownToEditorJson(md: string): any {
  const lines = md.split(/\r?\n/);
  const content: any[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const h1 = line.match(/^#\s+(.+)$/);
    const h2 = line.match(/^##\s+(.+)$/);
    const h3 = line.match(/^###\s+(.+)$/);
    if (h1) {
      content.push({ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: h1[1] }] });
    } else if (h2) {
      content.push({ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: h2[1] }] });
    } else if (h3) {
      content.push({ type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: h3[1] }] });
    } else {
      content.push({ type: "paragraph", content: [{ type: "text", text: line }] });
    }
  }
  return { type: "doc", content: content.length > 0 ? content : [{ type: "paragraph" }] };
}
