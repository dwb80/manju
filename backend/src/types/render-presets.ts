/**
 * @file render-presets.ts
 * @description 横/竖版渲染规格预设 (RENDER-F03/F04)
 *
 * 设计目标:
 *  - 把"横版 16:9 / 竖版 9:16"从 video.ts ratio 字符串升级为**可命名的 preset**,
 *    携带 width/height/fps/duration/format 完整规格,composition/render 节点可一键引用。
 *  - V2 schema freeze 原则:不新增 DB 表,预设是**前端展示 + 后端参数解析**层面的概念,
 *    与 `project_budgets` / `quality_auto_configs` 这种 per-project 持久化配置无关。
 *  - 走"清单 + resolve + 校验"三段式:
 *    1) RENDER_PRESETS  常量(单一事实源)
 *    2) resolveRenderPreset(key)  接受字符串 key / 旧 ratio 字符串 / 部分字段覆盖
 *    3) PRESET_KEYS  类型联合,TS 编译期就能挡住 typo
 *
 * 集成点:
 *  - composition-service.ts:preRenderCheck / createComposition 可选 preset 字段,
 *    preset 缺失时回退到默认横版 16:9。
 *  - pipeline-run-service.ts:executeNode case "composition"/"render" 拿 preset 解析 width/height,
 *    写到 output.composition_meta / output.render_meta 供下游节点读。
 *  - video.ts:VideoParams.ratio 仍保留旧"16:9"/"9:16"字符串作为**底层 AI client 接口**,
 *    preset 解析后用 resolvedParams.ratio 喂给 agnes-client。
 *
 * 测试:
 *  - tests/render-presets.test.mjs(待补):key 解析 / 旧 ratio alias / 字段覆盖 / 不存在 key 抛错。
 */

export type RenderPresetKey =
  | "landscape_1080p" // 横版 1920x1080 16:9  默认
  | "landscape_720p"  // 横版 1280x720  16:9
  | "portrait_1080p"  // 竖版 1080x1920 9:16
  | "portrait_720p"   // 竖版 720x1280  9:16
  | "square_1080p"    // 方版 1080x1080 1:1
  | "cinema_4k"       // 电影 3840x2160 16:9
  | "shorts_1080p";   // 短视频 1080x1920 9:16(抖音/B站/小红书竖屏)

export interface RenderPreset {
  key: RenderPresetKey;
  /** 人类可读名(中文) */
  label: string;
  /** 用途说明(中文) */
  description: string;
  /** AI client 层 ratio 字段(传 agnes-client) */
  ratio: "16:9" | "9:16" | "1:1";
  /** 实际像素宽 */
  width: number;
  /** 实际像素高 */
  height: number;
  /** 帧率 */
  fps: number;
  /** 默认时长(秒),可被调用方覆盖 */
  defaultDuration: 3 | 5 | 10 | 18;
  /** 输出格式 */
  format: "mp4" | "mov";
  /** 适配平台(展示用) */
  platforms: string[];
}

export const RENDER_PRESETS: Record<RenderPresetKey, RenderPreset> = {
  landscape_1080p: {
    key: "landscape_1080p",
    label: "横版 1080p",
    description: "标准横屏,适合 B站/西瓜/YouTube 视频流",
    ratio: "16:9",
    width: 1920,
    height: 1080,
    fps: 30,
    defaultDuration: 5,
    format: "mp4",
    platforms: ["bilibili", "youtube", "xigua", "wechat_channel"],
  },
  landscape_720p: {
    key: "landscape_720p",
    label: "横版 720p",
    description: "轻量横屏,适合预览/草稿导出",
    ratio: "16:9",
    width: 1280,
    height: 720,
    fps: 24,
    defaultDuration: 5,
    format: "mp4",
    platforms: ["preview", "draft"],
  },
  portrait_1080p: {
    key: "portrait_1080p",
    label: "竖版 1080p",
    description: "标准竖屏,适合抖音/快手竖屏流",
    ratio: "9:16",
    width: 1080,
    height: 1920,
    fps: 30,
    defaultDuration: 5,
    format: "mp4",
    platforms: ["douyin", "kuaishou", "tiktok", "reels"],
  },
  portrait_720p: {
    key: "portrait_720p",
    label: "竖版 720p",
    description: "轻量竖屏,适合移动端预览",
    ratio: "9:16",
    width: 720,
    height: 1280,
    fps: 24,
    defaultDuration: 5,
    format: "mp4",
    platforms: ["preview", "draft"],
  },
  square_1080p: {
    key: "square_1080p",
    label: "方版 1080p",
    description: "正方形,适合小红书/Instagram 卡片流",
    ratio: "1:1",
    width: 1080,
    height: 1080,
    fps: 30,
    defaultDuration: 5,
    format: "mp4",
    platforms: ["xiaohongshu", "instagram", "wechat_moments"],
  },
  cinema_4k: {
    key: "cinema_4k",
    label: "电影 4K",
    description: "4K 电影,适合成片母版/线下大屏",
    ratio: "16:9",
    width: 3840,
    height: 2160,
    fps: 30,
    defaultDuration: 10,
    format: "mov",
    platforms: ["final_master", "cinema"],
  },
  shorts_1080p: {
    key: "shorts_1080p",
    label: "短视频 1080p",
    description: "竖版 1080p 短视频规格,平台推荐",
    ratio: "9:16",
    width: 1080,
    height: 1920,
    fps: 30,
    defaultDuration: 5,
    format: "mp4",
    platforms: ["douyin", "kuaishou", "youtube_shorts"],
  },
};

export const DEFAULT_PRESET: RenderPresetKey = "landscape_1080p";

/** 全部 preset 列表(供前端下拉 / HTTP GET /api/render/presets 使用) */
export const RENDER_PRESET_LIST: RenderPreset[] = Object.values(RENDER_PRESETS);

/**
 * 把 ratio 字符串("16:9" / "9:16" / "1:1")映射到**默认 preset key**。
 * 旧 API(只传 ratio 字符串)走这里,保证向后兼容。
 */
export function ratioToPresetKey(ratio: string | undefined | null): RenderPresetKey {
  switch (ratio) {
    case "9:16":
      return "portrait_1080p";
    case "1:1":
      return "square_1080p";
    case "16:9":
    case undefined:
    case null:
    case "":
      return DEFAULT_PRESET;
    default:
      // 未知 ratio:兜底横版,不让上层抛 500
      return DEFAULT_PRESET;
  }
}

export type PresetResolveSource =
  | { kind: "key"; key: RenderPresetKey | string }
  | { kind: "ratio"; ratio: string }
  | { kind: "preset"; preset: RenderPreset };

/** 解析结果,带 normalized 字段 + 原 key/ratio 溯源信息 */
export interface ResolvedRenderPreset {
  /** 命中的 preset key(一定是 RenderPresetKey 之一) */
  key: RenderPresetKey;
  /** preset 完整规格 */
  preset: RenderPreset;
  /** 输入是否合法 */
  valid: boolean;
  /** 不合法时的提示(用于日志/HTTP 400) */
  notice?: string;
}

/**
 * 核心解析函数。接受三种输入形态:
 *  - { kind: "key", key: "landscape_1080p" }            显式 key(推荐)
 *  - { kind: "key", key: "随便写的字符串" }              容错:无效 key 兜底横版 + notice
 *  - { kind: "ratio", ratio: "16:9" }                   旧 ratio 字符串 alias
 *  - { kind: "preset", preset: RENDER_PRESETS.x }       已有的 preset 对象(直接返回)
 *
 * 注意:不抛错,永远返一个有效 ResolvedRenderPreset,invalid 输入时 valid=false + notice。
 * 上层若要"严格模式"(失败抛错)用 assertValidPreset(source) 包装。
 */
export function resolveRenderPreset(source: PresetResolveSource): ResolvedRenderPreset {
  if (source.kind === "preset") {
    return { key: source.preset.key, preset: source.preset, valid: true };
  }
  if (source.kind === "ratio") {
    const key = ratioToPresetKey(source.ratio);
    return { key, preset: RENDER_PRESETS[key], valid: true };
  }
  // kind === "key"
  const k = source.key;
  if (k in RENDER_PRESETS) {
    const preset = RENDER_PRESETS[k as RenderPresetKey];
    return { key: preset.key, preset, valid: true };
  }
  // 无效 key:兜底横版 + notice
  const fallback = RENDER_PRESETS[DEFAULT_PRESET];
  return {
    key: DEFAULT_PRESET,
    preset: fallback,
    valid: false,
    notice: `未知的 render preset key "${k}",已回退到默认 preset "${DEFAULT_PRESET}"`,
  };
}

/**
 * 严格模式:无效 key 直接抛 Error,用于"调用方必须传对"的场景(如 pipeline node config)。
 */
export function assertValidPreset(key: string | undefined | null): RenderPreset {
  if (!key) throw new Error("render_preset_key_required: 必须指定 preset key");
  if (key in RENDER_PRESETS) return RENDER_PRESETS[key as RenderPresetKey];
  const validKeys = Object.keys(RENDER_PRESETS).join(", ");
  throw new Error(
    `render_preset_invalid: preset key "${key}" 不存在,可选值: ${validKeys}`,
  );
}

/**
 * 把 ResolvedRenderPreset 转换为 VideoParams 兼容的字段集合(给 agnes-client 喂)。
 * duration 可被调用方覆盖(否则用 preset.defaultDuration)。
 */
export function presetToVideoParams(
  resolved: ResolvedRenderPreset,
  overrides?: { duration?: 3 | 5 | 10 | 18; num_inference_steps?: number },
): {
  ratio: "16:9" | "9:16" | "1:1";
  width: number;
  height: number;
  duration: 3 | 5 | 10 | 18;
  num_inference_steps: number;
} {
  return {
    ratio: resolved.preset.ratio,
    width: resolved.preset.width,
    height: resolved.preset.height,
    duration: overrides?.duration ?? resolved.preset.defaultDuration,
    num_inference_steps: overrides?.num_inference_steps ?? 30,
  };
}

/**
 * 便捷:从 input key/ratio 一次性解析为 video params。
 * 大部分调用方只需要这个函数,不需要先 resolve 再 presetToVideoParams。
 */
export function resolveVideoParams(input: {
  presetKey?: string | null;
  ratio?: string | null;
  duration?: 3 | 5 | 10 | 18;
  num_inference_steps?: number;
}): ReturnType<typeof presetToVideoParams> & { presetKey: RenderPresetKey; valid: boolean; notice?: string } {
  let resolved: ResolvedRenderPreset;
  if (input.presetKey) {
    resolved = resolveRenderPreset({ kind: "key", key: input.presetKey });
  } else {
    resolved = resolveRenderPreset({ kind: "ratio", ratio: input.ratio ?? "16:9" });
  }
  return {
    ...presetToVideoParams(resolved, { duration: input.duration, num_inference_steps: input.num_inference_steps }),
    presetKey: resolved.key,
    valid: resolved.valid,
    notice: resolved.notice,
  };
}
