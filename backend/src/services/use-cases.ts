/**
 * @file use-cases.ts
 * @description REM-P1-007：Use Case 端口（应用层"垂直切片"）。
 *
 * ## 设计目标（V2 架构治理 P1-007）
 *  HTTP 路由（routers）应只依赖"Use Case 接口"，而不是完整的 `AppContext`。
 *  - routers 拿到的 useCases 是 面向当前请求的、有名字的、强类型方法集合
 *  - 不允许 routers 直接 ctx.repositories.insert/update/delete（架构门禁已禁）
 *  - 也不允许 routers ctx.repositories.findMany/findById 读穿透（因为读也属于仓储层，
 *    不应该从 router 直接调；统一收敛到 use case 即可观测/可 mock/可降级）
 *  - AppContext 仍然保留"全端口"，方便服务间互相调用（service-to-service）
 *  - 业务方法在 use case 内部可以跨多个 service/repo 编排
 *
 * ## 用法（router.ts）
 *   const useCases = createUseCases(ctx);
 *   handlePipelineRouter(useCases.pipeline, ...);
 *   handleQualityRouter(useCases.quality, ...);
 *   handleFinalVideosRouter(useCases.finalVideo, ...);
 */
import type { AppContext } from "./app.js";
import type { PipelineEvent, PipelineEventType } from "../types/pipeline.js";
import type { MaybeAutoTriggerResult } from "./module-domain/quality-detection-service.js";
import {
  registerFinalVideo,
  transitionFinalVideo,
  recordFinalVideoDownload,
  updateFinalVideoTags,
  resolveFinalVideoDiskPath,
} from "./module-domain/final-video-service.js";
import { maybeAutoTriggerQualityCheck } from "./module-domain/quality-detection-service.js";
import {
  saveQualityAutoConfig,
  removeQualityAutoConfig,
} from "./module-domain/quality-command-service.js";

/* =============== Pipeline 端口 =============== */
export interface PipelineUseCases {
  createRun(input: {
    projectId: string;
    name: string;
    nodes: unknown[];
    dependencies: unknown[];
  }): Promise<{ runId: string; valid: boolean; errors?: unknown[] }>;
  startRun(runId: string): Promise<void>;
  pauseRun(runId: string): Promise<void>;
  resumeRun(runId: string): Promise<void>;
  pauseNode(runId: string, nodeId: string): Promise<void>;
  resumeNode(runId: string, nodeId: string): Promise<void>;
  skipNode(runId: string, nodeId: string): Promise<void>;
  retryNode(runId: string, nodeId: string): Promise<void>;
  batchNodeAction(
    runId: string,
    nodeIds: string[],
    action: "pause" | "resume" | "skip" | "retry",
  ): Promise<{
    runId: string;
    action: "pause" | "resume" | "skip" | "retry";
    total: number;
    succeeded: string[];
    failed: Array<{ nodeId: string; error: string }>;
  }>;
  setNodePriority(
    runId: string,
    nodeId: string,
    priority: number | "low" | "normal" | "high" | "urgent",
  ): Promise<void>;
  batchCreateNodes(
    runId: string,
    nodes: unknown[],
  ): Promise<{ runId: string; added: string[]; failed: Array<{ index: number; error: string }> }>;
  getRun(runId: string): Promise<unknown | null>;
  listRuns(projectId?: string): Promise<unknown[]>;
  getRunNodes(runId: string): Promise<unknown[]>;
  detectStaleRunningNodes(options?: { graceSeconds?: number }): Promise<{
    cleanedNodeIds: string[];
    cleanedRunIds: string[];
  }>;
  listNodeEvents(
    nodeId: string,
    options?: { limit?: number; type?: PipelineEventType },
  ): Promise<PipelineEvent[]>;
  recordEvent(input: {
    runId: string;
    nodeId: string;
    projectId: string;
    type: PipelineEventType;
    payload: Record<string, unknown>;
  }): Promise<PipelineEvent | null>;
  waitForIdle(): Promise<void>;
}

/* =============== Quality 端口 =============== */
export interface QualityUseCases {
  /** 节点完成前的自动门禁 */
  autoDetect(input: {
    runId: string;
    nodeId: string;
    projectId: string;
    nodeType: string;
    output: Record<string, unknown>;
  }): Promise<MaybeAutoTriggerResult>;
  listReports(input: {
    projectId: string;
    targetId?: string;
    status?: string;
    limit?: number;
  }): Promise<unknown[]>;
  getReport(reportId: string): Promise<unknown | null>;
  /** 配置相关 */
  listAutoConfigs(projectId: string): Promise<unknown[]>;
  saveAutoConfig(input: {
    projectId: string;
    enabled: boolean;
    targetTypes: string[];
    threshold: number;
    onFailure: "log" | "review" | "block";
  }): Promise<unknown>;
  removeAutoConfig(projectId: string): Promise<boolean>;
}

/* =============== FinalVideo 端口 =============== */
export interface FinalVideoUseCases {
  register(input: Parameters<typeof registerFinalVideo>[1]): ReturnType<typeof registerFinalVideo>;
  transition(
    id: string,
    targetStatus: "pending" | "rendering" | "ready" | "archived" | "failed",
    error?: string,
  ): ReturnType<typeof transitionFinalVideo>;
  recordDownload(
    video: Parameters<typeof recordFinalVideoDownload>[1],
  ): ReturnType<typeof recordFinalVideoDownload>;
  updateTags(
    id: string,
    tags: string[],
  ): ReturnType<typeof updateFinalVideoTags>;
  /** 只读访问，限定为方法包装，不暴露 raw Repository */
  getById(id: string): Promise<unknown | null>;
  listByProject(input: {
    projectId: string;
    status?: string;
    limit?: number;
  }): Promise<unknown[]>;
  resolveDiskPath(id: string): Promise<{
    found: boolean;
    absPath?: string;
    contentType?: string;
    isLocal?: boolean;
  }>;
  /** 内部服务凭证触发的"服务端回填"写；非 admin */
  internalCallbackFromService(input: {
    id: string;
    videoUrl: string;
    duration?: number;
    sizeBytes?: number;
    provider: string;
    serviceToken: string;
  }): Promise<unknown>;
}

/* =============== 顶层 UseCase 聚合 =============== */
export interface AppUseCases {
  pipeline: PipelineUseCases;
  quality: QualityUseCases;
  finalVideo: FinalVideoUseCases;
  /** 内部服务凭证校验（REM-P1-010） */
  internal: {
    isInternalServiceToken(token: string | undefined | null): boolean;
  };
}

export function createUseCases(ctx: AppContext): AppUseCases {
  const pipeline: PipelineUseCases = {
    createRun: (input) =>
      ctx.pipelineRunService.createRun(
        input.projectId,
        input.name,
        input.nodes,
        input.dependencies,
      ),
    startRun: (runId) => ctx.pipelineRunService.startRun(runId),
    pauseRun: (runId) => ctx.pipelineRunService.pauseRun(runId),
    resumeRun: (runId) => ctx.pipelineRunService.resumeRun(runId),
    pauseNode: (runId, nodeId) => ctx.pipelineRunService.pauseNode(runId, nodeId),
    resumeNode: (runId, nodeId) => ctx.pipelineRunService.resumeNode(runId, nodeId),
    skipNode: (runId, nodeId) => ctx.pipelineRunService.skipNode(runId, nodeId),
    retryNode: (runId, nodeId) => ctx.pipelineRunService.retryNode(runId, nodeId),
    batchNodeAction: (runId, nodeIds, action) =>
      ctx.pipelineRunService.batchNodeAction(runId, nodeIds, action),
    setNodePriority: (runId, nodeId, priority) =>
      ctx.pipelineRunService.setNodePriority(runId, nodeId, priority),
    batchCreateNodes: (runId, nodes) => ctx.pipelineRunService.batchCreateNodes(runId, nodes),
    getRun: (runId) => ctx.pipelineRunService.getRun(runId),
    listRuns: (projectId) => ctx.pipelineRunService.listRuns(projectId),
    getRunNodes: (runId) => ctx.pipelineRunService.getRunNodes(runId),
    detectStaleRunningNodes: (options) => ctx.pipelineRunService.detectStaleRunningNodes(options),
    listNodeEvents: (nodeId, options) => ctx.pipelineRunService.listNodeEvents(nodeId, options),
    recordEvent: (input) => ctx.pipelineRunService.recordEvent(input),
    waitForIdle: () => ctx.pipelineRunService.waitForIdle(),
  };

  const quality: QualityUseCases = {
    autoDetect: (input) =>
      maybeAutoTriggerQualityCheck(ctx, {
        runId: input.runId,
        nodeId: input.nodeId,
        projectId: input.projectId,
        nodeType: input.nodeType,
        output: input.output,
      }),
    listReports: async (input) => {
      const filters: any = { project_id: input.projectId };
      if (input.targetId) filters.target_id = input.targetId;
      if (input.status) filters.status = input.status;
      const items = await ctx.qualityReports.findMany(filters);
      return typeof input.limit === "number" ? items.slice(0, input.limit) : items;
    },
    getReport: async (reportId) => {
      const item = await ctx.qualityReports.findById(reportId);
      return item ?? null;
    },
    listAutoConfigs: async (projectId) => {
      const items = await ctx.qualityAutoConfigs.findMany({ project_id: projectId } as any);
      return items;
    },
    saveAutoConfig: (input) =>
      saveQualityAutoConfig(ctx, {
        projectId: input.projectId,
        enabled: input.enabled,
        targetTypes: input.targetTypes as any,
        threshold: input.threshold,
        onFailure: input.onFailure,
      }),
    removeAutoConfig: (projectId) => removeQualityAutoConfig(ctx, projectId),
  };

  const finalVideo: FinalVideoUseCases = {
    register: (input) => registerFinalVideo(ctx, input),
    transition: (id, targetStatus, error) => transitionFinalVideo(ctx, id, targetStatus, error ?? ""),
    recordDownload: (video) => recordFinalVideoDownload(ctx, video),
    updateTags: (id, tags) => updateFinalVideoTags(ctx, id, tags),
    getById: async (id) => {
      const item = await ctx.finalVideoVersions.findById(id);
      return item ?? null;
    },
    listByProject: async ({ projectId, status, limit }) => {
      const filters: any = { project_id: projectId };
      if (status) filters.status = status;
      const items = await ctx.finalVideoVersions.findMany(filters);
      const result = Array.isArray(items) ? items : [];
      return typeof limit === "number" ? result.slice(0, limit) : result;
    },
    resolveDiskPath: async (id) => {
      const item = await ctx.finalVideoVersions.findById(id);
      if (!item) return { found: false };
      const abs = resolveFinalVideoDiskPath(ctx.root, String(item.video_url ?? ""));
      return { found: true, absPath: abs ?? undefined, isLocal: true, contentType: "video/mp4" };
    },
    internalCallbackFromService: async (input) => {
      // 内部服务凭证触发的成片注册：先尝试找现有记录并切到 ready，否则注册新记录
      const existing = await ctx.finalVideoVersions.findById(input.id);
      if (existing) {
        return transitionFinalVideo(ctx, input.id, "ready");
      }
      // 内部服务凭证下，projectId/runId 必须从请求上下文补齐；当前实现先返回 409 让
      // 渲染服务方改用 registerFinalVideo 路径（项目 ID 与 run ID 由调用方提供）。
      throw new Error("internal_callback_requires_existing_record: 项目内调用请直接用 POST /api/final-videos");
    },
  };

  return {
    pipeline,
    quality,
    finalVideo,
    internal: {
      isInternalServiceToken: (token) => ctx.internalAuth.isInternalServiceToken(token),
    },
  };
}
