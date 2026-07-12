/**
 * 模型中心路由
 *
 * 提供模型配置的完整 CRUD 能力：
 * - GET    /api/models            获取模型列表（可选 ?type=chat|image|video 筛选）
 * - POST   /api/models            创建新模型
 * - GET    /api/models/:id        获取单个模型详情
 * - PUT    /api/models/:id        更新模型配置
 * - DELETE /api/models/:id        删除模型
 * - POST   /api/models/:id/set-default   设置默认模型
 * - POST   /api/models/:id/toggle       切换启用状态（body: { enabled: boolean }）
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AppContext } from "../services/app.js";
import type { ModelType } from "../types.js";
import { rootLogger } from "../logger.js";
import {
  listModels,
  getModelById,
  createModel,
  updateModel,
  deleteModel,
  setDefaultModel,
  toggleModelEnabled,
  seedModelConfigs,
  type ModelInput,
} from "../services/model-center-impl.js";

/**
 * 读取JSON请求体
 */
async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? (JSON.parse(text) as Record<string, unknown>) : {};
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
  res.end(
    JSON.stringify({
      code: status === 404 ? 1004 : 1001,
      message: (error as Error).message ?? "error",
      data: null,
    })
  );
}

/**
 * 解析查询参数中的模型类型
 */
function parseTypeQuery(req: IncomingMessage): ModelType | undefined {
  const url = new URL(req.url ?? "/", "http://localhost");
  const typeValue = url.searchParams.get("type");
  if (typeValue && ["chat", "image", "video"].includes(typeValue)) {
    return typeValue as ModelType;
  }
  return undefined;
}

/**
 * 处理模型中心相关的HTTP请求
 */
export async function handleModelsRouter(
  ctx: AppContext,
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const method = req.method ?? "GET";
  const url = new URL(req.url ?? "/", "http://localhost");
  const pathname = url.pathname;

  try {
    // 首次访问时初始化种子数据
    await seedModelConfigs(ctx);

    // GET /api/models - 获取模型列表
    if (method === "GET" && pathname === "/api/models") {
      const type = parseTypeQuery(req);
      const models = await listModels(ctx, type);
      sendJsonResponse(res, models);
      return;
    }

    // POST /api/models - 创建新模型
    if (method === "POST" && pathname === "/api/models") {
      const body = await readJsonBody(req);
      const input = body as unknown as ModelInput;
      if (!input.name) {
        sendErrorResponse(res, new Error("模型名称不能为空"));
        return;
      }
      const model = await createModel(ctx, input);
      sendJsonResponse(res, model, 201);
      return;
    }

    // 更精确的路由匹配：/api/models/:id（不含额外子路径）
    const modelIdMatch = pathname.match(/^\/api\/models\/([^/]+)$/);
    const modelId = modelIdMatch?.[1];

    // GET /api/models/:id - 获取单个模型详情
    if (method === "GET" && modelId) {
      const model = await getModelById(ctx, decodeURIComponent(modelId));
      if (!model) {
        sendErrorResponse(res, new Error("模型不存在"), 404);
        return;
      }
      sendJsonResponse(res, model);
      return;
    }

    // PUT /api/models/:id - 更新模型配置
    if (method === "PUT" && modelId) {
      const body = await readJsonBody(req);
      const input = body as unknown as ModelInput;
      const model = await updateModel(ctx, decodeURIComponent(modelId), input);
      sendJsonResponse(res, model);
      return;
    }

    // DELETE /api/models/:id - 删除模型
    if (method === "DELETE" && modelId) {
      await deleteModel(ctx, decodeURIComponent(modelId));
      sendJsonResponse(res, { deleted: true });
      return;
    }

    // POST /api/models/:id/set-default - 设置默认模型
    if (method === "POST" && pathname.endsWith("/set-default")) {
      const id = pathname.replace("/api/models/", "").replace("/set-default", "");
      if (!id) {
        sendErrorResponse(res, new Error("模型ID不能为空"));
        return;
      }
      const model = await setDefaultModel(ctx, decodeURIComponent(id));
      sendJsonResponse(res, model);
      return;
    }

    // POST /api/models/:id/toggle - 切换启用状态
    if (method === "POST" && pathname.endsWith("/toggle")) {
      const id = pathname.replace("/api/models/", "").replace("/toggle", "");
      if (!id) {
        sendErrorResponse(res, new Error("模型ID不能为空"));
        return;
      }
      const body = await readJsonBody(req);
      const enabled = Boolean(body.enabled);
      const model = await toggleModelEnabled(ctx, decodeURIComponent(id), enabled);
      sendJsonResponse(res, model);
      return;
    }

    // 未匹配的路由
    sendErrorResponse(res, new Error("未找到模型中心路由"), 404);
  } catch (error) {
    rootLogger.error({ event: "router.error", route: "models", err: error }, `模型中心路由错误`);
    sendErrorResponse(res, error);
  }
}
