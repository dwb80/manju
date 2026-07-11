/**
 * 剧本中心模块 - 工具函数
 */

import type { ImportFormat, ExtractedAsset } from "./types";

/**
 * 将纯文本转换为 Tiptap 文档的 editor_json 段落结构
 * - 按连续换行分段，每段对应一个 paragraph 节点
 * - 空文本返回只含一个空 paragraph 的 doc
 */
export function textToEditorJson(text: string) {
  const paragraphs = text.split(/\n+/).filter((p) => p.trim());
  if (paragraphs.length === 0) {
    return { type: "doc", content: [{ type: "paragraph" }] };
  }
  return {
    type: "doc",
    content: paragraphs.map((p) => ({
      type: "paragraph",
      content: [{ type: "text", text: p.trim() }],
    })),
  };
}

/** 获取导入占位文本 */
export function getImportPlaceholder(format: ImportFormat): string {
  switch (format) {
    case "json":
      return '{"title": "剧本标题", "description": "剧本内容...", "words": 5000, "tags": []}';
    case "fountain":
      return 'Title: 剧本标题\n\nINT. 室内 - 白天\n\n角色A\n你好，世界！';
    case "fdx":
      return '<FinalDraft Document>\n<Content>\n<Paragraph Type="Action">场景描述...</Paragraph>\n</Content>\n</FinalDraft>';
    case "markdown":
      return '# 剧本标题\n\n## 第一章\n\n场景描述...';
    default:
      return '在此粘贴剧本内容...';
  }
}

/** 解析Fountain格式剧本 */
export function parseFountain(text: string): { title: string; content: string; sceneCount: number } {
  const lines = text.split("\n");
  let title = "";
  const contentParts: string[] = [];
  let sceneCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.toLowerCase().startsWith("title:")) {
      title = trimmed.substring(6).trim();
      continue;
    }
    if (/^(INT\.|EXT\.|INT\.\/EXT\.|EST\.)/i.test(trimmed)) {
      sceneCount++;
      contentParts.push(`\n【场景${sceneCount}】${trimmed}`);
      continue;
    }
    if (/^[A-Z\u4e00-\u9fa5]{2,}$/.test(trimmed) && trimmed.length < 20) {
      contentParts.push(`\n${trimmed}:`);
      continue;
    }
    contentParts.push(line);
  }

  return {
    title: title || "Fountain剧本",
    content: contentParts.join("\n"),
    sceneCount: Math.max(sceneCount, 1),
  };
}

/** 解析FDX (Final Draft XML) 格式 */
export function parseFDX(text: string): { title: string; content: string; sceneCount: number } {
  let title = "";
  let content = "";
  let sceneCount = 0;

  try {
    const titleMatch = text.match(/<Title>(.*?)<\/Title>/i);
    if (titleMatch) title = titleMatch[1];

    const paragraphRegex = /<Paragraph[^>]*>([\s\S]*?)<\/Paragraph>/gi;
    const parts: string[] = [];
    let match;
    while ((match = paragraphRegex.exec(text)) !== null) {
      const paraContent = match[1];
      const typeMatch = paraContent.match(/Type="(\w+)"/);
      const type = typeMatch ? typeMatch[1] : "";

      const textMatches = paraContent.match(/<Text[^>]*>([\s\S]*?)<\/Text>/gi);
      const textContent = textMatches
        ? textMatches.map((t) => t.replace(/<[^>]+>/g, "")).join("")
        : "";

      if (!textContent.trim()) continue;

      if (type === "Scene Heading" || /^(INT|EXT)/i.test(textContent)) {
        sceneCount++;
        parts.push(`\n【场景${sceneCount}】${textContent}`);
      } else if (type === "Character") {
        parts.push(`\n${textContent}:`);
      } else {
        parts.push(textContent);
      }
    }
    content = parts.join("\n") || text.replace(/<[^>]+>/g, " ").trim();
  } catch {
    content = text.replace(/<[^>]+>/g, " ").trim();
  }

  return {
    title: title || "FDX剧本",
    content,
    sceneCount: Math.max(sceneCount, 1),
  };
}

/** 本地生成剧本大纲 */
export function generateLocalScriptOutline(
  prompt: string,
  style: string,
  genre: string,
  targetLength: number
): string {
  const genreLabels: Record<string, string> = {
    ancient: "古装剧",
    modern: "现代剧",
    scifi: "科幻剧",
    fantasy: "奇幻剧",
    suspense: "悬疑剧",
    comedy: "喜剧",
    romance: "言情剧",
  };
  const genreLabel = genreLabels[genre] || "原创";

  return `# AI生成剧本大纲

## 创意描述
${prompt}

## 基本信息
- 类型：${genreLabel}
- 风格：${style || "默认"}
- 目标字数：约${targetLength}字

## 故事梗概
基于"${prompt}"的创意，本剧本讲述了一个${genreLabel}风格的故事。故事围绕主角的成长与挑战展开，通过一系列事件推动情节发展，最终达成情感与主题的升华。

## 角色设定
1. 主角：故事的核心人物，承担主要情节推动
2. 配角：辅助主角，提供情感支撑和冲突
3. 反派：制造主要冲突和障碍

## 剧本结构

### 第一幕：开端（约占30%）
- 场景设定：建立故事世界观和背景
- 角色引入：介绍主要角色及其关系
- 触发事件：引发故事发展的核心事件

### 第二幕：发展（约占50%）
- 冲突升级：主角面临越来越大的挑战
- 转折点：故事出现重大转折
- 低谷：主角陷入困境

### 第三幕：高潮与结局（约占20%）
- 高潮：主角与反派的最终对决
- 解决：冲突得到解决
- 结局：故事的收尾和主题升华

## 场景列表
1. 开场场景 - 建立氛围
2. 日常生活 - 展示主角状态
3. 触发事件 - 改变主角命运
4. 冒险开始 - 主角踏上旅程
5. 第一次冲突 - 遇到初步障碍
6. 盟友相遇 - 获得帮助
7. 重大转折 - 故事方向改变
8. 低谷时刻 - 主角陷入困境
9. 觉醒重生 - 主角重新振作
10. 最终对决 - 解决核心冲突
11. 尾声 - 新的开始`;
}

/**
 * 分析剧本内容，提取角色、场景、道具
 * 使用正则匹配和关键词识别
 */
export function analyzeScriptContent(content: string): ExtractedAsset[] {
  const assets: ExtractedAsset[] = [];
  let idCounter = 0;

  // 提取角色：匹配 "角色名：" 或 "角色名说：" 或 【角色】格式
  const characterPatterns = [
    /(?:^|\n)([^\n：]{2,10})[：:]\s*[""""]?/g,
    /【角色[：:]?\s*([^\】]+)】/g,
    /角色[：:]\s*([^\n，。]+)/g,
  ];

  const characterNames = new Set<string>();
  for (const pattern of characterPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const name = match[1].trim();
      // 过滤太长或太短的名称
      if (name.length >= 2 && name.length <= 10 && !/^(场景|道具|第|章|幕)/.test(name)) {
        characterNames.add(name);
      }
    }
  }

  for (const name of characterNames) {
    idCounter++;
    // 尝试从上下文提取角色描述
    const contextRegex = new RegExp(`${name}[：:]\\s*([^\\n]+)`, "g");
    let contextMatch;
    let description = "";
    while ((contextMatch = contextRegex.exec(content)) !== null) {
      description += contextMatch[1] + " ";
      if (description.length > 200) break;
    }
    description = description.trim() || `角色：${name}，在剧本中出现的角色`;

    // 猜测角色类型
    const role = /主角|英雄|男主|女主/.test(name + description) ? "protagonist" :
                 /反派|敌人|boss|魔王/.test(name + description) ? "antagonist" : "minor";
    const gender = /他|男主|先生|公子|爷/.test(description) ? "male" :
                   /她|女主|小姐|姑娘|夫人/.test(description) ? "female" : "other";

    assets.push({
      id: `char-${idCounter}`,
      type: "character",
      name,
      description,
      confirmed: true,
      role,
      gender,
      traits: [],
    });
  }

  // 提取场景：匹配 INT./EXT./室内/室外/场景等
  const scenePatterns = [
    /(?:^|\n)(INT\.[^\n]+)/gi,
    /(?:^|\n)(EXT\.[^\n]+)/gi,
    /【场景[：:]?\s*([^\】]+)】/g,
    /场景[：:]\s*([^\n，。]+)/g,
    /(?:^|\n)([^\n]{2,20}[室内外场景]+)/g,
  ];

  const sceneNames = new Set<string>();
  for (const pattern of scenePatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const name = match[1].trim();
      if (name.length >= 2 && name.length <= 30) {
        sceneNames.add(name);
      }
    }
  }

  for (const name of sceneNames) {
    idCounter++;
    const sceneType = /^(INT|室内)/i.test(name) ? "indoor" :
                      /^(EXT|室外)/i.test(name) ? "outdoor" : "indoor";
    const timeOfDay = /白天|早晨|上午|下午/.test(name) ? "白天" :
                      /夜晚|晚上|深夜|午夜/.test(name) ? "夜晚" :
                      /黄昏|傍晚/.test(name) ? "黄昏" : "";
    const weather = /雨|雪|晴|阴|风|雷/.test(name) ?
      (name.match(/雨|雪|晴|阴|风|雷/)?.[0] || "") : "";

    assets.push({
      id: `scene-${idCounter}`,
      type: "scene",
      name,
      description: `场景：${name}`,
      confirmed: true,
      sceneType,
      timeOfDay,
      weather,
      lighting: timeOfDay === "夜晚" ? "暗色调" : "自然光",
    });
  }

  // 提取道具：匹配 【道具】或常见道具关键词
  const propKeywords = [
    "剑", "刀", "枪", "弓", "盾", "杖", "锤", "斧", // 武器
    "书", "卷轴", "信", "地图", "钥匙", "灯笼", "镜子", // 工具
    "衣服", "铠甲", "披风", "帽子", "鞋子", "裙子", // 服饰
    "马", "车", "船", "马车", // 交通工具
    "宝石", "玉佩", "戒指", "项链", "法宝", "仙丹", // 神器
    "桌子", "椅子", "床", "柜子", // 家具
  ];

  const propNames = new Set<string>();
  // 匹配 【道具：xxx】格式
  const propPattern1 = /【道具[：:]?\s*([^\】]+)】/g;
  let propMatch;
  while ((propMatch = propPattern1.exec(content)) !== null) {
    propNames.add(propMatch[1].trim());
  }
  // 匹配关键词
  for (const keyword of propKeywords) {
    const regex = new RegExp(`[\\u4e00-\\u9fa5]{0,4}${keyword}`, "g");
    while ((propMatch = regex.exec(content)) !== null) {
      const name = propMatch[0].trim();
      if (name.length >= 2 && name.length <= 10) {
        propNames.add(name);
      }
    }
  }

  for (const name of propNames) {
    idCounter++;
    const category = /剑|刀|枪|弓|盾|杖|锤|斧/.test(name) ? "weapon" :
                     /书|卷轴|信|地图|钥匙|灯笼|镜子/.test(name) ? "tool" :
                     /衣服|铠甲|披风|帽子|鞋子|裙子/.test(name) ? "clothing" :
                     /马|车|船/.test(name) ? "vehicle" :
                     /宝石|玉佩|戒指|项链|法宝|仙丹/.test(name) ? "artifact" :
                     /桌子|椅子|床|柜子/.test(name) ? "furniture" : "other";
    const material = /金/.test(name) ? "金属" :
                     /木/.test(name) ? "木质" :
                     /玉/.test(name) ? "玉石" :
                     /铁/.test(name) ? "铁" : "";
    const color = /红/.test(name) ? "红色" :
                  /蓝/.test(name) ? "蓝色" :
                  /绿/.test(name) ? "绿色" :
                  /金/.test(name) ? "金色" :
                  /黑/.test(name) ? "黑色" :
                  /白/.test(name) ? "白色" : "";

    assets.push({
      id: `prop-${idCounter}`,
      type: "prop",
      name,
      description: `道具：${name}，在剧本中出现的道具`,
      confirmed: true,
      category,
      material,
      color,
    });
  }

  // 如果没有提取到任何资产，提供一些默认的示例
  if (assets.length === 0) {
    assets.push(
      {
        id: `char-${++idCounter}`,
        type: "character",
        name: "主角",
        description: "故事的核心角色",
        confirmed: false,
        role: "protagonist",
        gender: "other",
        traits: [],
      },
      {
        id: `scene-${++idCounter}`,
        type: "scene",
        name: "主场景",
        description: "故事发生的主要场景",
        confirmed: false,
        sceneType: "indoor",
        lighting: "自然光",
        timeOfDay: "白天",
        weather: "",
      },
    );
  }

  return assets;
}
