/**
 * @file route-policies.ts
 * @description V2 W11 ROUTE-F01~F05 路由策略类型 + 决策日志 + 内置策略定义
 *
 * 设计要点（SSO 单一事实源）：
 *  1) 路由策略（RoutePolicy）= 在某个 capability 维度（chat/image/video/tts）下，
 *     决定"调用哪个模型"的可计算规则集合，由 **一个或多个 RoutingStrategy** 组合而成。
 *  2) 路由决策（RouteDecision）= 一次具体的路由结果：chosen model + 命中策略 + 候选项 + 解释。
 *  3) 决策日志（RouteDecisionLog）= 所有 RouteDecision 的可追溯记录（行级 DB 记录）。
 *  4) 内置策略 4 类（F02 quality / F03 speed / F04 cost / F01 manual）使用 **加权评分**
 *     进行候选模型排序；策略同时给出**解释**（F05）写入 decision.reason[]。
 *  5) 与 model-capabilities.ts 的 MODEL_CATALOG 联动：所有候选都从 MODEL_CATALOG 过滤。
 *  6) 与 W10 限流/熔断/恢复/降级（FEAT-PIPE-006）正交：策略只负责"挑哪个模型"，
 *     限流熔断负责"挑完后能不能用、被拒后切换到 fallback chain"。
 *
 * 数据库落点：route_policies / route_decision_logs 两张表（SqliteRepository 自动建表）。
 * V2 schema freeze：不新增 DB 业务表，本类型仅作为代码层抽象，可由后续 RDB 落库。
 */

import type { FieldSpec } from "../storage/repository.js";
import { MODEL_CATALOG, getModelsForCapability, type ModelCapability } from "./model-capabilities.js";

/* ==================== 策略 / 决策 / 日志 基础类型 ==================== */

export type RouteStrategyKind = "manual" | "quality" | "speed" | "cost" | "balanced";

export type RouteCapability = ModelCapability;

export interface RouteStrategy {
  kind: RouteStrategyKind;
  /** 策略权重（多策略组合时使用），默认 1 */
  weight?: number;
  /** 策略专属配置 */
  options?: {
    /** quality: 期望最低 quality_score（0-100），低于此分视为不达标 */
    minQualityScore?: number;
    /** speed: 最大允许 latency_ms */
    maxLatencyMs?: number;
    /** cost: 单次调用最大允许 cost 元 */
    maxCostPerCall?: number;
    /** manual: 用户指定模型名（不指定则用 pipeline 节点声明的 model） */
    pinnedModel?: string;
  };
}

export interface RoutePolicy {
  id: string;
  name: string;
  description: string;
  capability: RouteCapability;
  strategies: RouteStrategy[];
  /** 决策兜底模型（所有策略都未命中时使用） */
  fallbackModel: string;
  /** 是否启用 */
  enabled: boolean;
  /** 是否系统内置（系统内置不可删除，可禁用） */
  builtIn?: boolean;
  created_at: string;
  updated_at: string;
}

export const routePolicyFields: FieldSpec<RoutePolicy>[] = [
  { key: "id", type: "string" },
  { key: "name", type: "string" },
  { key: "description", type: "string" },
  { key: "capability", type: "string" },
  { key: "strategies", type: "json" },
  { key: "fallbackModel", type: "string" },
  { key: "enabled", type: "boolean" },
  { key: "builtIn", type: "boolean" },
  { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
];

/* ==================== 决策结果 + 日志 ==================== */

export interface RouteCandidateScore {
  model: string;
  /** 加权综合分（0-100，越高越优） */
  score: number;
  /** 各策略明细分（key=策略 kind, value=原始分 0-100） */
  breakdown: Record<string, number>;
  /** 命中原因（来自各策略） */
  reasons: string[];
  /** 是否所有策略都通过（true=首选, false=兜底候选） */
  allPassed: boolean;
}

export interface RouteDecision {
  policyId: string;
  policyName: string;
  capability: RouteCapability;
  chosenModel: string;
  /** 命中的策略（按命中顺序） */
  matchedStrategies: RouteStrategyKind[];
  /** 候选评分列表（按 score 降序） */
  candidates: RouteCandidateScore[];
  /** 整体决策解释（人类可读） */
  reason: string[];
  /** 是否走 fallback（所有策略候选都被排除时为 true） */
  usedFallback: boolean;
  /** 决策耗时 ms */
  durationMs: number;
  decidedAt: string;
  /** 上下文（调用方传入，用于日志关联） */
  context?: {
    projectId?: string;
    runId?: string;
    nodeId?: string;
    userId?: string;
    requestId?: string;
  };
}

export interface RouteDecisionLog {
  id: string;
  policyId: string;
  policyName: string;
  capability: RouteCapability;
  chosenModel: string;
  matchedStrategies: string[]; // JSON 数组
  candidates: string[]; // JSON 数组（RouteCandidateScore[] 序列化）
  reason: string[]; // JSON 数组
  usedFallback: boolean;
  durationMs: number;
  projectId?: string;
  runId?: string;
  nodeId?: string;
  userId?: string;
  requestId?: string;
  decidedAt: string;
  created_at: string;
}

export const routeDecisionLogFields: FieldSpec<RouteDecisionLog>[] = [
  { key: "id", type: "string" },
  { key: "policyId", type: "string" },
  { key: "policyName", type: "string" },
  { key: "capability", type: "string" },
  { key: "chosenModel", type: "string" },
  { key: "matchedStrategies", type: "json" },
  { key: "candidates", type: "json" },
  { key: "reason", type: "json" },
  { key: "usedFallback", type: "boolean" },
  { key: "durationMs", type: "number" },
  { key: "projectId", type: "string" },
  { key: "runId", type: "string" },
  { key: "nodeId", type: "string" },
  { key: "userId", type: "string" },
  { key: "requestId", type: "string" },
  { key: "decidedAt", type: "string" },
  { key: "created_at", type: "string" },
];

/* ==================== 评分输入（来自调用方 + 模型目录）==================== */

export interface RouteInput {
  capability: RouteCapability;
  /** 调用方在节点/请求里声明的候选 model 名（不传则用 MODEL_CATALOG 全部可见项） */
  candidates?: string[];
  /** 调用方指定的 model（manual 策略最高优先） */
  pinnedModel?: string;
  /** 期望质量分 0-100（F02 quality 策略可参考） */
  expectedQualityScore?: number;
  /** 期望最大延迟 ms（F03 speed 策略可参考） */
  expectedMaxLatencyMs?: number;
  /** 期望最大单次成本 元（F04 cost 策略可参考） */
  expectedMaxCostPerCall?: number;
  /** 上下文：供 decision_log 关联 */
  context?: RouteDecision["context"];
}

/* ==================== 内置策略默认值 ==================== */

/**
 * 5 个系统内置策略（每个 capability 各一个默认）：
 *  - image_default_balanced:  balanced（综合 4 维）兜底
 *  - image_premium_quality:   quality（质量优先，minQualityScore=85）
 *  - image_fast_speed:        speed（速度优先，maxLatencyMs=8000）
 *  - video_default_balanced:  balanced
 *  - video_premium_quality:   quality
 *  - chat_default_balanced:   balanced
 *  - chat_cost_optimal:       cost（成本优先，maxCostPerCall=0.5）
 *  - tts_default_balanced:    balanced
 */
export const BUILTIN_POLICIES: RoutePolicy[] = (() => {
  const now = new Date().toISOString();
  const mk = (
    id: string,
    name: string,
    description: string,
    capability: RouteCapability,
    strategies: RouteStrategy[],
    fallbackModel: string
  ): RoutePolicy => ({
    id,
    name,
    description,
    capability,
    strategies,
    fallbackModel,
    enabled: true,
    builtIn: true,
    created_at: now,
    updated_at: now,
  });
  return [
    mk("image_default_balanced", "图片-综合优先", "图片生成默认策略,综合质量/速度/成本",
       "image", [{ kind: "balanced", weight: 1 }], "agnes-image-2.1-flash"),
    mk("image_premium_quality", "图片-质量优先", "高优先级图片任务,要求 quality_score>=85",
       "image", [{ kind: "quality", weight: 1.5, options: { minQualityScore: 85 } },
                  { kind: "balanced", weight: 1 }], "agnes-image-2.1-flash"),
    mk("image_fast_speed", "图片-速度优先", "快速预览场景,要求 latency_ms<=8000",
       "image", [{ kind: "speed", weight: 1.5, options: { maxLatencyMs: 8000 } },
                  { kind: "balanced", weight: 1 }], "agnes-image-2.1-flash"),
    mk("video_default_balanced", "视频-综合优先", "视频生成默认策略,综合 3 维",
       "video", [{ kind: "balanced", weight: 1 }], "agnes-video-v2.0"),
    mk("video_premium_quality", "视频-质量优先", "高优先级成片,要求 quality_score>=90",
       "video", [{ kind: "quality", weight: 1.5, options: { minQualityScore: 90 } },
                  { kind: "balanced", weight: 1 }], "agnes-video-v2.0"),
    mk("chat_default_balanced", "聊天-综合优先", "默认聊天策略,综合质量/速度/成本",
       "chat", [{ kind: "balanced", weight: 1 }], "agnes-chat-v3.5"),
    mk("chat_cost_optimal", "聊天-成本最优", "低优先级聊天任务,单次成本<=0.5 元",
       "chat", [{ kind: "cost", weight: 1.5, options: { maxCostPerCall: 0.5 } },
                  { kind: "balanced", weight: 1 }], "agnes-chat-v3.5"),
    mk("tts_default_balanced", "TTS-综合优先", "语音合成默认策略",
       "tts", [{ kind: "balanced", weight: 1 }], "edge-tts-zh"),
  ];
})();

/* ==================== 评分工具：4 维归一化 ==================== */

export interface ModelRuntimeMetrics {
  /** 最近 N 次调用的平均延迟 ms（无数据时用 defaults） */
  avgLatencyMs?: number;
  /** 最近 N 次调用的平均成本 元（无数据时走 pricing.defaultPrice） */
  avgCostPerCall?: number;
  /** 最近 N 次调用的质量分（0-100，无数据时给默认启发式 70） */
  qualityScore?: number;
  /** 最近 N 次调用的成功率 0-1 */
  successRate?: number;
}

/**
 * 启发式默认指标（当无运行时数据时使用）。
 * 设计原则：不依赖任何外部监控/打点系统，所有分都是 0-100 启发式值。
 */
export function defaultModelMetrics(modelName: string): Required<ModelRuntimeMetrics> {
  const m = MODEL_CATALOG.find((c) => c.name === modelName);
  if (!m) {
    return { avgLatencyMs: 10000, avgCostPerCall: 1.0, qualityScore: 50, successRate: 0.5 };
  }
  // 启发式：agnes 厂商质量分 80,glm 75,cerebras 70,edge-tts 65,fake 30
  const baseQuality =
    m.provider === "agnes" ? 80 :
    m.provider === "zhipu" ? 75 :
    m.provider === "cerebras" ? 70 :
    m.provider === "sensenova" ? 68 :
    m.provider === "edge" ? 65 :
    m.provider === "fake" ? 30 : 60;
  // 启发式：chat 快,image 中,video 慢
  const baseLatency =
    m.capabilities.includes("chat") ? 2000 :
    m.capabilities.includes("image") ? 5000 :
    m.capabilities.includes("video") ? 30000 :
    m.capabilities.includes("tts") ? 3000 : 5000;
  // 启发式：pricing.input(chat) 或 标准价
  let baseCost = 0.5;
  if (m.pricing) {
    if (m.capabilities.includes("chat") && m.pricing.input != null) {
      baseCost = m.pricing.input * 1000; // 元/token → 1k token 元（单次估算）
    } else if (m.capabilities.includes("image") && m.pricing.perImage != null) {
      baseCost = m.pricing.perImage;
    } else if (m.capabilities.includes("video") && m.pricing.perVideoSecond != null) {
      baseCost = m.pricing.perVideoSecond * 5; // 默认 5 秒视频
    } else if (m.capabilities.includes("tts") && m.pricing.output != null) {
      baseCost = m.pricing.output * 1000; // 1k 字符估算
    }
  }
  return {
    avgLatencyMs: baseLatency,
    avgCostPerCall: Math.max(0.001, baseCost),
    qualityScore: baseQuality,
    successRate: 0.95,
  };
}

/**
 * 4 维分 → 0-100 综合分（各维独立归一化,等权平均）。
 *  - 质量分：直接用 qualityScore
 *  - 速度分：100 - min(100, latencyMs/100)（latency 越低分越高,1s=90,10s=0）
 *  - 成本分：100 - min(100, costPerCall * 50)（1 元=50 分,2 元=0）
 *  - 成功率分：successRate * 100
 */
export function computeOverallScore(metrics: ModelRuntimeMetrics): {
  overall: number;
  breakdown: { quality: number; speed: number; cost: number; reliability: number };
} {
  const filled: Required<ModelRuntimeMetrics> = {
    avgLatencyMs: metrics.avgLatencyMs ?? 10000,
    avgCostPerCall: metrics.avgCostPerCall ?? 1.0,
    qualityScore: metrics.qualityScore ?? 70,
    successRate: metrics.successRate ?? 0.9,
  };
  const quality = Math.max(0, Math.min(100, filled.qualityScore));
  const speed = Math.max(0, Math.min(100, 100 - filled.avgLatencyMs / 100));
  const cost = Math.max(0, Math.min(100, 100 - filled.avgCostPerCall * 50));
  const reliability = Math.max(0, Math.min(100, filled.successRate * 100));
  const overall = (quality + speed + cost + reliability) / 4;
  return { overall, breakdown: { quality, speed, cost, reliability } };
}

/* ==================== 路由核心：pickModel ==================== */

export interface RoutePickResult {
  chosenModel: string;
  candidates: RouteCandidateScore[];
  matchedStrategies: RouteStrategyKind[];
  reasons: string[];
  usedFallback: boolean;
}

/**
 * 策略评估（单一候选 + 单一策略）:
 *  - manual:   pinnedModel 命中即返回 high 分 + reason；不命中则低分
 *  - quality:  qualityScore >= minQualityScore 给高分,否则给低分；reason 记录分差
 *  - speed:    avgLatencyMs <= maxLatencyMs 给高分,否则按比例扣分
 *  - cost:     avgCostPerCall <= maxCostPerCall 给高分,否则按比例扣分
 *  - balanced: 走综合分
 */
export function evaluateStrategy(
  strategy: RouteStrategy,
  modelName: string,
  metrics: Required<ModelRuntimeMetrics>
): { score: number; reason: string; passed: boolean } {
  const opts = strategy.options ?? {};
  switch (strategy.kind) {
    case "manual": {
      const target = opts.pinnedModel;
      if (target && target === modelName) {
        return { score: 100, reason: `手动指定命中:pinned=${target}`, passed: true };
      }
      return { score: 0, reason: `未命中手动指定(pinned=${target ?? "(无)"})`, passed: false };
    }
    case "quality": {
      const min = opts.minQualityScore ?? 70;
      if (metrics.qualityScore >= min) {
        return {
          score: metrics.qualityScore,
          reason: `质量分 ${metrics.qualityScore} ≥ ${min}`,
          passed: true,
        };
      }
      const gap = min - metrics.qualityScore;
      return {
        score: Math.max(0, metrics.qualityScore - gap),
        reason: `质量分 ${metrics.qualityScore} < ${min},差 ${gap.toFixed(1)}`,
        passed: false,
      };
    }
    case "speed": {
      const max = opts.maxLatencyMs ?? 10000;
      if (metrics.avgLatencyMs <= max) {
        return {
          score: 100 - (metrics.avgLatencyMs / max) * 50,
          reason: `延迟 ${metrics.avgLatencyMs}ms ≤ ${max}ms`,
          passed: true,
        };
      }
      const over = metrics.avgLatencyMs - max;
      return {
        score: Math.max(0, 50 - over / 1000),
        reason: `延迟 ${metrics.avgLatencyMs}ms 超 ${max}ms,超出 ${over}ms`,
        passed: false,
      };
    }
    case "cost": {
      const max = opts.maxCostPerCall ?? 1.0;
      if (metrics.avgCostPerCall <= max) {
        return {
          score: 100 - (metrics.avgCostPerCall / max) * 50,
          reason: `成本 ${metrics.avgCostPerCall} 元 ≤ ${max} 元`,
          passed: true,
        };
      }
      const over = metrics.avgCostPerCall - max;
      return {
        score: Math.max(0, 50 - over * 50),
        reason: `成本 ${metrics.avgCostPerCall} 元 超 ${max} 元,超出 ${over.toFixed(2)}`,
        passed: false,
      };
    }
    case "balanced": {
      const { overall } = computeOverallScore(metrics);
      return {
        score: overall,
        reason: `综合分 ${overall.toFixed(1)} (q=${metrics.qualityScore} lat=${metrics.avgLatencyMs}ms cost=${metrics.avgCostPerCall}元 succ=${metrics.successRate})`,
        passed: true,
      };
    }
    default:
      return { score: 0, reason: `未知策略 ${(strategy as { kind: string }).kind}`, passed: false };
  }
}

/**
 * 多策略组合：对每个候选模型遍历所有策略,加权汇总,排序选 top 1。
 * 任一策略 passed=true 视为整体 passed（用 OR 语义）；所有策略都 passed=false 才走 fallback。
 */
export function pickModelByPolicy(
  policy: RoutePolicy,
  input: RouteInput,
  metricsLookup?: (modelName: string) => ModelRuntimeMetrics
): RoutePickResult {
  const t0 = Date.now();
  // 1) 候选池
  let pool: string[];
  if (input.candidates && input.candidates.length > 0) {
    pool = input.candidates.filter((n) =>
      MODEL_CATALOG.some((m) => m.name === n && m.capabilities.includes(policy.capability))
    );
  } else {
    pool = getModelsForCapability(policy.capability)
      .filter((m) => m.visible !== false)
      .map((m) => m.name);
  }
  // 2) 评分
  const candidates: RouteCandidateScore[] = pool.map((modelName) => {
    const metrics: Required<ModelRuntimeMetrics> = {
      ...defaultModelMetrics(modelName),
      ...(metricsLookup ? metricsLookup(modelName) : {}),
    };
    const breakdown: Record<string, number> = {};
    const reasons: string[] = [];
    let weightedSum = 0;
    let totalWeight = 0;
    let passedCount = 0;
    const matchedKinds: RouteStrategyKind[] = [];
    for (const strat of policy.strategies) {
      const w = strat.weight ?? 1;
      const ev = evaluateStrategy(strat, modelName, metrics);
      breakdown[strat.kind] = Number(ev.score.toFixed(2));
      reasons.push(`[${strat.kind}] ${ev.reason}`);
      weightedSum += ev.score * w;
      totalWeight += w;
      if (ev.passed) {
        passedCount++;
        matchedKinds.push(strat.kind);
      }
    }
    const finalScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
    const allPassed = passedCount === policy.strategies.length;
    if (!allPassed) {
      reasons.push(`策略通过率 ${passedCount}/${policy.strategies.length}`);
    }
    return {
      model: modelName,
      score: Number(finalScore.toFixed(2)),
      breakdown,
      reasons,
      allPassed,
    };
  });
  // 3) 排序：score 降序,同分按 name asc
  candidates.sort((a, b) => (b.score - a.score) || a.model.localeCompare(b.model));
  // 4) manual 策略优先（pinnedModel 命中,直接返回 top,即使综合分低）
  const manual = policy.strategies.find((s) => s.kind === "manual");
  if (manual?.options?.pinnedModel) {
    const pinned = manual.options.pinnedModel;
    if (pool.includes(pinned)) {
      const target = candidates.find((c) => c.model === pinned)!;
      return {
        chosenModel: pinned,
        candidates,
        matchedStrategies: ["manual"],
        reasons: [`手动策略命中:pinned=${pinned}`, ...target.reasons],
        usedFallback: false,
      };
    }
  }
  // 5) 选 top 1（任意 allPassed=true 选最高分 allPassed 候选;否则走 fallback）
  const passed = candidates.filter((c) => c.allPassed);
  const winner = (passed[0] ?? candidates[0]);
  if (!winner) {
    // 6) pool 为空 → fallback
    return {
      chosenModel: policy.fallbackModel,
      candidates,
      matchedStrategies: [],
      reasons: [`候选池为空(已过滤 capability=${policy.capability}),使用 fallback`],
      usedFallback: true,
    };
  }
  const usedFallback = passed.length === 0;
  const matched = usedFallback
    ? ([] as RouteStrategyKind[])
    : policy.strategies.filter((s) => s.kind !== "manual").map((s) => s.kind);
  return {
    chosenModel: winner.model,
    candidates,
    matchedStrategies: matched,
    reasons: winner.reasons,
    usedFallback,
  };
}

/* ==================== 工具:policy 校验 ==================== */

export interface ValidationIssue { field: string; message: string; }

export function validateRoutePolicy(policy: Partial<RoutePolicy>): {
  valid: boolean;
  issues: ValidationIssue[];
  normalized: Partial<RoutePolicy> | null;
} {
  const issues: ValidationIssue[] = [];
  const normalized: Partial<RoutePolicy> = { ...policy };
  if (!policy.id || typeof policy.id !== "string") issues.push({ field: "id", message: "id 必填" });
  if (!policy.name || typeof policy.name !== "string") issues.push({ field: "name", message: "name 必填" });
  if (!policy.capability) issues.push({ field: "capability", message: "capability 必填" });
  if (policy.capability && !["chat", "image", "video", "tts"].includes(policy.capability)) {
    issues.push({ field: "capability", message: `不支持的 capability: ${policy.capability}` });
  }
  if (!Array.isArray(policy.strategies) || policy.strategies.length === 0) {
    issues.push({ field: "strategies", message: "strategies 至少 1 项" });
  }
  if (!policy.fallbackModel) {
    issues.push({ field: "fallbackModel", message: "fallbackModel 必填" });
  } else if (policy.capability && !MODEL_CATALOG.some((m) => m.name === policy.fallbackModel && (m.capabilities as ModelCapability[]).includes(policy.capability as ModelCapability))) {
    issues.push({ field: "fallbackModel", message: `fallbackModel ${policy.fallbackModel} 不支持 capability=${policy.capability}` });
  }
  if (typeof policy.enabled !== "boolean") normalized.enabled = true;
  normalized.builtIn = policy.builtIn ?? false;
  return { valid: issues.length === 0, issues, normalized: issues.length === 0 ? normalized : null };
}
