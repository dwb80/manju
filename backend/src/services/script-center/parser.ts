/**
 * 剧本中心子模块 - 剧本解析器
 *
 * 将剧本纯文本按章节（heading）拆分为剧集，剧集下进一步拆分为场景和对白。
 *
 * 支持的格式：
 * - # 剧集标题  → 拆分为一集
 *   - ## Scene XX - 地点 - 时间  → 拆分为场景（location/time 解析自标题）
 *     - 段落正文：场景描述
 *     - **角色名** 台词（emotion）  → 拆分为对白
 *     - **角色名**: 台词  → 拆分为对白
 * - 没有标题时：按段落/字数自动分集
 *
 * 返回 ParsedEpisode[]，含嵌套的 scenes 和 dialogues。
 */

import type { ParsedDialogue, ParsedEpisode, ParsedScene } from "./types.js";
import { normalizeTimeOfDay, parseSceneHeader } from "./utils.js";

/**
 * 将剧本纯文本按章节（heading）拆分为剧集，剧集下进一步拆分为场景和对白。
 */
/**
 * splitTextIntoEpisodes - 将剧本纯文本按章节拆分为剧集
 * @param {string} text - 剧本纯文本
 * @returns {ParsedEpisode[]} 返回解析后的剧集列表
 */
export function splitTextIntoEpisodes(text: string): ParsedEpisode[] {
  if (!text || text.trim().length === 0) {
    return [
      {
        episode_no: 1,
        title: "导入剧集",
        synopsis: "",
        status: "draft",
        scenes: [],
      },
    ];
  }

  // 策略 1：按 H1（# xxx）拆分为剧集
  const h1Chunks = text.split(/\n(?=#\s+)/);
  if (h1Chunks.length > 1) {
    return h1Chunks
      .map((chunk, idx) => parseEpisodeFromMarkdown(idx + 1, chunk))
      .filter((ep) => ep.title);
  }

  // 策略 2：按 H2（## xxx）拆分为剧集（兼容直接用 ## 当集标题的剧本）
  const h2Chunks = text.split(/\n(?=##\s+)/);
  if (h2Chunks.length > 1) {
    return h2Chunks
      .map((chunk, idx) => {
        const lines = chunk.split("\n");
        const title = lines[0].replace(/^##\s+/, "").trim();
        return parseEpisodeFromMarkdown(
          idx + 1,
          `# ${title}\n${lines.slice(1).join("\n")}`
        );
      })
      .filter((ep) => ep.title);
  }

  // 策略 3：按段落/字数自动分集（每 30 段或 2000 字一集）
  const paragraphs = text.split(/\n+/).filter((p) => p.trim());
  if (paragraphs.length === 0) {
    return [
      {
        episode_no: 1,
        title: "导入剧集",
        synopsis: "",
        status: "draft",
        scenes: [],
      },
    ];
  }
  const CHARS_PER_EP = 2000;
  const PARAS_PER_EP = 30;
  const episodes: ParsedEpisode[] = [];
  let buffer: string[] = [];
  let charCount = 0;
  let epNo = 1;
  for (const p of paragraphs) {
    buffer.push(p);
    charCount += p.length;
    if (buffer.length >= PARAS_PER_EP || charCount >= CHARS_PER_EP) {
      const synopsis = buffer.join(" ").slice(0, 300);
      episodes.push({
        episode_no: epNo++,
        title: `第${episodes.length + 1}集`,
        synopsis,
        status: "draft",
        scenes: parseScenesFromParagraphs(buffer),
      });
      buffer = [];
      charCount = 0;
    }
  }
  if (buffer.length > 0) {
    const synopsis = buffer.join(" ").slice(0, 300);
    episodes.push({
      episode_no: epNo++,
      title: `第${episodes.length + 1}集`,
      synopsis,
      status: "draft",
      scenes: parseScenesFromParagraphs(buffer),
    });
  }
  return episodes;
}

/** 从 Markdown 块中解析一集（已包含 H1 标题行） */
/**
 * parseEpisodeFromMarkdown - 从Markdown块中解析一集
 * @param {number} episodeNo - 剧集序号
 * @param {string} block - Markdown块（已包含H1标题行）
 * @returns {ParsedEpisode} 返回解析后的剧集
 */
export function parseEpisodeFromMarkdown(episodeNo: number, block: string): ParsedEpisode {
  const lines = block.split("\n");
  const titleLine = lines[0] || "";
  const title = titleLine.replace(/^#\s+/, "").trim();
  const rest = lines.slice(1).join("\n").trim();

  // 抽取本集简介（第一个 scene 之前的纯描述段落）
  const sceneChunks = rest.split(/\n(?=##\s+)/);
  const synopsisBeforeFirstScene = sceneChunks[0] || "";
  const synopsis = synopsisBeforeFirstScene
    .split("\n")
    .filter((l) => !/^##\s+/.test(l))
    .join(" ")
    .trim()
    .slice(0, 300);

  // 解析场景
  const sceneBlocks = sceneChunks.filter((c) => /^##\s+/.test(c));
  const scenes: ParsedScene[] = sceneBlocks.map((sb, idx) =>
    parseSceneFromMarkdown(idx + 1, sb)
  );

  return {
    episode_no: episodeNo,
    title: title || `第${episodeNo}集`,
    synopsis,
    status: "draft",
    scenes,
  };
}

/**
 * 解析单个场景（## Scene XX - 地点 - 时间）
 * 标题格式：
 *   ## Scene 01 - 茶信馆门口 - 白天
 *   ## Scene 2 / 茶信馆门口 / 白天
 *   ## 场景01 茶信馆门口 白天
 */
/**
 * parseSceneFromMarkdown - 解析单个场景
 * @param {number} sceneNo - 场景序号
 * @param {string} block - 场景Markdown块
 * @returns {ParsedScene} 返回解析后的场景
 */
export function parseSceneFromMarkdown(sceneNo: number, block: string): ParsedScene {
  const lines = block.split("\n");
  const headerLine = lines[0] || "";
  const header = headerLine.replace(/^##\s+/, "").trim();

  const { location, time, description: headerDesc } = parseSceneHeader(header);
  const body = lines.slice(1).join("\n").trim();

  // 合并 header 描述与 body
  const fullDescription = [headerDesc, body].filter((s) => s).join("\n").trim();

  // 解析对白
  const dialogues = parseDialoguesFromText(fullDescription);

  return {
    scene_no: sceneNo,
    location_name: location,
    time_of_day: normalizeTimeOfDay(time),
    description: fullDescription,
    notes: "",
    dialogues,
  };
}

/**
 * 从一行行首抽出 `**Name**（emotion）：text` 三段。
 * - emotion 可能含中文/英文字符、标点，但**不应跨越中英文括号层级**
 * - 使用成对括号配对函数 `extractEmotionAndRest`，避免旧正则 `[^）)]+` 在 emotion 含嵌套括号时被截断
 * - 如果行只有 `**Name**（emotion）` 没有冒号，认为是 stage direction，不算对白
 */
/**
 * parseNameEmotionText - 从一行中解析角色名、情绪和对白文本
 * @param {string} line - 文本行
 * @returns {{name: string; emotion: string; text: string} | null} 返回解析结果，格式不匹配则返回null
 */
function parseNameEmotionText(line: string): { name: string; emotion: string; text: string } | null {
  // 期望行首以 **...** 开头
  const m = line.match(/^\*\*([^*]+)\*\*(.*)$/);
  if (!m) return null;
  const name = m[1].trim();
  const tail = m[2];

  // 后续必须是：可选空白 + （或( + 配对emotion + ）或) + 可选空白 + ：或: + 文本
  const start = tail.search(/^[ \t]*[（(]/);
  if (start !== 0) return null;
  const afterParen = tail.match(/^[ \t]*[（(]/);
  if (!afterParen) return null;
  const openIdx = afterParen[0].length - 1; // 位置 of （ or (
  const openCh = tail[openIdx];
  const closeCh = openCh === "（" ? "）" : ")";
  const { inner, endIdx } = matchBalanced(tail, openIdx + 1, closeCh);
  if (endIdx < 0) return null; // 括号未闭合，认为不是该格式
  const rest = tail.slice(endIdx + 1);
  const sep = rest.match(/^[ \t]*[：:][ \t]*(.*)$/s);
  if (!sep) return null;
  return { name, emotion: inner.trim(), text: sep[1].trim() };
}

/**
 * 在 `s` 中从 `start` 位置开始查找与 `close` 配对的右括号。
 * 处理成对嵌套（如 （他笑（自嘲）） ），内部允许出现同种括号。
 * 返回 { inner: 配对区间内的内容, endIdx: 右括号位置, -1 表示未闭合 }
 */
/**
 * matchBalanced - 查找配对的右括号
 * @param {string} s - 源字符串
 * @param {number} start - 开始位置
 * @param {string} close - 右括号字符
 * @returns {{inner: string; endIdx: number}} 返回内部内容和右括号位置
 */
function matchBalanced(s: string, start: number, close: string): { inner: string; endIdx: number } {
  const open = close === "）" ? "（" : "(";
  let depth = 1;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return { inner: s.slice(start, i), endIdx: i };
    }
  }
  return { inner: "", endIdx: -1 };
}

/**
 * 解析对白：
 * - `**林逸**推门走出。` → action
 * - `> **萧晓**（冷笑）：终于舍得出来了？` → dialogue (emotion: 冷笑)
 * - `**林逸**: 与你无关。` → dialogue
 * - `林逸：与你无关。` → dialogue
 */
/**
 * parseDialoguesFromText - 解析对白
 * @param {string} text - 场景描述文本
 * @returns {ParsedDialogue[]} 返回解析后的对白列表
 */
export function parseDialoguesFromText(text: string): ParsedDialogue[] {
  if (!text) return [];
  const dialogues: ParsedDialogue[] = [];
  const lines = text.split(/\n+/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // 跳过 Markdown 标题/列表/引用符号
    const cleanLine = line
      .replace(/^>\s*/, "")
      .replace(/^[-*]\s+/, "");

    // 匹配 **角色名**（情绪）：台词（允许 emotion 含嵌套括号）
    const m1 = parseNameEmotionText(cleanLine);
    if (m1) {
      dialogues.push({
        character: m1.name,
        emotion: m1.emotion,
        text: m1.text,
        order: dialogues.length,
      });
      continue;
    }

    // 匹配 **角色名**：台词  或  **角色名**: 台词
    const m2 = cleanLine.match(/^\*\*([^*]+)\*\*\s*[：:]\s*(.+)$/);
    if (m2) {
      dialogues.push({
        character: m2[1].trim(),
        emotion: "",
        text: m2[2].trim(),
        order: dialogues.length,
      });
      continue;
    }

    // 匹配 角色名：台词  或  角色名: 台词  （中文/英文冒号）
    const m3 = cleanLine.match(/^([^：:\n]{1,20})\s*[：:]\s*(.+)$/);
    if (m3 && !/^[\s*>-]/.test(line)) {
      const name = m3[1].trim();
      // 排除明显是叙述的"X：X"格式（如"地点：xxx"）
      if (
        !["地点", "时间", "场景", "集", "scene", "location", "time"].includes(
          name.toLowerCase()
        )
      ) {
        dialogues.push({
          character: name,
          emotion: "",
          text: m3[2].trim(),
          order: dialogues.length,
        });
        continue;
      }
    }
  }
  return dialogues;
}

/** 当无 scene 标题时，从段落生成单场景（含对白） */
/**
 * parseScenesFromParagraphs - 当无scene标题时，从段落生成单场景
 * @param {string[]} paragraphs - 段落数组
 * @returns {ParsedScene[]} 返回解析后的场景列表
 */
export function parseScenesFromParagraphs(paragraphs: string[]): ParsedScene[] {
  if (paragraphs.length === 0) return [];
  const text = paragraphs.join("\n");
  return [
    {
      scene_no: 1,
      location_name: "",
      time_of_day: "day",
      description: text,
      notes: "",
      dialogues: parseDialoguesFromText(text),
    },
  ];
}
