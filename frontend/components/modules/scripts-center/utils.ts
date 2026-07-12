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
 *
 * 主要支持的中文剧本格式：
 * 1) `角色名（情绪/动作/OS）：对话` —— 剥掉 `（...）` 后取名
 * 2) `角色名：对话`
 * 3) `【角色：xxx】`、`【场景：xxx】`、`【道具：xxx】`
 * 4) 中文常见地点后缀：茶馆 / 茶信馆 / 房间 / 街道 / 院子 / 大堂 等
 */
export function analyzeScriptContent(content: string): ExtractedAsset[] {
  const assets: ExtractedAsset[] = [];
  let idCounter = 0;

  // 0) 预处理：去掉行首项目符号（TipTap bullet）与已知水印
  const cleanContent = content
    .replace(/^[ \t]*[·•・●○]+\s*/gm, "")
    .replace(/华科未来/g, "")
    .trim();

  // 1) 提取角色
  //    优先匹配 `角色名（情绪/动作/OS）：对话` 格式（捕获组 1 = 在 `（` 之前的纯角色名）
  const characterPatterns: { re: RegExp; pick: (m: RegExpExecArray) => string }[] = [
    {
      // 角色名（情绪/动作/OS）：对话
      //   m[1] = 纯角色名（在 `（` 之前）
      re: /(?:^|\n)\s*([^：\n（(]{2,10})[（(][^）)\n]{2,10}[）)]\s*[：:]\s*[^：\n]/g,
      pick: (m) => m[1] || "",
    },
    {
      // 角色名：对话（无情绪修饰）
      re: /(?:^|\n)\s*([^：\n（(]{2,10})\s*[：:]\s*[^：\n]/g,
      pick: (m) => m[1] || "",
    },
    {
      // 【角色：xxx】 / 【角色 xxx】
      re: /【角色[：:]?\s*([^\】\n]{2,10})】/g,
      pick: (m) => m[1] || "",
    },
  ];

  const characterNames = new Set<string>();
  for (const { re, pick } of characterPatterns) {
    const r = new RegExp(re.source, re.flags);
    let m: RegExpExecArray | null;
    while ((m = r.exec(cleanContent)) !== null) {
      let name = pick(m).trim();
      // 去掉 `（xxx）`/`(xxx)` 修饰
      name = name
        .replace(/[（(][^）)]*[）)]\s*$/, "")
        .replace(/[（(].*$/, "")
        .trim();
      if (
        name.length >= 2 &&
        name.length <= 10 &&
        !/^(场景|道具|第|章|幕|OS|VO|旁白|画外音|内心独白|续|接上|闪回|蒙太奇|淡入|淡出|切到|转场)$/.test(name)
      ) {
        characterNames.add(name);
      }
    }
  }

  for (const name of characterNames) {
    idCounter++;
    // 上下文（首次出现后 200 字）作为角色描述
    const ctxRe = new RegExp(escapeRegExp(name) + "[^\\n]{0,200}");
    const ctxMatch = ctxRe.exec(cleanContent);
    let description = (ctxMatch ? ctxMatch[0] : `角色：${name}，在剧本中出现的角色`).trim();
    if (description.length > 200) description = description.slice(0, 200) + "…";

    // 猜测角色类型
    const role = /主角|英雄|男主|女主/.test(name + description) ? "protagonist" :
                 /反派|敌人|boss|魔王|恶人|奸臣|小人/.test(name + description) ? "antagonist" :
                 /配角|朋友|搭档|师徒|师兄|师弟|师妹|姐姐|妹妹|哥哥|弟弟|管家|丫鬟|侍卫|侍女|掌柜|路人|公子|小姐/.test(name + description) ? "supporting" :
                 "minor";
    const gender = /他|男主|先生|公子|爷|男|兄|弟|夫|君|少爷|老爷/.test(name + description) ? "male" :
                   /她|女主|小姐|姑娘|夫人|女|姐|妹|娘|姑|嫂|丫鬟|侍女/.test(name + description) ? "female" : "other";

    const appearanceMatch = description.match(/(外貌|长相|身穿|穿着|发色|瞳色|身材|体型|样貌|容貌|面容)[，：:]*([^。\n]{2,40})/);
    const appearance = appearanceMatch ? appearanceMatch[2].trim() : "";
    const personalityMatch = description.match(/(性格|性情|为人|特点|特质|脾气|神情|神态|态度)[，：:]*([^。\n]{2,40})/);
    const personality = personalityMatch ? personalityMatch[2].trim() : "";

    // 关键词型 traits：扫描角色名附近 30 字范围内出现的高频情绪/动作词
    const traitKeywords = [
      "温柔", "冷淡", "冷酷", "热情", "豪爽", "内向", "外向", "沉默", "活泼",
      "聪慧", "机智", "狡猾", "勇敢", "懦弱", "善良", "邪恶", "正义",
      "冷漠", "热血", "沉稳", "冲动", "果断", "犹豫", "乐观", "悲观",
      "聪明", "糊涂", "谨慎", "鲁莽", "坚强", "脆弱", "愤怒", "倔强", "隐忍",
    ];
    const nameRe = new RegExp(escapeRegExp(name), "g");
    const positions: number[] = [];
    let pm: RegExpExecArray | null;
    while ((pm = nameRe.exec(cleanContent)) !== null) positions.push(pm.index);
    const traits: string[] = [];
    for (const kw of traitKeywords) {
      const inRange = positions.some((pos) => {
        const window = cleanContent.slice(Math.max(0, pos - 30), Math.min(cleanContent.length, pos + 30));
        return window.includes(kw);
      });
      if (inRange && !traits.includes(kw)) traits.push(kw);
      if (traits.length >= 5) break;
    }

    assets.push({
      id: `char-${idCounter}`,
      type: "character",
      name,
      description,
      confirmed: true,
      role: role as any,
      gender: gender as any,
      appearance,
      personality,
      traits,
    });
  }

  // 2) 提取场景
  //    支持【场景：xxx】、INT./EXT.、以及中文常见地点后缀
  const locationSuffixes = [
    "茶馆", "茶信馆", "茶楼", "酒馆", "酒楼", "客栈", "旅店", "酒店", "餐厅", "食堂",
    "房间", "卧房", "卧室", "书房", "客厅", "大厅", "大堂", "正厅", "前厅", "后厅",
    "厨房", "院子", "花园", "庭院", "走廊", "门廊", "阳台", "楼阁", "阁楼",
    "街道", "大街", "小巷", "山路", "官道", "大道", "小路", "桥", "桥头",
    "森林", "树林", "竹林", "山", "山上", "山脚", "山顶", "山腰", "草原", "沙漠", "河边", "湖边", "海边",
    "宫殿", "皇宫", "王府", "府邸", "衙门", "官府", "教堂", "寺庙", "祠堂", "道观",
    "公司", "办公室", "会议室", "教室", "学校", "医院", "诊所",
  ];
  const sceneNameSet = new Set<string>();
  // 显式标记
  const explicitScenePatterns = [
    /(?:^|\n)\s*(INT\.[^\n]+)/gi,
    /(?:^|\n)\s*(EXT\.[^\n]+)/gi,
    /【场景[：:]?\s*([^\】\n]+)】/g,
    /场景[：:]\s*([^\n，。]+)/g,
  ];
  for (const pattern of explicitScenePatterns) {
    const r = new RegExp(pattern.source, pattern.flags);
    let m: RegExpExecArray | null;
    while ((m = r.exec(cleanContent)) !== null) {
      const n = (m[1] || "").trim();
      if (n.length >= 2 && n.length <= 30) sceneNameSet.add(n);
    }
  }
  // 中文地点后缀 —— 0~4 字前缀 + 后缀
  for (const suffix of locationSuffixes) {
    const r = new RegExp(`([^\\n，。、：;;！？\\s]{0,4}${escapeRegExp(suffix)})`, "g");
    let m: RegExpExecArray | null;
    while ((m = r.exec(cleanContent)) !== null) {
      const n = m[1].trim();
      if (n.length >= suffix.length && n.length <= 8 && /[\u4e00-\u9fa5]$/.test(n)) {
        sceneNameSet.add(n);
      }
    }
  }

  for (const rawName of sceneNameSet) {
    const baseName = rawName.replace(/[内外里中上下左右前后方]?$/, "").trim() || rawName;
    idCounter++;
    const sceneType = /^(INT|室内|房间|卧室|客厅|厨房|办公室|教室|医院|宫殿|皇宫|寺庙|教堂|餐厅|食堂|酒楼|茶馆|茶信馆|客栈|书房|大厅|大堂)/i.test(rawName) ? "indoor" :
                      /^(EXT|室外|院子|街道|大街|山路|森林|山|海边|河边|草原|沙漠|竹林)/i.test(rawName) ? "outdoor" : "indoor";
    const timeOfDay = /白天|早晨|上午|下午|正午|日|晨|清晨/.test(rawName) ? "白天" :
                      /夜晚|晚上|深夜|午夜|夜|暗|月|星|灯火/.test(rawName) ? "夜晚" :
                      /黄昏|傍晚|夕阳|暮/.test(rawName) ? "黄昏" :
                      /黎明|清晨|晨曦|破晓/.test(rawName) ? "黎明" : "";
    const weather = /雨|雪|晴|阴|风|雷|雾|霾/.test(rawName) ?
      (rawName.match(/雨|雪|晴|阴|风|雷|雾|霾/)?.[0] || "") : "";

    assets.push({
      id: `scene-${idCounter}`,
      type: "scene",
      name: baseName,
      description: `场景：${baseName}`,
      confirmed: true,
      sceneType: sceneType as any,
      timeOfDay: timeOfDay as any,
      weather,
      lighting: timeOfDay === "夜晚" ? "暗色调" : "自然光",
    });
  }

  // 3) 提取道具
  //    优先【道具：xxx】；再用关键词在原文中匹配"0~1 汉字前缀 + 关键词"（避免误识别长串描述）
  const propKeywords = [
    "剑", "刀", "枪", "弓", "盾", "杖", "锤", "斧", "匕首", "短刃", "长鞭",
    "书", "卷轴", "信", "地图", "钥匙", "灯笼", "镜子", "玉佩", "令牌",
    "衣服", "铠甲", "披风", "帽子", "鞋子", "裙子", "长袍", "华服",
    "马", "车", "船", "马车", "轿子",
    "宝石", "玉佩", "戒指", "项链", "法宝", "仙丹", "丹药",
    "桌子", "椅子", "床", "柜子", "屏风",
    "休书", "信物", "婚书", "契约", "玉玺", "圣旨",
  ];

  const propNameSet = new Set<string>();
  // 【道具：xxx】
  const propPattern1 = /【道具[：:]?\s*([^\】\n]+)】/g;
  let propMatch: RegExpExecArray | null;
  while ((propMatch = propPattern1.exec(cleanContent)) !== null) {
    const n = propMatch[1].trim();
    if (n.length >= 1 && n.length <= 12) propNameSet.add(n);
  }
  // 关键词 —— 0~1 汉字前缀 + 关键词
  for (const keyword of propKeywords) {
    const r = new RegExp(`([\\u4e00-\\u9fa5]{0,1})${escapeRegExp(keyword)}`, "g");
    while ((propMatch = r.exec(cleanContent)) !== null) {
      const full = propMatch[0];
      // 总是保留关键词本身（避免"递出休书" → "休书"）
      propNameSet.add(keyword);
      // 带 1 汉字前缀的也保留（如"这剑"、"此剑"），但过滤明显的动词组合
      if (full.length > keyword.length && /^[\u4e00-\u9fa5]{1}$/.test(propMatch[1])) {
        // 仅保留"这/此/那/把/柄/支/件/对/双 + 关键字"的形式
        if (/^[这此那把柄支件对双一二两三半全]/.test(propMatch[1])) {
          propNameSet.add(full);
        }
      }
    }
  }

  for (const name of propNameSet) {
    idCounter++;
    const category = /剑|刀|枪|弓|盾|杖|锤|斧|匕首|短刃|长鞭/.test(name) ? "weapon" :
                     /书|卷轴|信|地图|钥匙|灯笼|镜子|令牌|契约|休书|信物|婚书|玉玺|圣旨/.test(name) ? "document" :
                     /衣服|铠甲|披风|帽子|鞋子|裙子|长袍|华服/.test(name) ? "clothing" :
                     /马|车|船|马车|轿子/.test(name) ? "vehicle" :
                     /宝石|玉佩|戒指|项链|法宝|仙丹|丹药/.test(name) ? "artifact" :
                     /桌子|椅子|床|柜子|屏风/.test(name) ? "furniture" : "other";
    const material = /金|铜|铁|银/.test(name) ? "金属" :
                     /木/.test(name) ? "木质" :
                     /玉/.test(name) ? "玉石" :
                     /布|绸|锦|丝|纱/.test(name) ? "布艺" : "";
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
      category: category as any,
      material,
      color,
    });
  }

  // 4) 兜底：如果完全没有提取到任何资产，提供一些默认的示例
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

/** 转义正则元字符，避免角色名中含有 `.` `*` 等触发误匹配 */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
