import type { IncomingMessage, ServerResponse } from "node:http";
import type { AppContext } from "../services/app.js";
import { rootLogger } from "../logger.js";

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

/** 判断阶段是否可以启动（所有依赖已完成或跳过） */
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

/** 获取当前可运行的阶段列表 */
export function getRunnableStages(
  stageStates: Record<PipelineStageName, StageState>
): PipelineStageName[] {
  return STAGE_DEFINITIONS.filter(
    (s) => stageStates[s.name] === "waiting" && canStartStage(s.name, stageStates)
  ).map((s) => s.name);
}

/** 计算整体进度百分比 */
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
 * 基于项目现有资产推断流水线阶段状态
 * 不新增数据库表，利用已有仓储数据
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
    rootLogger.warn({ event: "pipeline.infer.error", projectId, error: (err as Error).message });
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

function sendJson<T>(res: ServerResponse, data: T, status = 200): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ code: 0, message: "ok", data }));
}

function sendError(res: ServerResponse, error: unknown, status = 400): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ code: errorCodeForStatus(status), message: (error as Error).message ?? "error", data: null }));
}

function errorCodeForStatus(status: number): number {
  if (status === 400) return 1002;
  if (status === 401 || status === 403) return 1003;
  if (status === 404) return 1004;
  if (status >= 500) return 1005;
  return 1001;
}

/**
 * 处理流水线相关的HTTP请求
 */
export async function handlePipelineRouter(
  ctx: AppContext,
  req: IncomingMessage,
  res: ServerResponse
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

    sendError(res, new Error("not found"), 404);
  } catch (err) {
    rootLogger.error({ event: "pipeline.router.error", error: (err as Error).message });
    sendError(res, err, 500);
  }
}
