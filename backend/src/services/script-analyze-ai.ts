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
 * 策略：
 *   - 始终走真实大模型（ctx.ai.chat）
 *   - 任何失败（网络/超时/解析错误）直接返回 error，不提供 mock 兜底
 *   - 使用前必须配置 AGNES_API_KEY（无 Key 时 createAgnesClient 抛错）
 */

import { AI_TIMEOUTS, DEFAULT_MODEL, requireString, withTimeout } from "../utils.js";
import type { AppContext } from "./app.js";
import { randomUUID } from "node:crypto";

/** 大模型输出的标准结构 */
export interface AIAnalyzeResult {
  /** 实际调用的大模型 id（如 "agnes-2.0-flash"），前端可用来展示"使用 xxx 解析成功" */
  model: string;
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
  character_id: string;
  name: string;
  basic: {
    gender: "male" | "female" | "other";
    age: string;
    identity: string;
    role_type: "protagonist" | "antagonist" | "supporting" | "minor";
  };
  appearance: {
    face: string;
    hair: string;
    body: string;
    temperament: string;
  };
  costume: {
    name: string;
    description: string;
    color: string;
    material: string;
    style: string;
  };
  accessories: string[];
  personality_keywords: string[];
  emotion_states: {
    emotion: string;
    trigger: string;
    visual_expression: string;
  }[];
  action_assets: {
    action: string;
    description: string;
  }[];
  relationships: {
    target: string;
    relation: string;
  }[];
  generation_prompt: string;
  first_appearance: string;
  dialogue_count: number;
  /** 推断标记：confirmed = 原文明确描述，inferred = 合理推断 */
  confidence?: "confirmed" | "inferred";
}

export interface AIScene {
  scene_id: string;
  scene_name: string;
  category: string;
  indoor_outdoor: "indoor" | "outdoor" | "mixed";
  environment: {
    location: string;
    architecture: string;
    terrain: string;
    plants: string;
    objects: string;
  };
  time: {
    period: string;
    weather: string;
    lighting: string;
  };
  atmosphere: {
    tone: string;
    visual_style: string;
    emotion: string;
  };
  camera_reference: {
    suitable_shots: string[];
  };
  reusable_elements: string[];
  generation_prompt: string;
  first_appearance: string;
}

export interface AIProp {
  prop_id: string;
  name: string;
  importance_level: "核心道具" | "普通道具" | "背景道具";
  owner: string;
  appearance: {
    shape: string;
    material: string;
    color: string;
    texture: string;
  };
  story_function: string;
  visual_features: string[];
  camera_usage: string[];
  generation_prompt: string;
  first_appearance: string;
}

export interface AIEpisode {
  episode_id: string;
  episode_no: number;
  title: string;
  summary: string;
  genre: string;
  time_period: string;
  world_setting: string;
  main_conflict: {
    conflict: string;
    participants: string[];
    stakes: string;
  };
  story_structure: {
    opening: { description: string; purpose: string };
    development: { description: string; purpose: string };
    climax: { description: string; purpose: string };
    ending: { description: string; purpose: string };
  };
  characters: {
    name: string;
    role: string;
    importance: "主角" | "重要角色" | "配角";
    motivation: string;
    relationship: string[];
  }[];
  plot_points: {
    order: number;
    event: string;
    characters: string[];
    importance: "关键转折" | "重要推进" | "一般过渡";
  }[];
  scene_list: {
    scene_id: string;
    scene_name: string;
    location: string;
    time: string;
    characters: string[];
    plot_summary: string;
    dramatic_function: string;
    visual_requirements: string[];
  }[];
  scenes: AIAnalyzeScene[];
}

export interface AIAnalyzeScene {
  scene_no: number;
  scene_name: string;
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
const SYSTEM_PROMPT = `你是一名专业的 AI 漫剧工业化生产平台中的「剧本解析引擎（Script Parser Engine）」。

你的任务不是改写剧本，而是从影视剧本、小说片段、分镜文本中自动提取可用于 AI 图片生成、AI 视频生成、角色一致性控制、场景一致性控制的工业化生产数据。

你需要完成以下解析任务：

1. 剧集资产解析 Episode Analysis
2. 角色资产解析 Character Asset Extraction
3. 场景资产解析 Scene Asset Extraction
4. 道具资产解析 Prop Asset Extraction

---

# 一、剧集解析 Episode Analysis

你的任务是理解整个剧本片段在故事中的作用，为后续角色、场景、分镜生成提供上下文。

重点解析：

## 1. 剧集基本信息

提取：
- 剧集名称（如果存在）
- 集数信息（如果存在）
- 故事类型
- 世界观背景
- 时代背景
- 空间背景
- 整体视觉风格

## 2. 剧情摘要

生成：
- 一句话剧情概括
- 剧情完整摘要
- 核心事件描述

要求：
- 保留剧情事实
- 不扩写不存在剧情
- 不进行文学评价

## 3. 核心冲突分析

识别：
- 主要矛盾
- 冲突双方
- 冲突原因
- 冲突结果
- 剧情推动作用

## 4. 剧情结构分析

将剧情拆分为：
- 开场状态 Opening State
- 矛盾建立 Conflict Setup
- 冲突升级 Escalation
- 高潮节点 Climax
- 结尾状态 Ending State

每个阶段需要描述：
- 发生事件
- 涉及角色
- 剧情作用
- 视觉表现重点

## 5. 主要角色关系分析

建立人物关系：
- 主角
- 配角
- 对立角色
- 家族关系
- 情感关系
- 利益关系
- 敌对关系

## 6. 场次结构分析

将剧本拆分为可生产的 Scene。

注意：场次不是分镜。

场次定义：一个连续空间和时间内发生的一组剧情事件。

每个 Scene 提取：
- scene_id
- 场景名称
- 地点
- 时间
- 出场角色
- 剧情事件
- 戏剧目的
- 视觉重点

---

# 二、角色资产解析 Character Asset

重点关注：
- 身份
- 年龄阶段
- 性别
- 外貌
- 身材
- 发型
- 服装
- 配饰
- 性格
- 情绪状态
- 动作状态
- 能力特征
- 人物关系

解析规则：
1. 同一角色不同服装、状态，需要生成 Character Variant。
2. 不确定信息必须标记 confidence（confirmed/inferred）。
3. 输出信息必须支持：AI角色立绘生成、表情生成、动作生成、视频一致性控制。

---

# 三、场景资产解析 Scene Asset

重点关注：
- 空间名称
- 室内/室外
- 时间
- 天气
- 光照
- 建筑结构
- 环境元素
- 氛围
- 可复用背景元素

解析规则：
1. 一个稳定空间生成一个 Scene Asset。
2. 同一地点不同状态拆分（白天/夜晚/雨天）。
3. 提取背景生成元素、镜头适配信息、可循环利用元素。

---

# 四、道具资产解析 Prop Asset

重点关注：
- 道具名称
- 所属角色
- 外观
- 材质
- 颜色
- 剧情作用
- 是否需要独立生成资产

判断标准：
以下必须生成独立资产：
1. 推动剧情发展的关键物品
2. 多次出现物品
3. 角色身份象征物
4. 镜头特写展示物
5. 需要保持一致性的物品

---

# 五、资产关联关系 Asset Binding

建立角色-场景-道具关系。

---

# 六、解析原则

必须遵守：
- 保留原剧情信息
- 提取视觉生成所需信息
- 建立资产之间关联关系
- 避免虚构不存在的重要信息
- 对缺失信息进行合理推断
- 推断内容必须标记 confidence=inferred

禁止：
- 改写剧情
- 创造新角色
- 添加原文不存在的重要道具
- 修改人物关系
- 生成分镜脚本

---

# 七、输出格式

必须输出 JSON。

**严格输出 JSON，不要任何解释性文字、Markdown 代码块、或额外对话。**
只输出一个 JSON 对象，前后不要有任何字符。`;

/** 用户提示词（输入剧本 + 输出 Schema） */
function buildUserPrompt(content: string, format: string): string {
  return `请从以下剧本中提取所有角色资产，输出严格符合 Schema 的 JSON。

# 角色资产解析要求

1. 每一个具有剧情作用的人物必须独立生成角色资产。
2. 相同人物不同服装状态，需要拆分为不同 Character Variant。
3. 不要只描述人物身份，要输出 AI 生图需要的视觉信息。
4. 对没有明确描述的信息，不要随意创造。

# Schema
\`\`\`json
{
  "title": "剧本标题（从原文中提取，无则空字符串）",
  "characters": [
    {
      "character_id": "角色唯一标识，如 char_001",
      "name": "角色名（去除(OS)(冷笑)等修饰，保留基础名）",
      "basic": {
        "gender": "male|female|other",
        "age": "如 25 / 少年 / 中年 / 老年",
        "identity": "角色身份，如 剑客、公主、侦探",
        "role_type": "protagonist|antagonist|supporting|minor"
      },
      "appearance": {
        "face": "面部特征：脸型、五官、肤色、瞳色、表情习惯",
        "hair": "发型、发色、长度、特殊造型",
        "body": "身材体型：身高、胖瘦、体态特征",
        "temperament": "气质：优雅、粗犷、冷峻、活泼等"
      },
      "costume": {
        "name": "服装名称，如 夜行衣、校服、铠甲",
        "description": "服装详细描述，30字以内",
        "color": "主色调，如 玄黑色、月白色、藏青色",
        "material": "材质，如 丝绸、皮革、金属、棉布",
        "style": "风格，如 古风、现代、 futuristic、民族风"
      },
      "accessories": ["配饰列表，如 玉佩、耳环、腰带、护腕、眼镜"],
      "personality_keywords": ["性格标签，如 冷静、果敢、多疑、温柔"],
      "emotion_states": [
        {
          "emotion": "情绪名称，如 愤怒、喜悦、悲伤、恐惧",
          "trigger": "触发场景，如 被背叛时、获胜时",
          "visual_expression": "视觉表现，如 眉头紧锁、嘴角上扬、眼眶泛红"
        }
      ],
      "action_assets": [
        {
          "action": "动作名称，如 拔剑、奔跑、沉思、施法",
          "description": "动作描述，含姿态和动态特征"
        }
      ],
      "relationships": [
        {
          "target": "关联角色名",
          "relation": "关系，如 父子、恋人、仇敌、师徒"
        }
      ],
      "generation_prompt": "用于 AI 生图的标准化提示词，整合外貌+服装+配饰+气质，英文优先，200字以内"
    }
  ],
  "scenes": [
    {
      "scene_id": "场景唯一标识，如 scene_001",
      "scene_name": "场景名称，如 茶信馆门口/雨夜街道/王府内厅",
      "category": "场景分类，如 古代建筑/现代都市/自然景观/室内空间/室外街道",
      "indoor_outdoor": "indoor|outdoor|mixed",
      "environment": {
        "location": "具体地点描述，如 江南水乡的石板路/繁华都市的商业街",
        "architecture": "建筑结构，如 木质楼阁/钢筋混凝土大厦/窑洞/帐篷",
        "terrain": "地形特征，如 平原/山地/水域/沙漠/雪地",
        "plants": "植物元素，如 竹林/樱花树/仙人掌/草坪",
        "objects": "场景中固定物件，如 石狮子/路灯/招牌/桌椅"
      },
      "time": {
        "period": "时间段，如 清晨/正午/黄昏/深夜/黎明",
        "weather": "天气状况，如 晴朗/多云/小雨/暴雨/大雪/雾霾",
        "lighting": "光照条件，如 自然日光/暖色灯光/冷色霓虹/月光/烛光"
      },
      "atmosphere": {
        "tone": "整体色调，如 暖黄/冷蓝/灰暗/明亮/高对比",
        "visual_style": "视觉风格，如 写实/水墨/赛博朋克/哥特/极简",
        "emotion": "情感氛围，如 紧张/温馨/孤独/欢快/压抑/神秘"
      },
      "camera_reference": {
        "suitable_shots": ["适合镜头，如 全景 establishing shot/中景 medium shot/俯拍 overhead/仰拍 low angle/推轨镜头 dolly in"]
      },
      "reusable_elements": ["可复用元素，如 背景建筑/天空/地面纹理/装饰物"],
      "generation_prompt": "用于 AI 生图的标准化场景提示词，整合环境+时间+氛围+光照，英文优先，200字以内",
      "first_appearance": "如 EP01-Scene01"
    }
  ],
  "props": [
    {
      "prop_id": "道具唯一标识，如 prop_001",
      "name": "道具名，如 马车/长剑/玉佩/机械手表",
      "importance_level": "核心道具|普通道具|背景道具",
      "owner": "归属角色名，无则空字符串",
      "appearance": {
        "shape": "形状/形态，如 圆形/长条形/不规则/仿生",
        "material": "材质，如 金属/木质/布料/皮革/玉石/陶瓷/合成材料",
        "color": "主色及辅色，如 玄黑镶金/银白/暗红渐变",
        "texture": "表面质感，如 光滑/粗糙/磨砂/雕花/做旧/反光"
      },
      "story_function": "剧情作用，如 开启密室的关键/身份象征/武器/传信工具",
      "visual_features": ["视觉特征，如 发光纹路/磨损痕迹/镶嵌宝石/刻字/特殊标志"],
      "camera_usage": ["镜头用法，如 特写 close-up/手持跟拍 handheld/旋转展示 rotating/慢推 slow push-in"],
      "generation_prompt": "用于 AI 生图的标准化道具提示词，整合外观+材质+质感+特征，英文优先，150字以内",
      "first_appearance": "如 EP01-Scene01"
    }
  ],
  "episodes": [
    {
      "episode_id": "剧集唯一标识，如 ep_001",
      "episode_no": 1,
      "title": "剧集标题",
      "summary": "本集详细梗概，100字以内，包含核心冲突和转折",
      "genre": "题材类型，如 悬疑/古装/科幻/都市/武侠",
      "time_period": "时代背景，如 现代/古代/未来/架空",
      "world_setting": "世界观设定，如 修仙世界/赛博朋克都市/民国上海",
      "main_conflict": {
        "conflict": "核心冲突描述，如 主角为报父仇潜入敌营",
        "participants": ["参与冲突的主要角色名"],
        "stakes": "冲突代价/风险，如 暴露则满门抄斩"
      },
      "story_structure": {
        "opening": {
          "description": "开场内容描述，如 雨夜命案，侦探登场",
          "purpose": "叙事功能，如 建立悬念/介绍主角/设定背景"
        },
        "development": {
          "description": "发展段落描述，如 线索追查，嫌疑人逐一排除",
          "purpose": "叙事功能，如 推进调查/揭示关系/制造障碍"
        },
        "climax": {
          "description": "高潮段落描述，如 真凶现身，对峙搏斗",
          "purpose": "叙事功能，如 真相大白/情感爆发/决战时刻"
        },
        "ending": {
          "description": "结局段落描述，如 凶手伏法，主角释然",
          "purpose": "叙事功能，如 闭环收束/留下悬念/情感升华"
        }
      },
      "characters": [
        {
          "name": "角色名",
          "role": "角色在剧集中的定位，如 侦探/嫌疑人/受害者",
          "importance": "主角|重要角色|配角",
          "motivation": "角色动机，如 追查真相/保护家人/复仇",
          "relationship": ["与其他角色的关系，如 与A是父子/与B是仇敌"]
        }
      ],
      "plot_points": [
        {
          "order": 1,
          "event": "情节点描述，如 发现密室/收到匿名信/遭遇伏击",
          "characters": ["参与该事件的角色名"],
          "importance": "关键转折|重要推进|一般过渡"
        }
      ],
      "scene_list": [
        {
          "scene_id": "场景标识，如 ep01_sc01",
          "scene_name": "场景名称，概括核心事件，如 雨夜追踪/密室发现",
          "location": "场景地点",
          "time": "时间，如 深夜/清晨/正午",
          "characters": ["出场的角色名"],
          "plot_summary": "本场景剧情摘要，30字以内",
          "dramatic_function": "冲突|信息揭示|情感推进|动作|过渡",
          "visual_requirements": ["视觉要求，如 雨夜街道/霓虹灯光/古宅内景"]
        }
      ],
      "scenes": [
        {
          "scene_no": 1,
          "scene_name": "场景名，用6-12个字概括本场核心事件",
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
- **服装变体**：同一角色在不同场景中有明显服装差异时，在 costume 中描述主要服装，并在 generation_prompt 中注明"可换装"
- **生图导向**：appearance、costume、accessories 必须包含可用于 AI 图片生成的具体视觉描述
- **场景定义**：一个可重复使用的空间作为一个场景资产。不要把人物动作当成场景，不要把单个镜头当成场景
- **场景变体**：同一地点不同时间状态（白天/夜晚/雨天），需要生成 Scene Variant
- **场景命名**：scenes[].scene_name 必须填写具体空间名称，不能只写事件
- **道具资产标准**：以下情况必须成为资产——推动剧情发展的物品、多次出现的物品、角色身份象征物、镜头特写展示物、AI 视频生成需要保持一致性的物品
- **道具分级**：importance_level 严格按"核心道具/普通道具/背景道具"分级，核心道具必须有 generation_prompt
- **道具归属**：owner 填写持有/使用该道具的主要角色，公共道具留空字符串
- **JSON 严格**：不要 \`\`\`json 包裹，不要任何注释，直接输出 { 开始

# 剧本内容（已截断到 8000 字）
"""
${content.slice(0, 8000)}
"""`;
}

// ============ AI 调用 ============

/**
 * 调用真实大模型分析剧本。
 * 返回 { success, data?, error? }
 *
 * 行为：
 *   1) ctx.ai 必须存在（AppContext 启动时若未配置 AGNES_API_KEY 会被 setup 阶段拒绝）
 *   2) 任何失败（网络/超时/输出无法解析）直接返回 success:false，不提供任何 mock 兜底
 *   3) useLocal=true 一律拒绝（不允许跳过真实 AI）
 *   4) timeoutMs 不传 → 用 AI_TIMEOUTS.analyzeScript（默认 180s，可被 AGNES_TIMEOUT_ANALYZE_SCRIPT_MS 覆盖）
 *      传了 → 走传值（必须是正整数；非法值会回退到默认值并 stderr 提示）
 *   5) model 不传 → 用 DEFAULT_MODEL；传了 → 校验非空字符串后透传给 ctx.ai.chat
 *   6) 返回的 data.model 一定等于实际请求 AI 时使用的 model id（前端用这个展示"使用 xxx 解析成功"）
 */
export async function analyzeScriptWithAI(
  ctx: AppContext,
  body: { content: string; format: string; useLocal?: boolean; timeoutMs?: number; model?: string }
): Promise<{
  success: boolean;
  data?: AIAnalyzeResult;
  error?: string;
  rawModelOutput?: string;
}> {
  // 外层 try-catch 兜底：捕获 pre-try 代码（requireString / format / timeoutMs / model 解析）的同步抛错，
  // 以及 ctx.ai.chat / collectStream / extractJson 内部的 async 抛错（被内层 try 捕获后转 success:false）。
  // 这样可以保证：
  //   1) 任何阶段的异常都不会逃逸到 router.ts 顶层变成 HTTP 500
  //   2) 用户拿到的都是 success:false + 可读 error，前端 toast 可以直接显示
  try {
    return await analyzeScriptWithAIInner(ctx, body);
  } catch (err) {
    const message = err instanceof Error ? err.message : "未知错误";
    return { success: false, error: `AI 调用失败：${message}` };
  }
}

/**
 * analyzeScriptWithAI 的实际实现，单独抽出便于外层 try-catch 统一兜底。
 */
async function analyzeScriptWithAIInner(
  ctx: AppContext,
  body: { content: string; format: string; useLocal?: boolean; timeoutMs?: number; model?: string }
): Promise<{
  success: boolean;
  data?: AIAnalyzeResult;
  error?: string;
  rawModelOutput?: string;
}> {
  const content = requireString(body.content, "content");
  const format = body.format || "txt";

  // 解析 timeoutMs：正整数才接受；非法回退到 AI_TIMEOUTS.analyzeScript
  const fallbackTimeout = AI_TIMEOUTS.analyzeScript;
  let timeoutMs = fallbackTimeout;
  if (body.timeoutMs != null) {
    if (
      typeof body.timeoutMs === "number" &&
      Number.isFinite(body.timeoutMs) &&
      body.timeoutMs > 0 &&
      Number.isInteger(body.timeoutMs)
    ) {
      timeoutMs = body.timeoutMs;
    } else {
      console.warn(
        `[analyzeScriptWithAI] timeoutMs=${JSON.stringify(body.timeoutMs)} 不是正整数，回退到默认值 ${fallbackTimeout}ms`,
      );
    }
  }

  // 解析 model：非空字符串才接受；非法/未传回退到 DEFAULT_MODEL
  let model = DEFAULT_MODEL;
  if (body.model != null && typeof body.model === "string" && body.model.trim().length > 0) {
    model = body.model.trim();
  } else if (body.model != null) {
    console.warn(
      `[analyzeScriptWithAI] model=${JSON.stringify(body.model)} 不是非空字符串，回退到默认值 ${DEFAULT_MODEL}`,
    );
  }

  // useLocal 不再支持：剧本分析必须走真实大模型
  if (body.useLocal) {
    return { success: false, error: "剧本分析必须使用真实大模型，不支持 useLocal 跳过" };
  }

  if (!ctx.ai) {
    return { success: false, error: "AI 客户端未配置：必须在 backend/.env 设置 AGNES_API_KEY 后重启服务" };
  }

  try {
    // agnes-client 当前实现不读 history 字段，把 system + user 拼到同一个 message 里
    const combined = `${SYSTEM_PROMPT}\n\n---\n\n${buildUserPrompt(content, format)}`;

    // 智谱（glm-4.7-flash 等）默认开启思考模式，会让 8000 字剧本分析跑 180s+。
    // 对剧本分析这种"结构化提取"任务关掉思考能：1) 大幅提速 2) 减少 token 消耗 3) 提高限流余量。
    // 智谱通过 body.thinking = { type: "disabled" } 关闭；agnes-client 透传该字段。
    const isZhipuModel = /^glm-/.test(model.trim().toLowerCase());

    // 60s 超时：剧本分析是大流量调用，AbortController 会自动中断 fetch
    const analyzeCtrl = new AbortController();
    const iter = ctx.ai.chat(
      {
        // 合成一个 conversationId（handleChat 才会写库；这里直接调底层 chat API，不会落库）
        // 用 crypto.randomUUID() 避免并发请求串号
        conversationId: `script-analyze-${randomUUID()}`,
        message: combined,
        model,
        temperature: 0.2,
        max_tokens: 4000,
        // 智谱关掉思考（OpenAI 风格 thinking 字段；agnes-client 透传；ZhipuClient 会识别）
        ...(isZhipuModel ? { thinking: { type: "disabled" } as any } : {}),
      } as any,
      analyzeCtrl.signal
    );

    const fullText = await withTimeout(
      collectStream(iter),
      timeoutMs,
      "analyzeScriptWithAI",
      analyzeCtrl
    );

    const parsed = extractJson(fullText);
    if (!parsed) {
      // 真实 AI 输出无法解析为 JSON：直接报错，不提供任何兜底
      return {
        success: false,
        error: "AI 输出无法解析为 JSON",
        rawModelOutput: fullText.slice(0, 1000),
      };
    }

    // 校验 + 归一化
    const warnings: string[] = [];
    const characters = (Array.isArray(parsed.characters) ? parsed.characters : [])
      .map((c: any) => normalizeCharacter(c, warnings))
      .filter((c: AICharacter | null): c is AICharacter => c !== null);
    const scenes = (Array.isArray(parsed.scenes) ? parsed.scenes : []).map((s: any) => normalizeScene(s, warnings));
    const props = (Array.isArray(parsed.props) ? parsed.props : []).map((p: any) => normalizeProp(p, warnings));
    const episodes = (Array.isArray(parsed.episodes) ? parsed.episodes : []).map((e: any) => normalizeEpisode(e, warnings));

    // 空结果保护：AI 成功响应但未提取到任何资产（模型拒答 / 触发内容安全 / 模型本身问题）
    // 这种情况下用户看到的是空预览，体感是"什么都没解析出来"。
    // 直接返回 success:false + 具体原因，让前端给出可操作的错误提示。
    const totalExtracted =
      characters.length + scenes.length + props.length + episodes.length;
    if (totalExtracted === 0) {
      return {
        success: false,
        error:
          "AI 未从剧本中提取到任何角色/场景/道具/剧集。可能原因：剧本内容过短、格式不规范，或大模型本次拒答。请稍后重试或补充剧本内容。",
        rawModelOutput: fullText.slice(0, 1000),
      };
    }

    return {
      success: true,
      data: {
        model,
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
    // 真实 AI 失败：直接报错，不提供任何兜底
    return { success: false, error: `AI 调用失败：${message}` };
  }
}

// ============ 导入流程适配层 ============

/**
 * 旧版 importScriptFromJson 使用的扁平资产结构。
 * 保持向后兼容，让 persistAnalyzedAssets 继续按 type/name 去重入库。
 */
export interface AnalyzedAsset {
  type: "character" | "scene" | "prop";
  name: string;
  description?: string;
  role?: string;
  gender?: string;
  /** 新增：年龄描述（原始字符串，如 "25" / "少年" / "中年"） */
  age?: string;
  traits?: string[];
  sceneType?: string;
  lighting?: string;
  timeOfDay?: string;
  weather?: string;
  category?: string;
  material?: string;
  color?: string;
  /** 新增：AI 生图标准化提示词 */
  generationPrompt?: string;
  /** 新增：推断可信度 */
  confidence?: "confirmed" | "inferred";
  // === AI 剧本分析扩展字段 ===
  identity?: string;
  face?: string;
  hair?: string;
  body?: string;
  temperament?: string;
  costume_name?: string;
  costume_description?: string;
  costume_color?: string;
  costume_material?: string;
  costume_style?: string;
  accessories?: string[];
  emotion_states?: string;
  action_assets?: string;
  relationships?: string;
  first_appearance?: string;
  dialogue_count?: number;
}

/**
 * 把 AIAnalyzeResult 扁平化为 AnalyzedAsset[]。
 * 供 importScriptFromJson 调用，角色/场景/道具按 type 拆为多条记录。
 */
export function aiResultToAssets(result: AIAnalyzeResult | undefined): AnalyzedAsset[] {
  if (!result) return [];
  const out: AnalyzedAsset[] = [];

  for (const c of result.characters || []) {
    if (!c?.name) continue;
    // 兜底：AIAnalyzeResult 已经过 normalizeCharacter 过滤，但旧版缓存数据可能含 Markdown 误识别
    if (!isLikelyCharacterName(c.name)) continue;
    out.push({
      type: "character",
      name: c.name,
      description: c.generation_prompt || `${c.basic?.identity || ""} ${c.appearance?.face || ""}`.trim(),
      role: c.basic?.role_type || "minor",
      gender: c.basic?.gender || "other",
      age: c.basic?.age || undefined,
      traits: c.personality_keywords || [],
      generationPrompt: c.generation_prompt,
      confidence: c.confidence,
      // === AI 剧本分析扩展字段 ===
      identity: c.basic?.identity,
      face: c.appearance?.face,
      hair: c.appearance?.hair,
      body: c.appearance?.body,
      temperament: c.appearance?.temperament,
      costume_name: c.costume?.name,
      costume_description: c.costume?.description,
      costume_color: c.costume?.color,
      costume_material: c.costume?.material,
      costume_style: c.costume?.style,
      accessories: c.accessories,
      emotion_states: JSON.stringify(c.emotion_states || []),
      action_assets: JSON.stringify(c.action_assets || []),
      relationships: JSON.stringify(c.relationships || []),
      first_appearance: c.first_appearance,
      dialogue_count: c.dialogue_count,
    });
  }
  for (const s of result.scenes || []) {
    if (!s?.scene_name) continue;
    out.push({
      type: "scene",
      name: s.scene_name,
      description: s.generation_prompt || `${s.environment?.location || ""} ${s.atmosphere?.emotion || ""}`.trim(),
      sceneType: s.indoor_outdoor || "indoor",
      lighting: s.time?.lighting || "",
      timeOfDay: s.time?.period || "",
      weather: s.time?.weather || "",
      generationPrompt: s.generation_prompt,
    });
  }
  for (const p of result.props || []) {
    if (!p?.name) continue;
    out.push({
      type: "prop",
      name: p.name,
      description: p.generation_prompt || p.story_function || "",
      category: p.importance_level || "other",
      material: p.appearance?.material || "",
      color: p.appearance?.color || "",
      generationPrompt: p.generation_prompt,
    });
  }

  return out;
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
    } catch { }
  }

  // 2) 提取第一个 { 到最后一个 }
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) {
    const candidate = trimmed.slice(first, last + 1);
    try {
      return JSON.parse(candidate);
    } catch { }
  }

  // 3) 容忍 ```json ... ``` 包裹
  const m = trimmed.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  if (m) {
    try {
      return JSON.parse(m[1]);
    } catch { }
  }

  return null;
}

function normalizeCharacter(c: any, warnings: string[]): AICharacter | null {
  const rawName = String(c?.name || "").trim();
  if (!rawName) {
    warnings.push("存在空角色名，已丢弃");
    return null;
  }
  const name = cleanCharacterName(rawName);
  if (!name) {
    warnings.push(`角色名清理后为空（原始:"${rawName}"），已丢弃`);
    return null;
  }
  // 防御：AI 经常把 Markdown 标题 / 字段名误识别为角色（如 "## 场景二" / "**类型**" / "清晨6"）
  // 这些显然不是角色名，必须丢弃以免污染数据库和右侧栏
  if (!isLikelyCharacterName(name)) {
    warnings.push(`"${name}" 不像合法角色名（疑似 Markdown 标题/字段），已丢弃`);
    return null;
  }
  const basic = c?.basic || {};
  const appearance = c?.appearance || {};
  const costume = c?.costume || {};
  return {
    character_id: String(c?.character_id || "").trim() || `char_${name}`,
    name,
    basic: {
      gender: ["male", "female", "other"].includes(basic?.gender) ? basic.gender : "other",
      age: String(basic?.age || "未知"),
      identity: String(basic?.identity || "").trim(),
      role_type: ["protagonist", "antagonist", "supporting", "minor"].includes(basic?.role_type) ? basic.role_type : "minor",
    },
    appearance: {
      face: String(appearance?.face || "").trim(),
      hair: String(appearance?.hair || "").trim(),
      body: String(appearance?.body || "").trim(),
      temperament: String(appearance?.temperament || "").trim(),
    },
    costume: {
      name: String(costume?.name || "").trim(),
      description: String(costume?.description || "").trim(),
      color: String(costume?.color || "").trim(),
      material: String(costume?.material || "").trim(),
      style: String(costume?.style || "").trim(),
    },
    accessories: Array.isArray(c?.accessories) ? c.accessories.map((t: any) => String(t).trim()).filter(Boolean) : [],
    personality_keywords: Array.isArray(c?.personality_keywords) ? c.personality_keywords.map((t: any) => String(t).trim()).filter(Boolean) : [],
    emotion_states: Array.isArray(c?.emotion_states) ? c.emotion_states.map((e: any) => ({
      emotion: String(e?.emotion || "").trim(),
      trigger: String(e?.trigger || "").trim(),
      visual_expression: String(e?.visual_expression || "").trim(),
    })) : [],
    action_assets: Array.isArray(c?.action_assets) ? c.action_assets.map((a: any) => ({
      action: String(a?.action || "").trim(),
      description: String(a?.description || "").trim(),
    })) : [],
    relationships: Array.isArray(c?.relationships) ? c.relationships.map((r: any) => ({
      target: String(r?.target || "").trim(),
      relation: String(r?.relation || "").trim(),
    })) : [],
    generation_prompt: String(c?.generation_prompt || "").trim(),
    first_appearance: String(c?.first_appearance || "").trim(),
    dialogue_count: Number(c?.dialogue_count) || 0,
    confidence: ["confirmed", "inferred"].includes(c?.confidence) ? c.confidence : undefined,
  };
}

function normalizeScene(s: any, warnings: string[]): AIScene {
  const sceneName = String(s?.scene_name || s?.name || "").trim();
  if (!sceneName) warnings.push("存在空场景名，已丢弃");
  const env = s?.environment || {};
  const time = s?.time || {};
  const atmosphere = s?.atmosphere || {};
  const camera = s?.camera_reference || {};
  return {
    scene_id: String(s?.scene_id || "").trim() || `scene_${sceneName}`,
    scene_name: sceneName,
    category: String(s?.category || "").trim(),
    indoor_outdoor: ["indoor", "outdoor", "mixed"].includes(s?.indoor_outdoor) ? s.indoor_outdoor : "indoor",
    environment: {
      location: String(env?.location || "").trim(),
      architecture: String(env?.architecture || "").trim(),
      terrain: String(env?.terrain || "").trim(),
      plants: String(env?.plants || "").trim(),
      objects: String(env?.objects || "").trim(),
    },
    time: {
      period: String(time?.period || "").trim(),
      weather: String(time?.weather || "").trim(),
      lighting: String(time?.lighting || "").trim(),
    },
    atmosphere: {
      tone: String(atmosphere?.tone || "").trim(),
      visual_style: String(atmosphere?.visual_style || "").trim(),
      emotion: String(atmosphere?.emotion || "").trim(),
    },
    camera_reference: {
      suitable_shots: Array.isArray(camera?.suitable_shots) ? camera.suitable_shots.map((k: any) => String(k).trim()).filter(Boolean) : [],
    },
    reusable_elements: Array.isArray(s?.reusable_elements) ? s.reusable_elements.map((k: any) => String(k).trim()).filter(Boolean) : [],
    generation_prompt: String(s?.generation_prompt || "").trim(),
    first_appearance: String(s?.first_appearance || "").trim(),
  };
}

function normalizeProp(p: any, warnings: string[]): AIProp {
  const name = String(p?.name || "").trim();
  if (!name) warnings.push("存在空道具名，已丢弃");
  const appearance = p?.appearance || {};
  return {
    prop_id: String(p?.prop_id || "").trim() || `prop_${name}`,
    name,
    importance_level: ["核心道具", "普通道具", "背景道具"].includes(p?.importance_level) ? p.importance_level : "普通道具",
    owner: String(p?.owner || "").trim(),
    appearance: {
      shape: String(appearance?.shape || "").trim(),
      material: String(appearance?.material || "").trim(),
      color: String(appearance?.color || "").trim(),
      texture: String(appearance?.texture || "").trim(),
    },
    story_function: String(p?.story_function || "").trim(),
    visual_features: Array.isArray(p?.visual_features) ? p.visual_features.map((k: any) => String(k).trim()).filter(Boolean) : [],
    camera_usage: Array.isArray(p?.camera_usage) ? p.camera_usage.map((k: any) => String(k).trim()).filter(Boolean) : [],
    generation_prompt: String(p?.generation_prompt || "").trim(),
    first_appearance: String(p?.first_appearance || "").trim(),
  };
}

function normalizeEpisode(e: any, warnings: string[]): AIEpisode {
  const epNo = Number(e?.episode_no) || 1;
  const conflict = e?.main_conflict || {};
  const structure = e?.story_structure || {};
  return {
    episode_id: String(e?.episode_id || "").trim() || `ep_${epNo}`,
    episode_no: epNo,
    title: String(e?.title || `第${epNo}集`).trim(),
    summary: String(e?.summary || e?.synopsis || "").trim(),
    genre: String(e?.genre || "").trim(),
    time_period: String(e?.time_period || "").trim(),
    world_setting: String(e?.world_setting || "").trim(),
    main_conflict: {
      conflict: String(conflict?.conflict || "").trim(),
      participants: Array.isArray(conflict?.participants) ? conflict.participants.map((k: any) => String(k).trim()).filter(Boolean) : [],
      stakes: String(conflict?.stakes || "").trim(),
    },
    story_structure: {
      opening: {
        description: String(structure?.opening?.description || "").trim(),
        purpose: String(structure?.opening?.purpose || "").trim(),
      },
      development: {
        description: String(structure?.development?.description || "").trim(),
        purpose: String(structure?.development?.purpose || "").trim(),
      },
      climax: {
        description: String(structure?.climax?.description || "").trim(),
        purpose: String(structure?.climax?.purpose || "").trim(),
      },
      ending: {
        description: String(structure?.ending?.description || "").trim(),
        purpose: String(structure?.ending?.purpose || "").trim(),
      },
    },
    characters: Array.isArray(e?.characters) ? e.characters.map((c: any) => ({
      name: String(c?.name || "").trim(),
      role: String(c?.role || "").trim(),
      importance: ["主角", "重要角色", "配角"].includes(c?.importance) ? c.importance : "配角",
      motivation: String(c?.motivation || "").trim(),
      relationship: Array.isArray(c?.relationship) ? c.relationship.map((k: any) => String(k).trim()).filter(Boolean) : [],
    })) : [],
    plot_points: Array.isArray(e?.plot_points) ? e.plot_points.map((pp: any, idx: number) => ({
      order: Number(pp?.order) || idx + 1,
      event: String(pp?.event || "").trim(),
      characters: Array.isArray(pp?.characters) ? pp.characters.map((k: any) => String(k).trim()).filter(Boolean) : [],
      importance: ["关键转折", "重要推进", "一般过渡"].includes(pp?.importance) ? pp.importance : "一般过渡",
    })) : [],
    scene_list: Array.isArray(e?.scene_list) ? e.scene_list.map((sl: any) => ({
      scene_id: String(sl?.scene_id || "").trim(),
      scene_name: String(sl?.scene_name || "").trim(),
      location: String(sl?.location || "").trim(),
      time: String(sl?.time || "").trim(),
      characters: Array.isArray(sl?.characters) ? sl.characters.map((k: any) => String(k).trim()).filter(Boolean) : [],
      plot_summary: String(sl?.plot_summary || "").trim(),
      dramatic_function: String(sl?.dramatic_function || "").trim(),
      visual_requirements: Array.isArray(sl?.visual_requirements) ? sl.visual_requirements.map((k: any) => String(k).trim()).filter(Boolean) : [],
    })) : [],
    scenes: (Array.isArray(e?.scenes) ? e.scenes : []).map((s: any, idx: number) => ({
      scene_no: Number(s?.scene_no) || idx + 1,
      scene_name: String(s?.scene_name || s?.name || "").trim(),
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

/**
 * 判断一段文本是否"像"合法角色名。
 * 大模型有时会把 Markdown 标题（"## 场景二"）或字段名（"**类型**"）误识别为角色，
 * 必须把它们从角色面板里剔除，避免污染 UI 和数据。
 *
 * 规则：
 * - 长度 2-20
 * - 必须包含至少一个中文字符（避免纯英文/纯数字/纯标点）
 * - 不能包含 Markdown 标记：# * ~ ` _ [ ] ( ) 等
 * - 不能以数字结尾（"清晨6" 这类时间被误识别）
 * - 起点不能是标点
 * - 不能是常见剧本结构关键词（"场景"、"角色"、"主要角色介绍"等）
 */
const CHARACTER_NAME_BLOCKLIST: ReadonlySet<string> = new Set([
  "场景", "角色", "道具", "简介", "正文", "旁白", "OS", "VO",
  "剧本大纲", "AI生成剧本大纲", "故事梗概", "主要角色介绍",
  "创意描述", "基本信息", "角色设定", "剧情结构", "故事结构",
  "开场状态", "矛盾建立", "冲突升级", "高潮节点", "结尾状态",
  "类型", "风格", "时代背景", "背景", "核心冲突", "目标字数",
  "故事主题", "视觉主题", "对白风格", "时长预估", "集数信息",
  "剧集名称", "题材类型", "主线事件", "分集大纲", "声音",
  "场景一", "场景二", "场景三", "场景四", "场景五", "场景六", "场景七", "场景八",
  "景一", "景二", "景三", "景四", "景五", "景六", "景七", "景八",
  "第一场", "第二场", "第三场", "第四场", "第五场",
  "第一章", "第二章", "第三章", "第四章", "第五章",
  "第一幕", "第二幕", "第三幕", "第四幕", "第五幕",
]);

function isLikelyCharacterName(name: string): boolean {
  if (typeof name !== "string") return false;
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 20) return false;
  // 含 Markdown 标记 → 不合法
  if (/[#*~`_\[\]【】()（）]/.test(trimmed)) return false;
  // 必须含中文字符
  if (!/[\u4e00-\u9fff]/.test(trimmed)) return false;
  // 黑名单关键词
  if (CHARACTER_NAME_BLOCKLIST.has(trimmed)) return false;
  // 以数字结尾（如"清晨6"）→ 不合法
  if (/\d$/.test(trimmed)) return false;
  // 起点是标点 → 不合法
  if (/^[·\-、，,。:：!?]/.test(trimmed)) return false;
  return true;
}
