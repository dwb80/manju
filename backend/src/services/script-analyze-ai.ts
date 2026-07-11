/**
 * 剧本 AI 分析服务
 *
 * 业务：调用大模型对导入的剧本内容进行结构化分析，输出
 *   - 角色资产 (characters)
 *   - 场景资产 (scenes)
 *   - 道具资产 (props)
 *   - 剧集结构 (episodes + scenes + dialogues)
 *
 * 提示词设计原则：
 *   1) 强制要求 JSON 输出（不要任何解释性文字）
 *   2) 角色去重（同角色的不同情绪/旁白合并为一个，emotion 作为属性）
 *   3) 群演不计入角色（路人/服务员/警察A 等）
 *   4) 场景合并（同一地点不同时间算不同场景）
 *   5) 道具要"可视觉化"（颜色/材质/形态），方便后续生图
 *
 * 失败兜底：AI 不可用时回退到 utils.ts 的本地正则分析
 */

import { DEFAULT_MODEL, requireString } from "../utils.js";
import type { AppContext } from "./app.js";

/** 大模型输出的标准结构 */
export interface AIAnalyzeResult {
  title: string;
  format: string;
  characters: AICharacter[];
  scenes: AIScene[];
  props: AIProp[];
  episodes: AIEpisode[];
  /** 元信息：方便前端展示"基于 AI 分析" */
  source: "ai" | "local_fallback";
  /** 大模型原始返回（用于调试） */
  rawModelOutput?: string;
  /** 警告信息（如果 AI 输出有不合规的地方） */
  warnings?: string[];
}

export interface AICharacter {
  name: string;
  description: string;
  role: "protagonist" | "antagonist" | "supporting" | "minor";
  gender: "male" | "female" | "other";
  age: string;
  appearance: string; // 外貌：发色/瞳色/体型
  personality: string; // 性格关键词
  first_appearance: string; // 首次出场位置，如 "EP01-Scene01"
  dialogue_count: number;
  traits: string[];
}

export interface AIScene {
  location_name: string;
  time_of_day: "day" | "night" | "dawn" | "dusk" | "unknown";
  atmosphere: string; // 氛围：紧张/温馨/恐怖
  description: string; // 场景描述：室内/室外/陈设
  visual_keywords: string[]; // 生图关键词
  first_appearance: string;
}

export interface AIProp {
  name: string;
  category: "weapon" | "tool" | "clothing" | "vehicle" | "artifact" | "furniture" | "food" | "document" | "other";
  description: string;
  color: string;
  material: string;
  size: string; // 尺寸/形态
  owner: string; // 归属角色，空字符串=公共
  first_appearance: string;
}

export interface AIEpisode {
  episode_no: number;
  title: string;
  synopsis: string;
  scenes: AIAnalyzeScene[];
}

export interface AIAnalyzeScene {
  scene_no: number;
  location_name: string;
  time_of_day: string;
  description: string;
  dialogues: AIAnalyzeDialogue[];
}

export interface AIAnalyzeDialogue {
  character: string;
  text: string;
  emotion: string;
}

// ============ 提示词模板 ============

/** 系统提示词（角色设定 + 任务说明） */
const SYSTEM_PROMPT = `你是一名资深的影视/漫剧剧本分析专家。你的任务是从剧本原文中精确提取以下 4 类资产：

1. **角色 (characters)**
   - 主要角色（主角、配角、反派）必须提取，附带：外貌、性格、性别、年龄、首次出场
   - **群演不计入**（路人、服务员、警察A/B、顾客甲等）。只提取有名字或可被识别的具体角色
   - 同角色的不同情绪/旁白/声音状态合并为一个，emotion 作为对话的属性

2. **场景 (scenes)**
   - 室内/室外/陈设/光线/氛围，附带"生图关键词"（英文+中文，用于 AI 生图）
   - 同一地点不同时间（如"咖啡馆 - 白天"和"咖啡馆 - 夜晚"）算不同场景

3. **道具 (props)**
   - 武器（剑、刀、枪）、工具（书、钥匙、灯笼）、服装（衣服、铠甲、披风）、交通工具（马、马车、船）、神器（宝石、玉佩、法宝）、家具（桌子、椅子）、食物等所有可视觉化的物品
   - **必须提取所有出现的道具，哪怕只出现一次**。特别注意：交通工具（如马车、马匹、船只）、武器装备、随身物品、场景中的重要物件
   - 必填：颜色、材质、尺寸/形态、归属角色

4. **剧集结构 (episodes)**
   - 按时间或主题划分剧集，每集含场景和完整对白
   - 场景编号从 1 开始，对白按出现顺序

**严格输出 JSON，不要任何解释性文字、Markdown 代码块、或额外对话。**
只输出一个 JSON 对象，前后不要有任何字符。`;

/** 用户提示词（输入剧本 + 输出 Schema） */
function buildUserPrompt(content: string, format: string): string {
  return `请分析以下 ${format.toUpperCase()} 格式的剧本，输出严格符合 Schema 的 JSON。

# Schema
\`\`\`json
{
  "title": "剧本标题（从原文中提取，无则空字符串）",
  "characters": [
    {
      "name": "角色名（去除(OS)(冷笑)等修饰，保留基础名）",
      "description": "中文角色描述，30字以内",
      "role": "protagonist|antagonist|supporting|minor",
      "gender": "male|female|other",
      "age": "如 25 / 少年 / 中年",
      "appearance": "外貌特征：发色/瞳色/体型/标志性装饰",
      "personality": "性格关键词，3-5个，用逗号分隔",
      "first_appearance": "首次出场位置，格式 EP01-Scene01",
      "dialogue_count": 数字，该角色总对白数（估算即可）",
      "traits": ["标签1", "标签2"]
    }
  ],
  "scenes": [
    {
      "location_name": "场景地点，如 茶信馆门口",
      "time_of_day": "day|night|dawn|dusk|unknown",
      "atmosphere": "氛围，如 紧张/温馨/阴森",
      "description": "场景描述：室内外/陈设/光线，30字以内",
      "visual_keywords": ["生图关键词中英文混合，5-8个"],
      "first_appearance": "如 EP01-Scene01"
    }
  ],
  "props": [
    {
      "name": "道具名，如 马车/长剑/玉佩",
      "category": "weapon|tool|clothing|vehicle|artifact|furniture|food|document|other",
      "description": "中文描述，20字以内，如 一辆装饰华丽的古代马车",
      "color": "主色，如 古铜色/银白/棕色",
      "material": "材质，如 金属/木质/布料/皮革",
      "size": "尺寸/形态，如 30cm长/手掌大/可乘坐两人",
      "owner": "归属角色名，无则空字符串",
      "first_appearance": "如 EP01-Scene01"
    }
  ],
  "episodes": [
    {
      "episode_no": 1,
      "title": "剧集标题",
      "synopsis": "本集一句话梗概，30字以内",
      "scenes": [
        {
          "scene_no": 1,
          "location_name": "场景地点",
          "time_of_day": "day|night|dawn|dusk",
          "description": "本场景动作/环境描述",
          "dialogues": [
            {
              "character": "角色名（去修饰）",
              "text": "对白原文",
              "emotion": "情绪/动作提示，如 冷笑/推门/旁白"
            }
          ]
        }
      ]
    }
  ]
}
\`\`\`

# 重要约束
- **角色去重**：同一基础名只能出现一次。"苏婉儿(OS)" 和 "苏婉儿(声音发抖)" 合并为 "苏婉儿"
- **群演过滤**：路人/服务员/警察A/顾客甲 等不计入 characters
- **场景合并**：相同 location_name + time_of_day 视为同一场景
- **JSON 严格**：不要 \`\`\`json 包裹，不要任何注释，直接输出 { 开始

# 剧本内容（已截断到 8000 字）
"""
${content.slice(0, 8000)}
"""`;
}

// ============ AI 调用 ============

/**
 * 调用大模型分析剧本。
 * 返回 { success, data?, error? }
 */
export async function analyzeScriptWithAI(
  ctx: AppContext,
  body: { content: string; format: string; useLocal?: boolean }
): Promise<{
  success: boolean;
  data?: AIAnalyzeResult;
  error?: string;
}> {
  const content = requireString(body.content, "content");
  const format = body.format || "txt";

  // 显式要求本地（不调 AI）
  if (body.useLocal) {
    return { success: true, data: localFallback(content, format, "用户要求本地") };
  }

  if (!ctx.ai) {
    return { success: true, data: localFallback(content, format, "AI 客户端未配置") };
  }

  try {
    // agnes-client 当前实现不读 history 字段，把 system + user 拼到同一个 message 里
    const combined = `${SYSTEM_PROMPT}\n\n---\n\n${buildUserPrompt(content, format)}`;

    // ctx.ai.chat 返回 AsyncIterable<ChatChunk>，需要把 content 拼起来
    const iter = ctx.ai.chat(
      {
        // 合成一个 conversationId（handleChat 才会写库；这里直接调底层 chat API，不会落库）
        conversationId: `script-analyze-${Date.now()}`,
        message: combined,
        model: DEFAULT_MODEL,
        temperature: 0.2,
        max_tokens: 4000,
      } as any,
      new AbortController().signal
    );

    const fullText = await collectStream(iter);
    const parsed = extractJson(fullText);
    if (!parsed) {
      return {
        success: true,
        data: { ...localFallback(content, format, "AI 输出无法解析为 JSON"), rawModelOutput: fullText.slice(0, 1000) },
      };
    }

    // 校验 + 归一化
    const warnings: string[] = [];
    const characters = (Array.isArray(parsed.characters) ? parsed.characters : []).map((c: any) => normalizeCharacter(c, warnings));
    const scenes = (Array.isArray(parsed.scenes) ? parsed.scenes : []).map((s: any) => normalizeScene(s, warnings));
    const props = (Array.isArray(parsed.props) ? parsed.props : []).map((p: any) => normalizeProp(p, warnings));
    const episodes = (Array.isArray(parsed.episodes) ? parsed.episodes : []).map((e: any) => normalizeEpisode(e, warnings));

    return {
      success: true,
      data: {
        title: typeof parsed.title === "string" ? parsed.title : "",
        format,
        characters,
        scenes,
        props,
        episodes,
        source: "ai",
        rawModelOutput: fullText.slice(0, 1000),
        warnings: warnings.length ? warnings : undefined,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "未知错误";
    return { success: true, data: localFallback(content, format, `AI 调用失败：${message}`) };
  }
}

/** 把 AsyncIterable<ChatChunk> 拼成完整字符串 */
async function collectStream(iter: AsyncIterable<any>): Promise<string> {
  let out = "";
  for await (const chunk of iter) {
    if (chunk && typeof chunk.content === "string") {
      out += chunk.content;
    }
    if (chunk?.done) break;
  }
  return out;
}

// ============ 工具函数 ============

/** 从大模型输出中提取 JSON（容忍 ```json 包裹、尾部多余文字） */
function extractJson(text: string): any | null {
  if (!text) return null;

  // 1) 尝试整段直接 parse
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      return JSON.parse(trimmed);
    } catch {}
  }

  // 2) 提取第一个 { 到最后一个 }
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) {
    const candidate = trimmed.slice(first, last + 1);
    try {
      return JSON.parse(candidate);
    } catch {}
  }

  // 3) 容忍 ```json ... ``` 包裹
  const m = trimmed.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  if (m) {
    try {
      return JSON.parse(m[1]);
    } catch {}
  }

  return null;
}

function normalizeCharacter(c: any, warnings: string[]): AICharacter {
  const name = String(c?.name || "").trim();
  if (!name) warnings.push("存在空角色名，已丢弃");
  return {
    name: cleanCharacterName(name),
    description: String(c?.description || "").trim(),
    role: ["protagonist", "antagonist", "supporting", "minor"].includes(c?.role) ? c.role : "minor",
    gender: ["male", "female", "other"].includes(c?.gender) ? c.gender : "other",
    age: String(c?.age || "未知"),
    appearance: String(c?.appearance || "").trim(),
    personality: String(c?.personality || "").trim(),
    first_appearance: String(c?.first_appearance || "").trim(),
    dialogue_count: Number(c?.dialogue_count) || 0,
    traits: Array.isArray(c?.traits) ? c.traits.map((t: any) => String(t).trim()).filter(Boolean) : [],
  };
}

function normalizeScene(s: any, warnings: string[]): AIScene {
  const location = String(s?.location_name || s?.name || "").trim();
  if (!location) warnings.push("存在空场景名，已丢弃");
  return {
    location_name: location,
    time_of_day: ["day", "night", "dawn", "dusk", "unknown"].includes(s?.time_of_day) ? s.time_of_day : "unknown",
    atmosphere: String(s?.atmosphere || "").trim(),
    description: String(s?.description || "").trim(),
    visual_keywords: Array.isArray(s?.visual_keywords) ? s.visual_keywords.map((k: any) => String(k).trim()).filter(Boolean) : [],
    first_appearance: String(s?.first_appearance || "").trim(),
  };
}

function normalizeProp(p: any, warnings: string[]): AIProp {
  const name = String(p?.name || "").trim();
  if (!name) warnings.push("存在空道具名，已丢弃");
  return {
    name,
    description: String(p?.description || "").trim(),
    category: ["weapon", "tool", "clothing", "vehicle", "artifact", "furniture", "food", "document", "other"].includes(p?.category) ? p.category : "other",
    color: String(p?.color || "").trim(),
    material: String(p?.material || "").trim(),
    size: String(p?.size || "").trim(),
    owner: String(p?.owner || "").trim(),
    first_appearance: String(p?.first_appearance || "").trim(),
  };
}

function normalizeEpisode(e: any, warnings: string[]): AIEpisode {
  const epNo = Number(e?.episode_no) || 1;
  return {
    episode_no: epNo,
    title: String(e?.title || `第${epNo}集`).trim(),
    synopsis: String(e?.synopsis || "").trim(),
    scenes: (Array.isArray(e?.scenes) ? e.scenes : []).map((s: any, idx: number) => ({
      scene_no: Number(s?.scene_no) || idx + 1,
      location_name: String(s?.location_name || "").trim(),
      time_of_day: String(s?.time_of_day || "day").trim(),
      description: String(s?.description || "").trim(),
      dialogues: (Array.isArray(s?.dialogues) ? s.dialogues : []).map((d: any) => ({
        character: cleanCharacterName(String(d?.character || "").trim()),
        text: String(d?.text || "").trim(),
        emotion: String(d?.emotion || "").trim(),
      })),
    })),
  };
}

/**
 * 清理角色名：去除 (OS)(冷笑)(声音发抖) 等修饰
 * "苏婉儿(OS)" → "苏婉儿"
 * "林逸(冷笑一声)" → "林逸"
 */
function cleanCharacterName(raw: string): string {
  return raw
    .replace(/[（(][^）)]*[）)]/g, "") // 去除所有中英文括号内容
    .replace(/[（(].*$/, "")
    .trim();
}

// ============ 本地兜底（保持与 utils.ts 一致的能力） ============

function localFallback(content: string, format: string, reason: string): AIAnalyzeResult {
  // 简单提取：行数、首行作为标题
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  const title = lines[0]?.replace(/^#+\s*/, "").slice(0, 30) || "";
  return {
    title,
    format,
    characters: [],
    scenes: [],
    props: [],
    episodes: [],
    source: "local_fallback",
    warnings: [reason],
  };
}
