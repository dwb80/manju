/**
 * @file route-policy-service.ts
 * @description V2 W11 ROUTE-F01~F05 路由策略服务:CRUD + pickModel + 决策日志
 *
 * 设计要点：
 *  - 单例: getRoutePolicyService() / createRoutePolicyService(databaseFile)
 *  - 内置策略(BUILTIN_POLICIES)在服务启动时自动注入,不可删除,只可禁用
 *  - 决策日志走 route_decision_logs 表(与 route_policies 同库)
 *  - pickModel() 走 pickModelByPolicy() + 写决策日志
 */

import { randomUUID } from "node:crypto";
import { SqliteRepository } from "../../storage/sqlite.js";
import {
  BUILTIN_POLICIES,
  pickModelByPolicy,
  validateRoutePolicy,
  type RouteCapability,
  type RouteDecision,
  type RouteDecisionLog,
  type RouteInput,
  type RoutePickResult,
  type RoutePolicy,
  routeDecisionLogFields,
  routePolicyFields,
} from "../../types/route-policies.js";
import { getModelsForCapability } from "../../types/model-capabilities.js";
import { isProviderAvailable } from "./provider-rate-limit-service.js";

export interface RoutePolicyService {
  // CRUD
  listPolicies(filter?: { capability?: RouteCapability; enabled?: boolean }): Promise<RoutePolicy[]>;
  getPolicy(id: string): Promise<RoutePolicy | null>;
  createPolicy(input: Omit<RoutePolicy, "id" | "created_at" | "updated_at" | "builtIn"> & { id?: string }): Promise<RoutePolicy>;
  updatePolicy(id: string, patch: Partial<RoutePolicy>): Promise<RoutePolicy>;
  deletePolicy(id: string): Promise<boolean>;
  setEnabled(id: string, enabled: boolean): Promise<RoutePolicy>;
  // 决策 + 日志
  pickModel(policyId: string, input: RouteInput): Promise<RouteDecision>;
  pickModelByCapability(capability: RouteCapability, input: RouteInput): Promise<RouteDecision>;
  // 日志查询
  listDecisionLogs(filter: { policyId?: string; projectId?: string; runId?: string; limit?: number }): Promise<RouteDecisionLog[]>;
  countDecisionLogs(filter: { policyId?: string; projectId?: string }): Promise<number>;
  // 校验
  validatePolicy(policy: Partial<RoutePolicy>): ReturnType<typeof validateRoutePolicy>;
  // 健康
  healthCheck(): Promise<{ ok: boolean; policyCount: number; logCount: number; builtins: number }>;
}

export function createRoutePolicyService(databaseFile: string): RoutePolicyService {
  const policyRepo = new SqliteRepository<RoutePolicy>(databaseFile, "route_policies", routePolicyFields);
  const logRepo = new SqliteRepository<RouteDecisionLog>(databaseFile, "route_decision_logs", routeDecisionLogFields);

  // 异步启动注入内置策略
  void (async () => {
    try {
      const existing = await policyRepo.findMany({});
      const existingIds = new Set(existing.map((p: RoutePolicy) => p.id));
      for (const bp of BUILTIN_POLICIES) {
        if (!existingIds.has(bp.id)) {
          await policyRepo.insert(bp);
        }
      }
    } catch { /* noop */ }
  })();

  function genId(prefix: string): string {
    return `${prefix}-${randomUUID().slice(0, 8)}`;
  }

  function nowIso(): string {
    return new Date().toISOString();
  }

  async function listPolicies(filter?: { capability?: RouteCapability; enabled?: boolean }): Promise<RoutePolicy[]> {
    let list: RoutePolicy[] = [];
    try { list = await policyRepo.findMany({}); } catch { return []; }
    if (filter?.capability) list = list.filter((p) => p.capability === filter.capability);
    if (filter?.enabled !== undefined) list = list.filter((p) => p.enabled === filter.enabled);
    return list;
  }

  async function getPolicy(id: string): Promise<RoutePolicy | null> {
    try { return await policyRepo.findById(id); } catch { return null; }
  }

  async function createPolicy(input: Omit<RoutePolicy, "id" | "created_at" | "updated_at" | "builtIn"> & { id?: string }): Promise<RoutePolicy> {
    const id = input.id ?? genId("pol");
    const full: RoutePolicy = {
      ...input,
      id,
      builtIn: false,
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    const v = validateRoutePolicy(full);
    if (!v.valid) {
      throw new Error(`route_policy_invalid: ${v.issues.map((i) => `${i.field}=${i.message}`).join("; ")}`);
    }
    try { await policyRepo.insert(full); } catch (e) { throw e; }
    return full;
  }

  async function updatePolicy(id: string, patch: Partial<RoutePolicy>): Promise<RoutePolicy> {
    const existing = await policyRepo.findById(id);
    if (!existing) throw new Error(`route_policy_not_found: ${id}`);
    if (existing.builtIn && patch.id && patch.id !== id) {
      throw new Error(`route_policy_builtin_immutable: id=${id}`);
    }
    const merged: RoutePolicy = { ...existing, ...patch, id, updated_at: nowIso() };
    const v = validateRoutePolicy(merged);
    if (!v.valid) {
      throw new Error(`route_policy_invalid: ${v.issues.map((i) => `${i.field}=${i.message}`).join("; ")}`);
    }
    await policyRepo.update(id, patch);
    return merged;
  }

  async function deletePolicy(id: string): Promise<boolean> {
    const p = await policyRepo.findById(id);
    if (!p) return false;
    if (p.builtIn) throw new Error(`route_policy_builtin_immutable: id=${id}`);
    await policyRepo.delete(id);
    return true;
  }

  async function setEnabled(id: string, enabled: boolean): Promise<RoutePolicy> {
    return await updatePolicy(id, { enabled });
  }

  async function writeLog(log: RouteDecisionLog): Promise<void> {
    try { await logRepo.insert(log); } catch { /* noop */ }
  }

  async function pickModel(policyId: string, input: RouteInput): Promise<RouteDecision> {
    const policy = await policyRepo.findById(policyId);
    if (!policy) throw new Error(`route_policy_not_found: ${policyId}`);
    if (!policy.enabled) throw new Error(`route_policy_disabled: ${policyId}`);
    return await runDecision(policy, input);
  }

  async function pickModelByCapability(capability: RouteCapability, input: RouteInput): Promise<RouteDecision> {
    let policy: RoutePolicy | null = null;
    if (input.pinnedModel) {
      const enableds = await listPolicies({ capability, enabled: true });
      policy = enableds.find((p) =>
        p.strategies.some((s) => s.kind === "manual" && s.options?.pinnedModel === input.pinnedModel)
      ) ?? null;
    }
    if (!policy) {
      const enableds = await listPolicies({ capability, enabled: true });
      policy = enableds[0] ?? null;
    }
    if (!policy) {
      throw new Error(`route_policy_no_default: capability=${capability}`);
    }
    return await runDecision(policy, input);
  }

  async function runDecision(policy: RoutePolicy, input: RouteInput): Promise<RouteDecision> {
    const t0 = Date.now();
    const availableModels = getModelsForCapability(policy.capability)
      .filter((model) => isProviderAvailable(model.provider))
      .map((model) => model.name);
    if (availableModels.length === 0) throw new Error(`route_provider_rate_limited: capability=${policy.capability}`);
    const requested = input.candidates?.length ? input.candidates : availableModels;
    const filtered = requested.filter((name) => availableModels.includes(name));
    const result: RoutePickResult = pickModelByPolicy(policy, { ...input, candidates: filtered.length ? filtered : availableModels });
    const decidedAt = nowIso();
    const decision: RouteDecision = {
      policyId: policy.id,
      policyName: policy.name,
      capability: policy.capability,
      chosenModel: result.chosenModel,
      matchedStrategies: result.matchedStrategies,
      candidates: result.candidates,
      reason: result.reasons,
      usedFallback: result.usedFallback,
      durationMs: Date.now() - t0,
      decidedAt,
      context: input.context,
    };
    const log: RouteDecisionLog = {
      id: genId("rdl"),
      policyId: decision.policyId,
      policyName: decision.policyName,
      capability: decision.capability,
      chosenModel: decision.chosenModel,
      matchedStrategies: decision.matchedStrategies,
      candidates: decision.candidates as unknown as string[],
      reason: decision.reason,
      usedFallback: decision.usedFallback,
      durationMs: decision.durationMs,
      projectId: decision.context?.projectId,
      runId: decision.context?.runId,
      nodeId: decision.context?.nodeId,
      userId: decision.context?.userId,
      requestId: decision.context?.requestId,
      decidedAt: decision.decidedAt,
      created_at: nowIso(),
    };
    await writeLog(log);
    return decision;
  }

  async function listDecisionLogs(filter: { policyId?: string; projectId?: string; runId?: string; limit?: number }): Promise<RouteDecisionLog[]> {
    let list: RouteDecisionLog[] = [];
    try { list = await logRepo.findMany({}); } catch { return []; }
    if (filter.policyId) list = list.filter((l) => l.policyId === filter.policyId);
    if (filter.projectId) list = list.filter((l) => l.projectId === filter.projectId);
    if (filter.runId) list = list.filter((l) => l.runId === filter.runId);
    list.sort((a, b) => b.decidedAt.localeCompare(a.decidedAt));
    if (filter.limit) list = list.slice(0, filter.limit);
    return list;
  }

  async function countDecisionLogs(filter: { policyId?: string; projectId?: string }): Promise<number> {
    const list = await listDecisionLogs({ ...filter, limit: undefined });
    return list.length;
  }

  async function healthCheck(): Promise<{ ok: boolean; policyCount: number; logCount: number; builtins: number }> {
    const policies = await listPolicies();
    return {
      ok: true,
      policyCount: policies.length,
      logCount: await countDecisionLogs({}),
      builtins: policies.filter((p) => p.builtIn).length,
    };
  }

  return {
    listPolicies,
    getPolicy,
    createPolicy,
    updatePolicy,
    deletePolicy,
    setEnabled,
    pickModel,
    pickModelByCapability,
    listDecisionLogs,
    countDecisionLogs,
    validatePolicy: validateRoutePolicy,
    healthCheck,
  };
}

let _singleton: RoutePolicyService | null = null;
export function getRoutePolicyService(databaseFile?: string): RoutePolicyService {
  if (!_singleton) {
    if (!databaseFile) throw new Error("route_policy_service_database_file_required");
    _singleton = createRoutePolicyService(databaseFile);
  }
  return _singleton;
}

export function _resetRoutePolicyService(): void {
  _singleton = null;
}
