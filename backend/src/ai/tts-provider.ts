/**
 * @file tts-provider.ts
 * @description 文本转语音（TTS）Provider 抽象与 Edge-TTS 默认实现。
 *
 * ## 设计要点
 *  - V1 默认走 msedge-tts（微软 Edge 公共服务），无需 API Key。
 *  - V2 预留 "agnes" 路由：由 Agnes 后端代理 TTS（待 Agnes 支持）。
 *  - 音色解析：支持别名（xiaoxiao / yunxi 等）+ 直通原始音色 ID。
 *  - 语速解析：speed (1.0=正常) → msedge-tts percent (-100 ~ +100)。
 *  - 估算时长：按 3.5 字/秒 + 语速调整，避免播放卡顿。
 *  - 输出：data:audio/mpeg;base64,...，前端可直接 <audio src=>。
 */
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { rootLogger } from "../logger.js";

/** TTS 路由类型。 */
export type TTSProviderType = "edge" | "agnes";

/** TTS 调用结果。 */
export interface TTSResult {
  file_url: string;
  duration: number;
  status: string;
  voice?: string;
  emotion?: string;
}

/** TTS 调用参数。 */
export interface TTSParams {
  text: string;
  voice?: string;
  emotion?: string;
  /** 1.0 = 正常语速，0.5 = 一半，2.0 = 两倍。 */
  speed?: number;
  /** "mp3" | "wav" | "webm"。 */
  format?: string;
}

/** 9 个中文常用音色映射。 */
const CHINESE_VOICES: Record<string, string> = {
  default: "zh-CN-XiaoxiaoNeural",
  xiaoxiao: "zh-CN-XiaoxiaoNeural",
  yunxi: "zh-CN-YunxiNeural",
  yunyang: "zh-CN-YunyangNeural",
  xiaoyi: "zh-CN-XiaoyiNeural",
  yunjian: "zh-CN-YunjianNeural",
  xiaohan: "zh-CN-XiaohanNeural",
  xiaomeng: "zh-CN-XiaomengNeural",
  xiaorui: "zh-CN-XiaoruiNeural",
  yunqi: "zh-CN-YunqiNeural",
};

export class EdgeTTSProvider {
  private readonly voiceMap: Record<string, string> = CHINESE_VOICES;

  async generateTTS(params: TTSParams, _signal?: AbortSignal): Promise<TTSResult> {
    const debugEnabled = rootLogger.isLevelEnabled("debug");
    const startTime = Date.now();
    const text = params.text?.trim();
    if (!text) {
      throw new Error("TTS 文本不能为空");
    }
    const voice = this.resolveVoice(params.voice);
    const speed = this.resolveSpeed(params.speed);
    const format = params.format?.toLowerCase() ?? "mp3";
    if (debugEnabled) {
      rootLogger.debug(
        {
          event: "ai.tts.start",
          provider: "edge-tts",
          voice,
          speed,
          textLength: text.length,
        },
        `Edge-TTS 开始：音色=${voice}，语速=${speed}，文本=${text.length}字符`,
      );
    }
    const audioBuffer = await this.fetchEdgeTTS(text, voice, speed);
    const duration = this.estimateDuration(text, speed);
    const fileUrl = this.bufferToDataUrl(audioBuffer, format);
    if (debugEnabled) {
      rootLogger.debug(
        {
          event: "ai.tts.finish",
          provider: "edge-tts",
          durationMs: Date.now() - startTime,
          audioSize: audioBuffer.byteLength,
          estimatedDuration: duration,
        },
        `Edge-TTS 完成：耗时 ${Date.now() - startTime}ms，音频大小 ${audioBuffer.byteLength} 字节`,
      );
    }
    return {
      file_url: fileUrl,
      duration,
      status: "success",
      voice,
    };
  }

  async listVoices(): Promise<Array<{ id: string; name: string; gender: string; locale: string }>> {
    return [
      { id: "zh-CN-XiaoxiaoNeural", name: "晓晓", gender: "female", locale: "zh-CN" },
      { id: "zh-CN-YunxiNeural", name: "云希", gender: "female", locale: "zh-CN" },
      { id: "zh-CN-YunyangNeural", name: "云扬", gender: "male", locale: "zh-CN" },
      { id: "zh-CN-XiaoyiNeural", name: "晓艺", gender: "female", locale: "zh-CN" },
      { id: "zh-CN-YunjianNeural", name: "云健", gender: "male", locale: "zh-CN" },
      { id: "zh-CN-XiaohanNeural", name: "小涵", gender: "female", locale: "zh-CN" },
      { id: "zh-CN-XiaomengNeural", name: "小梦", gender: "female", locale: "zh-CN" },
      { id: "zh-CN-XiaoruiNeural", name: "小蕊", gender: "female", locale: "zh-CN" },
      { id: "zh-CN-YunqiNeural", name: "云奇", gender: "male", locale: "zh-CN" },
    ];
  }

  private resolveVoice(voice?: string): string {
    if (!voice) return this.voiceMap.default;
    const normalized = voice.toLowerCase().trim();
    if (this.voiceMap[normalized]) {
      return this.voiceMap[normalized];
    }
    return voice;
  }

  /** 1.0 → 0%（不变速），0.5 → -50%，2.0 → +100%。 */
  private resolveSpeed(speed: number | undefined): number {
    if (speed === undefined || speed === null) return 0;
    return Math.max(-100, Math.min(100, Math.round((speed - 1) * 100)));
  }

  private async fetchEdgeTTS(text: string, voice: string, speed: number): Promise<Buffer> {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    const rate = speed >= 0 ? `+${speed}%` : `${speed}%`;
    const { audioStream } = await tts.toStream(text, { rate });
    const audioChunks: Buffer[] = [];
    return new Promise((resolve, reject) => {
      audioStream.on("data", (chunk: Buffer) => {
        audioChunks.push(chunk);
      });
      audioStream.on("error", (err: Error) => {
        reject(err);
      });
      audioStream.on("close", () => {
        const audioBuffer = Buffer.concat(audioChunks);
        resolve(audioBuffer);
      });
    });
  }

  private bufferToDataUrl(buffer: Buffer, format: string): string {
    const mime =
      format === "mp3" ? "audio/mpeg" : format === "wav" ? "audio/wav" : "audio/webm";
    return `data:${mime};base64,${buffer.toString("base64")}`;
  }

  /** 按 3.5 字/秒 + 语速调整估算音频时长。 */
  private estimateDuration(text: string, speedPercent: number): number {
    const charCount = text.length;
    const baseRate = 3.5;
    const speedFactor = 1 + speedPercent / 100;
    return Math.round((charCount / baseRate / speedFactor) * 1000) / 1000;
  }
}

export function createEdgeTTSProvider(): EdgeTTSProvider {
  rootLogger.info(
    { event: "ai.tts.provider.init", provider: "edge-tts" },
    "Edge-TTS Provider 初始化完成（使用 msedge-tts v2.0）",
  );
  return new EdgeTTSProvider();
}

/* ============================================================== */
/* V2 W12 P0 REQ-AUDIO-F01：TTS 能力公开 API                       */
/* ============================================================== */

/** TTS 能力描述。 */
export interface TtsCapability {
  model: string;
  provider: TTSProviderType;
  displayName: string;
  /** 支持的音色列表（id 列表）。 */
  voices: string[];
  /** 估算单价（元/千字），未启用计费时返 null。 */
  pricePerThousandChars: number | null;
  /** 单次最大文本长度。 */
  maxTextLength: number;
}

/** Edge-TTS 默认能力（基于 CHINESE_VOICES 列表）。 */
const EDGE_TTS_DEFAULT_CAPABILITY: TtsCapability = {
  model: "edge-tts",
  provider: "edge",
  displayName: "Edge TTS（微软公共服务）",
  voices: Object.values(CHINESE_VOICES),
  pricePerThousandChars: 0.5, // 与 PRICE_TABLE.agnes-tts-v1 对齐
  maxTextLength: 10000,
};

/** Agnes-TTS 模型（PRICE_TABLE 已声明）。 */
const AGNES_TTS_CAPABILITY: TtsCapability = {
  model: "agnes-tts-v1",
  provider: "agnes",
  displayName: "Agnes TTS v1",
  voices: ["default", "xiaoxiao", "yunxi", "yunyang", "xiaoyi"],
  pricePerThousandChars: 0.5,
  maxTextLength: 20000,
};

/** 支持的 TTS 模型白名单。 */
const SUPPORTED_TTS_MODELS: ReadonlySet<string> = new Set([
  "edge-tts",
  "agnes-tts-v1",
  ...Object.keys(CHINESE_VOICES),
]);

/**
 * 判断 model 是否为 TTS 支持的模型（含别名 + 直接 ID）。
 * - 空字符串 / null / undefined 全部 false。
 * - 不存在的 model 返 false，调用方可以 fallback 到 "edge-tts"。
 */
export function isTtsSupported(model: string | null | undefined): boolean {
  if (!model) return false;
  const normalized = model.toLowerCase().trim();
  if (SUPPORTED_TTS_MODELS.has(normalized)) return true;
  // 允许 zh-CN-XiaoxiaoNeural 等原始 ID
  if (Object.values(CHINESE_VOICES).includes(normalized)) return true;
  // 允许 agnes-tts-* 前缀
  if (/^agnes[-_]tts[-_]/.test(normalized)) return true;
  return false;
}

/**
 * 获取 TTS 模型能力描述。未知 model 返 null（调用方应 fallback）。
 */
export function getTtsCapability(model: string | null | undefined): TtsCapability | null {
  if (!model) return null;
  const normalized = model.toLowerCase().trim();
  if (normalized === "edge-tts") return EDGE_TTS_DEFAULT_CAPABILITY;
  if (normalized === "agnes-tts-v1") return AGNES_TTS_CAPABILITY;
  if (/^agnes[-_]tts[-_]/.test(normalized)) return AGNES_TTS_CAPABILITY;
  if (Object.values(CHINESE_VOICES).includes(normalized)) return EDGE_TTS_DEFAULT_CAPABILITY;
  if (CHINESE_VOICES[normalized]) return EDGE_TTS_DEFAULT_CAPABILITY;
  return null;
}

/** 列出所有 TTS 模型能力。供前端 /api/tts/models 端点使用。 */
export function listTtsCapabilities(): TtsCapability[] {
  return [EDGE_TTS_DEFAULT_CAPABILITY, AGNES_TTS_CAPABILITY];
}
