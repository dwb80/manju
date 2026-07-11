import type { IncomingMessage, ServerResponse } from "node:http";
import type { AppContext } from "../services/app.js";
import type { ImageTask, VideoTask, TaskStatus } from "../types.js";

/** 统一的AI任务类型，合并ImageTask和VideoTask */
export type AITaskType = "image" | "video";

/** 统一的AI任务响应格式 */
export interface AITask {
  id: string;
  type: AITaskType;
  prompt: string;
  status: TaskStatus;
  projectId: string;
  conversationId: string;
  createdAt: string;
  updatedAt: string;
  duration: number | null;
  model: string;
  error: string;
  /** 图片任务特有字段 */
  imageUrls?: string[];
  /** 视频任务特有字段 */
  videoUrl?: string;
  progress?: number;
  seconds?: string;
  size?: string;
}

/** AI任务列表查询参数 */
export interface AITaskQueryParams {
  /** 搜索关键词，匹配prompt字段 */
  q?: string;
  /** 任务类型筛选 */
  type?: AITaskType;
  /** 任务状态筛选 */
  status?: TaskStatus;
  /** 项目ID筛选 */
  projectId?: string;
  /** 会话ID筛选 */
  conversationId?: string;
  /** 创建时间起始范围 */
  startTime?: string;
  /** 创建时间结束范围 */
  endTime?: string;
  /** 分页页码 */
  page?: number;
  /** 每页数量 */
  pageSize?: number;
}

/** AI任务列表响应格式 */
export interface AITaskListResponse {
  tasks: AITask[];
  total: number;
  page: number;
  pageSize: number;
}

/** 批量操作请求体 */
export interface BatchOperationRequest {
  taskIds: string[];
}

/** 批量操作响应格式 */
export interface BatchOperationResponse {
  success: string[];
  failed: Array<{ id: string; error: string }>;
}

/**
 * 将ImageTask转换为统一的AITask格式
 */
function convertImageTask(task: ImageTask, projectId: string): AITask {
  return {
    id: task.id,
    type: "image",
    prompt: task.prompt,
    status: task.status,
    projectId,
    conversationId: task.conversation_id,
    createdAt: task.created_at,
    updatedAt: task.created_at, // ImageTask没有updated_at字段，使用created_at
    duration: null, // 图片任务没有duration概念
    model: "agnes-image", // 图片生成模型
    error: task.error,
    imageUrls: task.image_urls,
  };
}

/**
 * 将VideoTask转换为统一的AITask格式
 */
function convertVideoTask(task: VideoTask, projectId: string): AITask {
  const duration = task.seconds ? parseFloat(task.seconds) : null;
  return {
    id: task.id,
    type: "video",
    prompt: task.prompt,
    status: task.status,
    projectId,
    conversationId: task.conversation_id,
    createdAt: task.created_at,
    updatedAt: task.created_at, // VideoTask没有updated_at字段，使用created_at
    duration,
    model: task.params.model || "agnes-video-v2.0",
    error: task.error,
    videoUrl: task.video_url,
    progress: task.progress,
    seconds: task.seconds,
    size: task.size,
  };
}

/**
 * 根据会话ID获取项目ID
 */
async function getProjectIdByConversationId(ctx: AppContext, conversationId: string): Promise<string> {
  if (!conversationId) return "";
  const conversation = await ctx.conversations.findById(conversationId);
  return conversation?.project_id ?? "";
}

/**
 * 获取所有AI任务列表
 * 支持跨项目、跨会话查询，支持搜索、筛选和分页
 */
export async function listAITasks(
  ctx: AppContext,
  params: AITaskQueryParams
): Promise<AITaskListResponse> {
  // 获取所有图片任务
  const imageTasks = await ctx.images.findMany({}, { sort: "desc" });
  // 获取所有视频任务
  const videoTasks = await ctx.videos.findMany({}, { sort: "desc" });
  // 获取所有会话信息，用于查找项目ID
  const conversations = await ctx.conversations.findMany({}, { sort: "asc" });

  // 转换任务格式
  const allTasks: AITask[] = [];

  // 处理图片任务
  for (const task of imageTasks) {
    const conversationId = task.conversation_id || findConversationIdByTime(task.created_at, conversations);
    const projectId = await getProjectIdByConversationId(ctx, conversationId);
    allTasks.push(convertImageTask(task, projectId));
  }

  // 处理视频任务
  for (const task of videoTasks) {
    const conversationId = task.conversation_id || findConversationIdByTime(task.created_at, conversations);
    const projectId = await getProjectIdByConversationId(ctx, conversationId);
    allTasks.push(convertVideoTask(task, projectId));
  }

  // 应用筛选条件
  let filteredTasks = allTasks;

  // 搜索筛选（匹配prompt）
  if (params.q && params.q.trim()) {
    const query = params.q.trim().toLowerCase();
    filteredTasks = filteredTasks.filter(task =>
      task.prompt.toLowerCase().includes(query)
    );
  }

  // 类型筛选
  if (params.type) {
    filteredTasks = filteredTasks.filter(task => task.type === params.type);
  }

  // 状态筛选
  if (params.status) {
    filteredTasks = filteredTasks.filter(task => task.status === params.status);
  }

  // 项目筛选
  if (params.projectId) {
    filteredTasks = filteredTasks.filter(task => task.projectId === params.projectId);
  }

  // 会话筛选
  if (params.conversationId) {
    filteredTasks = filteredTasks.filter(task => task.conversationId === params.conversationId);
  }

  // 时间范围筛选
  if (params.startTime) {
    const startTime = params.startTime;
    filteredTasks = filteredTasks.filter(task =>
      task.createdAt >= startTime
    );
  }
  if (params.endTime) {
    const endTime = params.endTime;
    filteredTasks = filteredTasks.filter(task =>
      task.createdAt <= endTime
    );
  }

  // 按创建时间排序（降序）
  filteredTasks.sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // 分页
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const total = filteredTasks.length;
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedTasks = filteredTasks.slice(startIndex, endIndex);

  return {
    tasks: paginatedTasks,
    total,
    page,
    pageSize,
  };
}

/**
 * 根据时间查找会话ID（处理旧数据）
 */
function findConversationIdByTime(createdAt: string, conversations: Array<{ id: string; created_at: string; updated_at: string }>): string {
  // 这是一个简化的实现，实际可能需要更复杂的逻辑
  return "";
}

/**
 * 获取单个AI任务详情
 */
export async function getAITaskById(ctx: AppContext, taskId: string): Promise<AITask | null> {
  // 尝试查找图片任务
  const imageTask = await ctx.images.findById(taskId);
  if (imageTask) {
    const conversationId = imageTask.conversation_id;
    const projectId = await getProjectIdByConversationId(ctx, conversationId);
    return convertImageTask(imageTask, projectId);
  }

  // 尝试查找视频任务
  const videoTask = await ctx.videos.findById(taskId);
  if (videoTask) {
    const conversationId = videoTask.conversation_id;
    const projectId = await getProjectIdByConversationId(ctx, conversationId);
    return convertVideoTask(videoTask, projectId);
  }

  return null;
}

/**
 * 批量取消任务
 * 注意：由于ImageTask和VideoTask没有"cancelled"状态，这里将任务标记为"failed"
 */
export async function cancelAITasks(
  ctx: AppContext,
  taskIds: string[]
): Promise<BatchOperationResponse> {
  const success: string[] = [];
  const failed: Array<{ id: string; error: string }> = [];

  for (const taskId of taskIds) {
    try {
      // 尝试查找并取消图片任务
      const imageTask = await ctx.images.findById(taskId);
      if (imageTask) {
        if (imageTask.status === "pending" || imageTask.status === "processing") {
          await ctx.images.update(taskId, {
            status: "failed" as TaskStatus,
            error: "任务已手动取消"
          } as Partial<ImageTask>);
          success.push(taskId);
        } else {
          failed.push({ id: taskId, error: "任务已完成或已失败，无法取消" });
        }
        continue;
      }

      // 尝试查找并取消视频任务
      const videoTask = await ctx.videos.findById(taskId);
      if (videoTask) {
        if (videoTask.status === "pending" || videoTask.status === "processing") {
          await ctx.videos.update(taskId, {
            status: "failed" as TaskStatus,
            error: "任务已手动取消"
          } as Partial<VideoTask>);
          success.push(taskId);
        } else {
          failed.push({ id: taskId, error: "任务已完成或已失败，无法取消" });
        }
        continue;
      }

      failed.push({ id: taskId, error: "任务不存在" });
    } catch (error) {
      failed.push({
        id: taskId,
        error: (error as Error).message ?? "取消失败"
      });
    }
  }

  return { success, failed };
}

/**
 * 批量重试失败任务
 * 注意：这个实现只是重置任务状态，实际重新生成需要前端重新发起请求
 */
export async function retryAITasks(
  ctx: AppContext,
  taskIds: string[]
): Promise<BatchOperationResponse> {
  const success: string[] = [];
  const failed: Array<{ id: string; error: string }> = [];

  for (const taskId of taskIds) {
    try {
      // 尝试查找并重试图片任务
      const imageTask = await ctx.images.findById(taskId);
      if (imageTask) {
        if (imageTask.status === "failed") {
          // 这里只是标记为pending，实际重新生成需要前端重新调用generateImage API
          await ctx.images.update(taskId, {
            status: "pending" as TaskStatus,
            error: ""
          } as Partial<ImageTask>);
          success.push(taskId);
        } else {
          failed.push({ id: taskId, error: "只有失败的任务可以重试" });
        }
        continue;
      }

      // 尝试查找并重试视频任务
      const videoTask = await ctx.videos.findById(taskId);
      if (videoTask) {
        if (videoTask.status === "failed") {
          // 这里只是标记为pending，实际重新生成需要前端重新调用generateVideo API
          await ctx.videos.update(taskId, {
            status: "pending" as TaskStatus,
            error: ""
          } as Partial<VideoTask>);
          success.push(taskId);
        } else {
          failed.push({ id: taskId, error: "只有失败的任务可以重试" });
        }
        continue;
      }

      failed.push({ id: taskId, error: "任务不存在" });
    } catch (error) {
      failed.push({
        id: taskId,
        error: (error as Error).message ?? "重试失败"
      });
    }
  }

  return { success, failed };
}

/**
 * 删除单个AI任务
 */
export async function deleteAITask(ctx: AppContext, taskId: string): Promise<boolean> {
  // 尝试删除图片任务
  const imageTask = await ctx.images.findById(taskId);
  if (imageTask) {
    await ctx.images.delete(taskId);
    return true;
  }

  // 尝试删除视频任务
  const videoTask = await ctx.videos.findById(taskId);
  if (videoTask) {
    await ctx.videos.delete(taskId);
    return true;
  }

  return false;
}

/**
 * 解析查询参数
 */
function parseQueryParams(req: IncomingMessage): AITaskQueryParams {
  const url = new URL(req.url ?? "/", "http://localhost");
  const searchParams = url.searchParams;

  return {
    q: searchParams.get("q") ?? undefined,
    type: (searchParams.get("type") as AITaskType) ?? undefined,
    status: (searchParams.get("status") as TaskStatus) ?? undefined,
    projectId: searchParams.get("projectId") ?? undefined,
    conversationId: searchParams.get("conversationId") ?? undefined,
    startTime: searchParams.get("startTime") ?? undefined,
    endTime: searchParams.get("endTime") ?? undefined,
    page: searchParams.get("page") ? parseInt(searchParams.get("page")!, 10) : undefined,
    pageSize: searchParams.get("pageSize") ? parseInt(searchParams.get("pageSize")!, 10) : undefined,
  };
}

/**
 * 读取JSON请求体
 */
async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) as Record<string, unknown> : {};
}

/**
 * 发送JSON响应
 */
function sendJsonResponse<T>(res: ServerResponse, data: T, status = 200): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ code: 0, message: "ok", data }));
}

/**
 * 发送错误响应
 */
function sendErrorResponse(res: ServerResponse, error: unknown, status = 400): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({
    code: status === 404 ? 1004 : 1001,
    message: (error as Error).message ?? "error",
    data: null
  }));
}

/**
 * 处理AI任务相关的HTTP请求
 */
export async function handleAITasksRouter(
  ctx: AppContext,
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const method = req.method ?? "GET";
  const url = new URL(req.url ?? "/", "http://localhost");
  const pathname = url.pathname;

  try {
    // GET /api/ai/tasks - 获取所有AI任务列表
    if (method === "GET" && pathname === "/api/ai/tasks") {
      const params = parseQueryParams(req);
      const result = await listAITasks(ctx, params);
      sendJsonResponse(res, result);
      return;
    }

    // GET /api/ai/tasks/:id - 获取单个AI任务详情
    if (method === "GET" && pathname.startsWith("/api/ai/tasks/") && pathname !== "/api/ai/tasks/cancel" && pathname !== "/api/ai/tasks/retry") {
      const taskId = pathname.replace("/api/ai/tasks/", "");
      const task = await getAITaskById(ctx, taskId);
      if (!task) {
        sendErrorResponse(res, new Error("任务不存在"), 404);
        return;
      }
      sendJsonResponse(res, task);
      return;
    }

    // POST /api/ai/tasks/cancel - 批量取消任务
    if (method === "POST" && pathname === "/api/ai/tasks/cancel") {
      const body = await readJsonBody(req);
      const taskIds = Array.isArray(body.taskIds)
        ? body.taskIds.filter((id): id is string => typeof id === "string" && id.length > 0)
        : [];

      if (taskIds.length === 0) {
        sendErrorResponse(res, new Error("taskIds不能为空"));
        return;
      }

      const result = await cancelAITasks(ctx, taskIds);
      sendJsonResponse(res, result);
      return;
    }

    // POST /api/ai/tasks/retry - 批量重试失败任务
    if (method === "POST" && pathname === "/api/ai/tasks/retry") {
      const body = await readJsonBody(req);
      const taskIds = Array.isArray(body.taskIds)
        ? body.taskIds.filter((id): id is string => typeof id === "string" && id.length > 0)
        : [];

      if (taskIds.length === 0) {
        sendErrorResponse(res, new Error("taskIds不能为空"));
        return;
      }

      const result = await retryAITasks(ctx, taskIds);
      sendJsonResponse(res, result);
      return;
    }

    // DELETE /api/ai/tasks/:id - 删除单个任务
    if (method === "DELETE" && pathname.startsWith("/api/ai/tasks/") && pathname !== "/api/ai/tasks/cancel" && pathname !== "/api/ai/tasks/retry") {
      const taskId = pathname.replace("/api/ai/tasks/", "");
      const deleted = await deleteAITask(ctx, taskId);
      if (!deleted) {
        sendErrorResponse(res, new Error("任务不存在"), 404);
        return;
      }
      sendJsonResponse(res, { deleted: true });
      return;
    }

    // 未匹配的路由
    sendErrorResponse(res, new Error("未找到AI任务路由"), 404);
  } catch (error) {
    console.error(`AI任务路由错误: ${(error as Error).stack ?? (error as Error).message ?? String(error)}`);
    sendErrorResponse(res, error);
  }
}