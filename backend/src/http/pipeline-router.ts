/**
 * @file pipeline-router.ts
 * @description 流水线路由模块
 *
 * 提供 8 阶段工作流的状态管理和查询能力：
 * - 阶段定义和依赖关系（DAG）
 * - 状态机转换规则
 * - 项目流水线状态推断
 * - 整体进度计算
 * - 节点启停控制（V2 W5 REQ-PIPE-001-06：listNodes/pause/resume/skip）
 *
 * 8 个阶段：剧本 → 分镜 → 角色 → 场景 → 图片 → 视频 → 剪辑 → 发布
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AppContext } from "../services/app.js";
import { rootLogger } from "../logger.js";
import { hasPermission, getMemberByUserId } from "../services/horizontal/project-member-service.js";
import { readJsonBody } from "./http-utils.js";

/** 节点操作所需的访问上下文（由主路由注入）。 */
export interface PipelineAccess {
  userId: string;
  isAdmin: boolean;
  canAccessProject(projectId: string): Promise<boolean>;
}

/** 8阶段工作流阶段名称 */
export type PipelineStageName =
  | "script"
  | "storyboard"
  | "character"
  | "scene"
  | "image"
  | "video"
  | "clip"
  | "publish";

/** 阶段状态 */
export type StageState = "waiting" | "running" | "completed" | "failed" | "skipped";

/** 阶段定义 */
export interface StageDef {
  name: PipelineStageName;
  label: string;
  color: string;
  dependsOn: PipelineStageName[];
}

/** 8阶段定义（依赖关系构成DAG） */
export const STAGE_DEFINITIONS: StageDef[] = [
  { name: "script", label: "剧本", color: "emerald", dependsOn: [] },
  { name: "storyboard", label: "分镜", color: "blue", dependsOn: ["script"] },
  { name: "character", label: "角色", color: "cyan", dependsOn: ["storyboard"] },
  { name: "scene", label: "场景", color: "teal", dependsOn: ["storyboard"] },
  { name: "image", label: "图片", color: "purple", dependsOn: ["character", "scene"] },
  { name: "video", label: "视频", color: "orange", dependsOn: ["image"] },
  { name: "clip", label: "剪辑", color: "pink", dependsOn: ["video"] },
  { name: "publish", label: "发布", color: "amber", dependsOn: ["clip"] },
];

/** 状态机转换规则 */
export const STAGE_TRANSITIONS: Record<StageState, StageState[]> = {
  waiting: ["running", "skipped"],
  running: ["completed", "failed"],
  completed: [],
  failed: ["running"],
  skipped: ["running"],
};

/**
 * canStartStage - 判断阶段是否可以启动
 * @param {PipelineStageName} stageName - 阶段名称
 * @param {Record<PipelineStageName, StageState>} stageStates - 各阶段状态
 * @returns {boolean} 是否可以启动
 * @description 所有依赖已完成或跳过时才可启动
 */
export function canStartStage(
  stageName: PipelineStageName,
  stageStates: Record<PipelineStageName, StageState>
): boolean {
  const stage = STAGE_DEFINITIONS.find((s) => s.name === stageName);
  if (!stage) return false;
  return stage.dependsOn.every(
    (dep) => stageStates[dep] === "completed" || stageStates[dep] === "skipped"
  );
}

/**
 * getRunnableStages - 获取当前可运行的阶段列表
 * @param {Record<PipelineStageName, StageState>} stageStates - 各阶段状态
 * @returns {PipelineStageName[]} 可运行的阶段名称列表
 */
export function getRunnableStages(
  stageStates: Record<PipelineStageName, StageState>
): PipelineStageName[] {
  return STAGE_DEFINITIONS.filter(
    (s) => stageStates[s.name] === "waiting" && canStartStage(s.name, stageStates)
  ).map((s) => s.name);
}

/**
 * calculateOverallProgress - 计算整体进度百分比
 * @param {Record<PipelineStageName, StageState>} stageStates - 各阶段状态
 * @returns {number} 进度百分比（0-100）
 */
export function calculateOverallProgress(
  stageStates: Record<PipelineStageName, StageState>
): number {
  const total = STAGE_DEFINITIONS.length;
  const completed = STAGE_DEFINITIONS.filter(
    (s) => stageStates[s.name] === "completed" || stageStates[s.name] === "skipped"
  ).length;
  return Math.round((completed / total) * 100);
}

/**
 * inferPipelineState - 基于项目现有资产推断流水线阶段状态
 * @param {AppContext} ctx - 应用上下文
 * @param {string} projectId - 项目ID
 * @returns {Promise<Record<PipelineStageName, StageState>>} 各阶段状态映射
 * @description 不新增数据库表，利用已有仓储数据推断
 */
export async function inferPipelineState(
  ctx: AppContext,
  projectId: string
): Promise<Record<PipelineStageName, StageState>> {
  const state: Record<PipelineStageName, StageState> = {
    script: "waiting",
    storyboard: "waiting",
    character: "waiting",
    scene: "waiting",
    image: "waiting",
    video: "waiting",
    clip: "waiting",
    publish: "waiting",
  };

  try {
    // 剧本：有 projectScripts 则 completed
    const scripts = await ctx.projectScripts.findMany({ project_id: projectId } as Partial<unknown>);
    if (scripts.length > 0) state.script = "completed";

    // 分镜：有 projectStoryboards 则 completed
    const storyboards = await ctx.projectStoryboards.findMany({ project_id: projectId } as Partial<unknown>);
    if (storyboards.length > 0) state.storyboard = "completed";

    // 角色：有 characters（项目维度）则 completed
    const characters = await ctx.characters.findMany({ project_id: projectId } as Partial<unknown>);
    if (characters.length > 0) state.character = "completed";

    // 场景：有 scenes（项目维度）则 completed
    const scenes = await ctx.scenes.findMany({ project_id: projectId } as Partial<unknown>);
    if (scenes.length > 0) state.scene = "completed";

    // 图片：有 images（通过会话关联）则 completed
    const conversations = await ctx.conversations.findMany({ project_id: projectId } as Partial<unknown>);
    const conversationIds = new Set(conversations.map((c) => c.id));
    const allImages = await ctx.images.findMany({ status: "success" } as Partial<unknown>);
    const projectImages = allImages.filter((img) => conversationIds.has(img.conversation_id));
    if (projectImages.length > 0) state.image = "completed";

    // 视频：有 videos（通过会话关联）则 completed
    const allVideos = await ctx.videos.findMany({ status: "success" } as Partial<unknown>);
    const projectVideos = allVideos.filter((v) => conversationIds.has(v.conversation_id));
    if (projectVideos.length > 0) state.video = "completed";

    // 剪辑：有 projectClips 则 completed
    const clips = await ctx.projectClips.findMany({ project_id: projectId } as Partial<unknown>);
    if (clips.length > 0) state.clip = "completed";

    // 发布：有 publishPlans 且状态为 published 则 completed
    const plans = await ctx.publishPlans.findMany({});
    const publishedPlans = plans.filter(
      (p) => p.videos.some((vid) => allVideos.some((v) => v.id === vid)) && p.status === "published"
    );
    if (publishedPlans.length > 0) state.publish = "completed";
  } catch (err) {
    rootLogger.warn({ event: "pipeline.infer.error", projectId, error: (err as Error).message }, `流水线状态推断失败：${(err as Error).message}`);
  }

  // 根据依赖关系推导 waiting → running
  for (const stage of STAGE_DEFINITIONS) {
    if (state[stage.name] === "waiting" && canStartStage(stage.name, state)) {
      // 如果该阶段有资产但未完成，标记为 running（简化策略）
      // 这里保持 waiting，由前端或用户操作触发 running
    }
  }

  return state;
}

/**
 * sendJson - 发送统一格式的成功 JSON 响应
 * @param {ServerResponse} res - HTTP 响应对象
 * @param {T} data - 响应数据
 * @param {number} status - HTTP 状态码，默认 200
 * @returns {void}
 */
function sendJson<T>(res: ServerResponse, data: T, status = 200): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ code: 0, message: "ok", data }));
}

/**
 * sendError - 发送统一格式的错误 JSON 响应
 * @param {ServerResponse} res - HTTP 响应对象
 * @param {unknown} error - 错误对象
 * @param {number} status - HTTP 状态码，默认 400
 * @returns {void}
 */
function sendError(res: ServerResponse, error: unknown, status = 400): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ code: errorCodeForStatus(status), message: (error as Error).message ?? "error", data: null }));
}

/**
 * errorCodeForStatus - 将 HTTP 状态码映射到业务错误码
 * @param {number} status - HTTP 状态码
 * @returns {number} 业务错误码
 */
function errorCodeForStatus(status: number): number {
  if (status === 400) return 1002;
  if (status === 401 || status === 403) return 1003;
  if (status === 404) return 1004;
  if (status >= 500) return 1005;
  return 1001;
}

/**
 * handlePipelineRouter - 处理流水线相关的 HTTP 请求
 * @param {AppContext} ctx - 应用上下文
 * @param {IncomingMessage} req - HTTP 请求对象
 * @param {ServerResponse} res - HTTP 响应对象
 * @param {PipelineAccess} [access] - 访问上下文（节点操作路由必传；仅 stages/state 查询可不传）
 * @returns {Promise<void>}
 */
export async function handlePipelineRouter(
  ctx: AppContext,
  req: IncomingMessage,
  res: ServerResponse,
  access?: PipelineAccess,
): Promise<void> {
  const method = req.method ?? "GET";
  const url = new URL(req.url ?? "/", "http://localhost");
  const pathname = url.pathname;
  const parts = pathname.split("/").filter(Boolean);

  try {
    // GET /api/pipeline/stages - 获取8阶段定义和状态机规则
    if (method === "GET" && pathname === "/api/pipeline/stages") {
      sendJson(res, {
        stages: STAGE_DEFINITIONS,
        transitions: STAGE_TRANSITIONS,
      });
      return;
    }

    // GET /api/pipeline/:projectId/state - 获取某项目的流水线状态
    if (method === "GET" && parts.length === 4 && parts[0] === "api" && parts[1] === "pipeline" && parts[3] === "state") {
      const projectId = decodeURIComponent(parts[2]);
      const stageStates = await inferPipelineState(ctx, projectId);
      const runnable = getRunnableStages(stageStates);
      const overallProgress = calculateOverallProgress(stageStates);
      sendJson(res, {
        projectId,
        stageStates,
        runnableStages: runnable,
        overallProgress,
      });
      return;
    }

    // ===== V2 W5 REQ-PIPE-001-06 节点启停开关 =====
    // GET /api/pipeline/runs/:runId/nodes  —— 列出 run 全部节点（前端节点面板用）
    if (
      method === "GET" &&
      parts.length === 5 &&
      parts[0] === "api" &&
      parts[1] === "pipeline" &&
      parts[2] === "runs" &&
      parts[4] === "nodes"
    ) {
      const runId = decodeURIComponent(parts[3]);
      const accessOk = await ensureNodeAccessByRunId(ctx, access, runId, res);
      if (!accessOk.ok) return;
      const nodes = (await ctx.pipelineNodes.findMany({ run_id: runId } as any)) as any[];
      const dependencies = (await ctx.pipelineDependencies.findMany({ run_id: runId } as any)) as any[];
      nodes.sort((a, b) => {
        const ai = a.created_at ?? "";
        const bi = b.created_at ?? "";
        return ai.localeCompare(bi);
      });
      sendJson(res, { runId, nodes, dependencies });
      return;
    }

    // V2 W11 TASK-F17: POST /api/pipeline/runs (创建 run + 节点 + 依赖)
    //   body = { projectId, name, nodes: [...], dependencies: [...] }
    if (
      method === "POST" &&
      parts.length === 3 &&
      parts[0] === "api" &&
      parts[1] === "pipeline" &&
      parts[2] === "runs"
    ) {
      const body = await readJsonBody(req);
      const projectId = String(body.projectId ?? body.project_id ?? "");
      const name = String(body.name ?? `run-${Date.now()}`);
      const nodes = Array.isArray(body.nodes) ? body.nodes : [];
      const dependencies = Array.isArray(body.dependencies) ? body.dependencies : [];
      if (!projectId) {
        sendError(res, new Error("projectId 必填"), 400);
        return;
      }
      if (nodes.length === 0) {
        sendError(res, new Error("nodes 必填：非空数组"), 400);
        return;
      }
      if (access && !access.isAdmin) {
        const allowed = await access.canAccessProject(projectId);
        if (!allowed) {
          sendError(res, new Error("forbidden: not project member"), 403);
          return;
        }
      }
      try {
        const result = await ctx.pipelineRunService.createRun(projectId, name, nodes, dependencies);
        if (!result.valid) {
          sendJson(res, { runId: result.runId, valid: false, errors: result.errors }, 400);
          return;
        }
        sendJson(res, { runId: result.runId, valid: true });
      } catch (svcErr) {
        sendError(res, svcErr, 400);
      }
      return;
    }

    // V2 W11 TASK-F11: POST /api/pipeline/runs/:runId/nodes/:nodeId/retry
    //   放在 pause/resume/skip 之前,因为旧 handler 的 action 白名单不含 retry,会被它先吃掉
    if (
      method === "POST" &&
      parts.length === 7 &&
      parts[0] === "api" &&
      parts[1] === "pipeline" &&
      parts[2] === "runs" &&
      parts[4] === "nodes" &&
      parts[6] === "retry"
    ) {
      const runId = decodeURIComponent(parts[3]);
      const nodeId = decodeURIComponent(parts[5]);
      const accessOk = await ensureNodeAccessByNodeId(ctx, access, runId, nodeId, res);
      if (!accessOk.ok) return;
      try {
        await ctx.pipelineRunService.retryNode(runId, nodeId);
      } catch (svcErr) {
        sendError(res, svcErr, 400);
        return;
      }
      const updated = await ctx.pipelineNodes.findById(nodeId);
      sendJson(res, { runId, nodeId, action: "retry", node: updated });
      return;
    }

    // POST /api/pipeline/runs/:runId/nodes/:nodeId/{pause|resume|skip}
    if (
      method === "POST" &&
      parts.length === 7 &&
      parts[0] === "api" &&
      parts[1] === "pipeline" &&
      parts[2] === "runs" &&
      parts[4] === "nodes"
    ) {
      const runId = decodeURIComponent(parts[3]);
      const nodeId = decodeURIComponent(parts[5]);
      const action = parts[6];
      if (!["pause", "resume", "skip"].includes(action)) {
        sendError(res, new Error("未知节点动作: " + action), 400);
        return;
      }
      const accessOk = await ensureNodeAccessByNodeId(ctx, access, runId, nodeId, res);
      if (!accessOk.ok) return;
      try {
        if (action === "pause") {
          await ctx.pipelineRunService.pauseNode(runId, nodeId);
        } else if (action === "resume") {
          await ctx.pipelineRunService.resumeNode(runId, nodeId);
        } else {
          await ctx.pipelineRunService.skipNode(runId, nodeId);
        }
      } catch (svcErr) {
        sendError(res, svcErr, 400);
        return;
      }
      const updated = await ctx.pipelineNodes.findById(nodeId);
      sendJson(res, { runId, nodeId, action, node: updated });
      return;
    }

    // V2 W11 TASK-F16: PATCH /api/pipeline/runs/:runId/nodes/:nodeId/priority
    //   body = { priority: "high" | 0-3 }
    if (
      method === "PATCH" &&
      parts.length === 7 &&
      parts[0] === "api" &&
      parts[1] === "pipeline" &&
      parts[2] === "runs" &&
      parts[4] === "nodes" &&
      parts[6] === "priority"
    ) {
      const runId = decodeURIComponent(parts[3]);
      const nodeId = decodeURIComponent(parts[5]);
      const accessOk = await ensureNodeAccessByNodeId(ctx, access, runId, nodeId, res);
      if (!accessOk.ok) return;
      const body = await readJsonBody(req);
      const priority = body.priority;
      if (priority === undefined || priority === null) {
        sendError(res, new Error("priority 必填（数字 0-3 或字符串 low/normal/high/urgent）"), 400);
        return;
      }
      try {
        await ctx.pipelineRunService.setNodePriority(runId, nodeId, priority as any);
      } catch (svcErr) {
        sendError(res, svcErr, 400);
        return;
      }
      const updated = await ctx.pipelineNodes.findById(nodeId);
      sendJson(res, { runId, nodeId, priority: (updated as any)?.priority, node: updated });
      return;
    }

    // V2 W11 TASK-F18: POST /api/pipeline/runs/:runId/nodes/batch
    //   body = { action: "pause"|"resume"|"skip"|"retry", nodeIds: string[] }
    //   parts = ["api","pipeline","runs",":runId","nodes","batch"]  length=6
    if (
      method === "POST" &&
      parts.length === 6 &&
      parts[0] === "api" &&
      parts[1] === "pipeline" &&
      parts[2] === "runs" &&
      parts[4] === "nodes" &&
      parts[5] === "batch"
    ) {
      const runId = decodeURIComponent(parts[3]);
      const accessOk = await ensureNodeAccessByRunId(ctx, access, runId, res);
      if (!accessOk.ok) return;
      const body = await readJsonBody(req);
      const action = String(body.action ?? "");
      const nodeIds = Array.isArray(body.nodeIds) ? body.nodeIds.map((x: any) => String(x)) : [];
      if (!["pause", "resume", "skip", "retry"].includes(action)) {
        sendError(res, new Error("action 必填：pause/resume/skip/retry"), 400);
        return;
      }
      if (nodeIds.length === 0) {
        sendError(res, new Error("nodeIds 必填：非空数组"), 400);
        return;
      }
      let result: any;
      try {
        result = await ctx.pipelineRunService.batchNodeAction(runId, nodeIds, action as any);
      } catch (svcErr) {
        sendError(res, svcErr, 400);
        return;
      }
      sendJson(res, result);
      return;
    }

    // V2 W11 TASK-F17: POST /api/pipeline/runs/:runId/nodes (批量追加)
    //   body = { nodes: Array<{ id?, type, name?, config?, input_data?, priority? }> }
    //   parts = ["api","pipeline","runs",":runId","nodes"]  length=5
    if (
      method === "POST" &&
      parts.length === 5 &&
      parts[0] === "api" &&
      parts[1] === "pipeline" &&
      parts[2] === "runs" &&
      parts[4] === "nodes"
    ) {
      const runId = decodeURIComponent(parts[3]);
      const accessOk = await ensureNodeAccessByRunId(ctx, access, runId, res);
      if (!accessOk.ok) return;
      const body = await readJsonBody(req);
      const nodes = Array.isArray(body.nodes) ? body.nodes : [];
      if (nodes.length === 0) {
        sendError(res, new Error("nodes 必填：非空数组"), 400);
        return;
      }
      let result: any;
      try {
        result = await ctx.pipelineRunService.batchCreateNodes(runId, nodes);
      } catch (svcErr) {
        sendError(res, svcErr, 400);
        return;
      }
      sendJson(res, result);
      return;
    }

    sendError(res, new Error("not found"), 404);
  } catch (err) {
    rootLogger.error({ event: "pipeline.router.error", error: (err as Error).message }, `流水线路由错误：${(err as Error).message}`);
    sendError(res, err, 500);
  }
}

/* ============================================================== */
/* V2 W5 REQ-PIPE-001-06 RBAC 辅助                                */
/* ============================================================== */
async function ensureNodeAccessByRunId(
  ctx: AppContext,
  access: PipelineAccess | undefined,
  runId: string,
  res: ServerResponse,
): Promise<{ ok: boolean; run?: any; projectId?: string }> {
  if (!access) {
    sendError(res, new Error("无权访问"), 401);
    return { ok: false };
  }
  const run = await ctx.pipelineRuns.findById(runId);
  if (!run) {
    sendError(res, new Error("run 不存在: " + runId), 404);
    return { ok: false };
  }
  const projectId = String(run.project_id ?? "");
  if (!(await ensureNodePermission(ctx, access, projectId, res))) return { ok: false };
  return { ok: true, run, projectId };
}

async function ensureNodeAccessByNodeId(
  ctx: AppContext,
  access: PipelineAccess | undefined,
  runId: string,
  nodeId: string,
  res: ServerResponse,
): Promise<{ ok: boolean; run?: any; node?: any; projectId?: string }> {
  if (!access) {
    sendError(res, new Error("无权访问"), 401);
    return { ok: false };
  }
  const run = await ctx.pipelineRuns.findById(runId);
  if (!run) {
    sendError(res, new Error("run 不存在: " + runId), 404);
    return { ok: false };
  }
  const node = await ctx.pipelineNodes.findById(nodeId);
  if (!node) {
    sendError(res, new Error("node 不存在: " + nodeId), 404);
    return { ok: false };
  }
  if (node.run_id !== runId) {
    sendError(res, new Error("node 不属于该 run"), 400);
    return { ok: false };
  }
  const projectId = String(run.project_id ?? "");
  if (!(await ensureNodePermission(ctx, access, projectId, res))) return { ok: false };
  return { ok: true, run, node, projectId };
}

async function ensureNodePermission(
  ctx: AppContext,
  access: PipelineAccess,
  projectId: string,
  res: ServerResponse,
): Promise<boolean> {
  if (access.isAdmin) return true;
  if (!projectId) {
    sendError(res, new Error("run 缺少 project_id"), 400);
    return false;
  }
  const accessible = await access.canAccessProject(projectId);
  if (!accessible) {
    sendError(res, new Error("无权访问该项目"), 403);
    return false;
  }
  const member = await getMemberByUserId(ctx, projectId, access.userId);
  if (!member) {
    sendError(res, new Error("非项目成员，无法操作节点"), 403);
    return false;
  }
  if (!hasPermission(member, "task.update_status")) {
    sendError(res, new Error("需要 editor 及以上权限"), 403);
    return false;
  }
  return true;
}
