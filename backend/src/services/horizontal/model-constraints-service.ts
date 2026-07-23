/**
 * @file model-constraints-service.ts
 * @description V2 W11 MODEL-F01~F06 运行时模型约束服务
 *
 * 职责:
 *  - 提供"按模型查能力 / 校验参数 / 列举可用模型"的统一入口
 *  - 缓存模型目录(避免每次请求都遍历)
 *  - 给前端 GET /api/models/capabilities 提供数据
 *  - 给 ai client 在 dispatch 前做 guard 校验(F03)
 *  - 给契约测试 F06 提供 ground truth(后续可加 round-trip 测试)
 */
import { rootLogger } from "../../logger.js";
import {
  MODEL_CATALOG,
  getAllModels,
  getModelByName,
  isCapabilitySupported,
  getModelsForCapability,
  validateImageParams,
  validateVideoParams,
  validateChatParams,
  standardizeVideoParams,
  type ModelCapabilities,
  type ModelCapability,
  type ValidationResult,
  type ModelProvider,
} from "../../types/model-capabilities.js";

const log = rootLogger.child({ module: "model-constraints-service" });

export interface ModelConstraintsService {
  /** 列出可用模型(给前端下拉/概览用) */
  listModels(opts?: { provider?: ModelProvider; capability?: ModelCapability; visibleOnly?: boolean }): ModelCapabilities[];
  /** 取单个模型的能力声明 */
  getModel(name: string): ModelCapabilities | null;
  /** 模型是否支持某能力(给 AI client guard) */
  supportsCapability(name: string, capability: ModelCapability): boolean;
  /** 列出支持某能力的所有模型 */
  listForCapability(capability: ModelCapability): ModelCapabilities[];
  /** 校验 image params,返回 valid/修正值/issue 列表 */
  validateImage(modelName: string, params: Record<string, unknown>): ValidationResult;
  /** 校验 video params */
  validateVideo(modelName: string, params: Record<string, unknown>): ValidationResult;
  /** 校验 chat params */
  validateChat(modelName: string, params: Record<string, unknown>): ValidationResult;
  /** 把 V1 写法转 V2 标准 params(走 MODEL.video 约束) */
  standardizeVideo(modelName: string, input: { ratio?: string; duration?: number; num_inference_steps?: number; width?: number; height?: number; fps?: number; }): Record<string, unknown>;
  /** 契约测试桩:校验"声明的能力"确实在 dispatch 路径里被支持(给 F06 用) */
  contractCheck(name: string): { ok: boolean; reason?: string };
}

export function createModelConstraintsService(): ModelConstraintsService {
  return {
    listModels(opts) {
      return getAllModels(opts);
    },
    getModel(name) {
      return getModelByName(name);
    },
    supportsCapability(name, capability) {
      return isCapabilitySupported(name, capability);
    },
    listForCapability(capability) {
      return getModelsForCapability(capability);
    },
    validateImage(modelName, params) {
      return validateImageParams(modelName, params);
    },
    validateVideo(modelName, params) {
      return validateVideoParams(modelName, params);
    },
    validateChat(modelName, params) {
      return validateChatParams(modelName, params);
    },
    standardizeVideo(modelName, input) {
      const std = standardizeVideoParams(modelName, input);
      // 二次校验:把标准化后的 params 喂给 validateVideo,有冲突就修正
      const v = validateVideoParams(modelName, std);
      if (v.normalized) return v.normalized;
      return std;
    },
    contractCheck(name) {
      const m = getModelByName(name);
      if (!m) return { ok: false, reason: `model_not_found: ${name}` };
      if (m.deprecated) return { ok: false, reason: `model_deprecated: ${name}` };
      // Fake provider 是隐藏的开发桩，按设计接受任意参数，不要求生产模型约束表。
      if (m.provider === "fake") return { ok: true };
      // 简单自洽校验:如果声明 capabilities 包含 video,则 video.constraints 必填
      if (m.capabilities.includes("video") && !m.video) {
        return { ok: false, reason: `capability_video_but_no_constraints: ${name}` };
      }
      if (m.capabilities.includes("image") && !m.image) {
        return { ok: false, reason: `capability_image_but_no_constraints: ${name}` };
      }
      if (m.capabilities.includes("chat") && !m.chat) {
        return { ok: false, reason: `capability_chat_but_no_constraints: ${name}` };
      }
      if (m.capabilities.includes("tts") && !m.tts) {
        return { ok: false, reason: `capability_tts_but_no_constraints: ${name}` };
      }
      // 隐藏(hide)的模型不应该有 visible=true(自相矛盾)
      // 走 schema 强校验留给上游
      return { ok: true };
    },
  };
}

/** 全局单例(避免每次都重建) */
let _instance: ModelConstraintsService | null = null;
export function getModelConstraintsService(): ModelConstraintsService {
  if (!_instance) {
    _instance = createModelConstraintsService();
    log.info({ modelCount: MODEL_CATALOG.length }, "model constraints service initialized");
  }
  return _instance;
}
