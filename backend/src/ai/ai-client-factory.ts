/**
 * @file ai-client-factory.ts
 * @description 多后端 AI 路由工厂（RoutedAIClient）。根据模型名 / provider 自动分发到对应客户端。
 *
 * ## 路由规则（按优先级）
 *  1. `zhipu-` / `glm-` 前缀 → ZhipuClient
 *  2. `cerebras-` 前缀 / provider = "cerebras" → CerebrasClient
 *  3. `sensenova-` 前缀 / provider = "sensenova" / "商汤" → SenseNovaClient
 *  4. 其他 → RealAgnesClient（默认）
 *
 * ## 注入式 Key 管理
 *  - 启动时从 env 读，但支持 `injectZhipuApiKey / injectCerebrasConfig / injectSenseNovaConfig`
 *    在用户于模型中心修改后实时切换。
 *  - TTS 默认 Edge-TTS，可切到 Agnes（待 Agnes 支持）。
 */
import { RealAgnesClient } from "./agnes-client.js";
import { ZhipuClient } from "./zhipu-client.js";
import { CerebrasClient, type CerebrasClientConfig } from "./cerebras-client.js";
import { SenseNovaClient, type SenseNovaClientConfig } from "./sensenova-client.js";
import { createEdgeTTSProvider } from "./tts-provider.js";
import { rootLogger } from "../logger.js";
import type { ChatParams, ChatChunk, ImageParams, VideoParams, TaskStatus } from "../types.js";
import type { AgnesClient } from "./agnes-client.js";
import type { TTSProviderType } from "./tts-provider.js";

const ZHIPU_MODEL_PREFIXES = ["glm-", "zhipu-"];
const CEREBRAS_MODEL_PREFIXES = ["cerebras-"];
const CEREBRAS_PROVIDERS = ["cerebras"];
const SENSENOVA_MODEL_PREFIXES = ["sensenova-"];
const SENSENOVA_PROVIDERS = ["sensenova", "商汤"];

export function shouldRouteToZhipu(model: string | undefined): boolean {
  if (!model) return false;
  const m = model.trim().toLowerCase();
  return ZHIPU_MODEL_PREFIXES.some((prefix) => m.startsWith(prefix));
}

export function shouldRouteToCerebras(model: string | undefined, provider?: string): boolean {
  if (!model) return false;
  const m = model.trim().toLowerCase();
  if (CEREBRAS_MODEL_PREFIXES.some((prefix) => m.startsWith(prefix))) return true;
  if (provider && CEREBRAS_PROVIDERS.some((p) => provider.toLowerCase() === p)) return true;
  return false;
}

export function shouldRouteToSenseNova(model: string | undefined, provider?: string): boolean {
  if (!model) return false;
  const m = model.trim().toLowerCase();
  if (SENSENOVA_MODEL_PREFIXES.some((prefix) => m.startsWith(prefix))) return true;
  if (provider) {
    const p = provider.trim().toLowerCase();
    if (SENSENOVA_PROVIDERS.some((sp) => p === sp)) return true;
  }
  return false;
}

export interface CerebrasConfig {
  apiKey: string;
  baseURL?: string;
  proxyURL?: string;
}

export interface SenseNovaConfig {
  apiKey: string;
  baseURL?: string;
  proxyURL?: string;
}

export interface TTSProviderConfig {
  type?: TTSProviderType;
}

export interface AIClientFactoryOptions {
  env?: NodeJS.ProcessEnv;
  zhipuApiKey?: string;
  cerebrasConfig?: CerebrasConfig;
  sensenovaConfig?: SenseNovaConfig;
  ttsConfig?: TTSProviderConfig;
}

export class RoutedAIClient implements AgnesClient {
  private readonly agnes: RealAgnesClient;
  private readonly zhipu: ZhipuClient;
  private zhipuApiKey: string | undefined;
  private cerebras: CerebrasClient | null = null;
  private cerebrasConfig: CerebrasConfig | undefined;
  private cerebrasModelIds: Set<string> = new Set();
  private sensenova: SenseNovaClient | null = null;
  private sensenovaConfig: SenseNovaConfig | undefined;
  private sensenovaModelIds: Set<string> = new Set();
  private readonly ttsProvider: ReturnType<typeof createEdgeTTSProvider> | null;
  private readonly ttsProviderType: TTSProviderType;

  constructor(options: AIClientFactoryOptions = {}) {
    const env = options.env ?? process.env;
    this.agnes = new RealAgnesClient(env);
    this.zhipuApiKey = options.zhipuApiKey ?? env.ZHIPU_API_KEY;
    this.zhipu = new ZhipuClient({
      apiKeyProvider: () => this.zhipuApiKey,
    });
    if (options.cerebrasConfig) {
      this.cerebrasConfig = options.cerebrasConfig;
      this.cerebras = new CerebrasClient({
        apiKey: options.cerebrasConfig.apiKey,
        baseURL: options.cerebrasConfig.baseURL,
        proxyURL: options.cerebrasConfig.proxyURL,
      });
    } else if (env.CEREBRAS_API_KEY) {
      this.cerebrasConfig = {
        apiKey: env.CEREBRAS_API_KEY,
        baseURL: env.CEREBRAS_API_BASE_URL,
        proxyURL: env.CEREBRAS_PROXY_URL || env.HTTP_PROXY || env.HTTPS_PROXY,
      };
      this.cerebras = new CerebrasClient(this.cerebrasConfig as CerebrasClientConfig);
    }
    if (options.sensenovaConfig) {
      this.sensenovaConfig = options.sensenovaConfig;
      this.sensenova = new SenseNovaClient({
        apiKey: options.sensenovaConfig.apiKey,
        baseURL: options.sensenovaConfig.baseURL,
        proxyURL: options.sensenovaConfig.proxyURL,
      });
    } else if (env.SENSENOVA_API_KEY) {
      this.sensenovaConfig = {
        apiKey: env.SENSENOVA_API_KEY,
        baseURL: env.SENSENOVA_API_BASE_URL,
        proxyURL: env.SENSENOVA_PROXY_URL || env.HTTP_PROXY || env.HTTPS_PROXY,
      };
      this.sensenova = new SenseNovaClient(this.sensenovaConfig as SenseNovaClientConfig);
    }
    const ttsType = (options.ttsConfig?.type ?? env.TTS_PROVIDER ?? "edge") as TTSProviderType;
    this.ttsProviderType = ttsType;
    if (ttsType === "edge") {
      this.ttsProvider = createEdgeTTSProvider();
    } else {
      this.ttsProvider = null;
      rootLogger.info(
        { event: "ai.tts.provider.init", provider: "agnes" },
        "TTS Provider 设置为 Agnes（需 Agnes 支持 TTS）",
      );
    }
  }

  injectZhipuApiKey(key: string | undefined): void {
    const normalized = (key ?? "").trim() || undefined;
    this.zhipuApiKey = normalized;
    if (rootLogger.isLevelEnabled("debug")) {
      rootLogger.debug(
        {
          event: "ai.route.zhipu_key_injected",
          hasKey: Boolean(normalized),
          keyPreview: normalized ? `${normalized.slice(0, 4)}...<长度=${normalized.length}>` : null,
        },
        normalized ? "已注入智谱 API Key" : "已清空智谱 API Key",
      );
    }
  }

  injectSenseNovaConfig(config: SenseNovaConfig | undefined, modelId?: string): void {
    const debugEnabled = rootLogger.isLevelEnabled("debug");
    if (!config || !config.apiKey) {
      this.sensenova = null;
      this.sensenovaConfig = undefined;
      if (debugEnabled) {
        rootLogger.debug(
          { event: "ai.route.sensenova_config_cleared", modelId },
          "已清空商汤客户端（无配置或缺少 API Key）",
        );
      }
      return;
    }
    this.sensenovaConfig = config;
    this.sensenova = new SenseNovaClient({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      proxyURL: config.proxyURL,
    });
    if (modelId) {
      const normalizedModelId = modelId.trim().toLowerCase();
      this.sensenovaModelIds.add(normalizedModelId);
      if (debugEnabled) {
        rootLogger.debug(
          {
            event: "ai.route.sensenova_config_injected",
            modelId: normalizedModelId,
            baseURL: config.baseURL ?? null,
            hasProxy: Boolean(config.proxyURL),
            knownModelCount: this.sensenovaModelIds.size,
          },
          `已为模型 ${normalizedModelId} 注入商汤客户端`,
        );
      }
    } else if (debugEnabled) {
      rootLogger.debug(
        { event: "ai.route.sensenova_config_injected", hasProxy: Boolean(config.proxyURL) },
        "已注入商汤客户端（未传 modelId，仅按前缀匹配）",
      );
    }
  }

  injectCerebrasConfig(config: CerebrasConfig | undefined, modelId?: string): void {
    const debugEnabled = rootLogger.isLevelEnabled("debug");
    if (!config || !config.apiKey) {
      this.cerebras = null;
      this.cerebrasConfig = undefined;
      if (debugEnabled) {
        rootLogger.debug(
          { event: "ai.route.cerebras_config_cleared", modelId },
          "已清空 Cerebras 客户端（无配置或缺少 API Key）",
        );
      }
      return;
    }
    this.cerebrasConfig = config;
    this.cerebras = new CerebrasClient({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      proxyURL: config.proxyURL,
    });
    if (modelId) {
      const normalizedModelId = modelId.trim().toLowerCase();
      this.cerebrasModelIds.add(normalizedModelId);
      if (debugEnabled) {
        rootLogger.debug(
          {
            event: "ai.route.cerebras_config_injected",
            modelId: normalizedModelId,
            baseURL: config.baseURL ?? null,
            hasProxy: Boolean(config.proxyURL),
            knownModelCount: this.cerebrasModelIds.size,
          },
          `已为模型 ${normalizedModelId} 注入 Cerebras 客户端`,
        );
      }
    } else if (debugEnabled) {
      rootLogger.debug(
        { event: "ai.route.cerebras_config_injected", hasProxy: Boolean(config.proxyURL) },
        "已注入 Cerebras 客户端（未传 modelId，仅按前缀匹配）",
      );
    }
  }

  private pickClient(model?: string): { chat(params: ChatParams, signal?: AbortSignal): AsyncIterable<ChatChunk> } {
    const debugEnabled = rootLogger.isLevelEnabled("debug");
    if (shouldRouteToZhipu(model)) {
      if (debugEnabled) {
        rootLogger.debug(
          { event: "ai.route.decision", model, backend: "zhipu" },
          `路由决策：模型 "${model}" → 智谱（glm-/zhipu- 前缀命中）`,
        );
      }
      return this.zhipu;
    }
    if (
      shouldRouteToCerebras(model) ||
      (model && this.cerebrasModelIds.has(model.trim().toLowerCase()))
    ) {
      if (!this.cerebras) {
        throw new Error(
          `Cerebras client not configured. Model "${model}" requires Cerebras API Key. ` +
          `Please set it in model center or environment variable CEREBRAS_API_KEY.`,
        );
      }
      if (debugEnabled) {
        rootLogger.debug(
          { event: "ai.route.decision", model, backend: "cerebras" },
          `路由决策：模型 "${model}" → Cerebras`,
        );
      }
      return this.cerebras;
    }
    if (
      shouldRouteToSenseNova(model) ||
      (model && this.sensenovaModelIds.has(model.trim().toLowerCase()))
    ) {
      if (!this.sensenova) {
        throw new Error(
          `SenseNova client not configured. Model "${model}" requires SenseNova API Key. ` +
          `Please set it in environment variable SENSENOVA_API_KEY.`,
        );
      }
      if (debugEnabled) {
        rootLogger.debug(
          { event: "ai.route.decision", model, backend: "sensenova" },
          `路由决策：模型 "${model}" → 商汤`,
        );
      }
      return this.sensenova;
    }
    if (debugEnabled) {
      rootLogger.debug(
        { event: "ai.route.decision", model, backend: "agnes" },
        `路由决策：模型 "${model ?? "(默认)"}" → Agnes（默认）`,
      );
    }
    return this.agnes;
  }

  async *chat(params: ChatParams, signal?: AbortSignal): AsyncIterable<ChatChunk> {
    const backend = this.pickClient(params.model);
    if (rootLogger.isLevelEnabled("debug")) {
      rootLogger.debug(
        {
          event: "ai.route.chat_dispatch",
          model: params.model,
          promptLen: params.message.length,
        },
        `聊天分发：模型=${params.model ?? "(默认)"}（由 pickClient 决定后端）`,
      );
    }
    yield* backend.chat(params, signal);
  }

  async generateImage(
    params: ImageParams,
    signal?: AbortSignal,
  ): Promise<{ imageUrls: string[] }> {
    return this.agnes.generateImage(params, signal);
  }

  async generateVideo(
    params: VideoParams,
    signal?: AbortSignal,
  ): Promise<{
    taskId: string;
    providerTaskId?: string;
    videoId?: string;
    progress?: number;
    seconds?: string;
    size?: string;
  }> {
    return this.agnes.generateVideo(params, signal);
  }

  async queryTask(
    taskId: string,
    signal?: AbortSignal,
  ): Promise<{ status: TaskStatus; videoUrl?: string; error?: string }> {
    return this.agnes.queryTask(taskId, signal);
  }

  async generateTTS(
    params: { text: string; voice?: string; emotion?: string; speed?: number; format?: string },
    signal?: AbortSignal,
  ): Promise<{
    file_url: string;
    duration: number;
    status: string;
    voice?: string;
    emotion?: string;
  }> {
    if (this.ttsProviderType === "edge" && this.ttsProvider) {
      return this.ttsProvider.generateTTS(params, signal);
    }
    return this.agnes.generateTTS(params, signal);
  }

  async queryVideoStatus(
    taskId: string,
    signal?: AbortSignal,
  ): Promise<{ status: string; progress: number; file_url: string; error: string }> {
    return this.agnes.queryVideoStatus(taskId, signal);
  }
}

export function createAIClient(options: AIClientFactoryOptions = {}): AgnesClient {
  return new RoutedAIClient(options);
}
