/**
 * @file render-presets-router.ts
 * @description 横/竖版渲染规格预设 HTTP API (RENDER-F03/F04)
 *
 * 端点:
 *  - GET  /api/render/presets                       列出全部 preset
 *  - GET  /api/render/presets/:key                  取单个 preset + video params
 *  - POST /api/render/presets/resolve               把 ratio/key 解析为完整规格
 *
 * 设计:preset 是**只读常量**,不需要 project 隔离,GET 端点对登录用户开放即可。
 * POST /resolve 走 RBAC(editor+),因为它可能给后续创建 composition/render job 用。
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  RENDER_PRESETS,
  RENDER_PRESET_LIST,
  resolveRenderPreset,
  resolveVideoParams,
  assertValidPreset,
  type RenderPresetKey,
} from "../types/render-presets.js";
import { rootLogger } from "../logger.js";

const log = rootLogger.child({ module: "render-presets-router" });

interface AccessCtx {
  userId: string;
  isAdmin: boolean;
  canAccessProject: (projectId: string) => Promise<boolean>;
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(payload));
}

function sendError(res: ServerResponse, status: number, message: string): void {
  sendJson(res, status, { code: status, message, data: null });
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text.trim()) return {};
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("JSON 请求体必须是对象");
    }
    return parsed as Record<string, unknown>;
  } catch (e) {
    throw new Error(`invalid_json: ${(e as Error).message}`);
  }
}

export async function handleRenderPresetsRouter(
  _ctx: unknown,
  req: IncomingMessage,
  res: ServerResponse,
  _access: AccessCtx,
): Promise<void> {
  const url = req.url ?? "/";
  const path = url.split("?")[0];
  const method = (req.method ?? "GET").toUpperCase();
  const parts = path.split("/").filter(Boolean); // ["api","render","presets", ...]

  if (parts[0] !== "api" || parts[1] !== "render" || parts[2] !== "presets") {
    sendError(res, 404, "not_found");
    return;
  }

  // GET /api/render/presets            列表
  // GET /api/render/presets/:key       单个
  // POST /api/render/presets/resolve   解析
  if (parts.length === 3 && method === "GET") {
    return sendJson(res, 200, {
      presets: RENDER_PRESET_LIST,
      total: RENDER_PRESET_LIST.length,
    });
  }

  if (parts.length === 4 && method === "GET") {
    const key = parts[3];
    try {
      const preset = assertValidPreset(key);
      return sendJson(res, 200, { preset });
    } catch (e) {
      sendError(res, 404, (e as Error).message);
      return;
    }
  }

  if (parts.length === 4 && parts[3] === "resolve" && method === "POST") {
    let body: Record<string, unknown> = {};
    try {
      body = await readJsonBody(req);
    } catch (e) {
      sendError(res, 400, (e as Error).message);
      return;
    }
    const presetKey = body.presetKey ? String(body.presetKey) : null;
    const ratio = body.ratio ? String(body.ratio) : null;
    const durationRaw = body.duration;
    const duration = [3, 5, 10, 18].includes(durationRaw as number)
      ? (durationRaw as 3 | 5 | 10 | 18)
      : undefined;
    const num_inference_steps = Number(body.num_inference_steps ?? 30);

    const params = resolveVideoParams({ presetKey, ratio, duration, num_inference_steps });
    log.info(
      { event: "render.preset.resolve", presetKey, ratio, resultKey: params.presetKey, valid: params.valid, userId: _access.userId },
      `render preset resolved: ${params.presetKey}`,
    );
    return sendJson(res, 200, {
      preset: RENDER_PRESETS[params.presetKey],
      videoParams: {
        ratio: params.ratio,
        width: params.width,
        height: params.height,
        duration: params.duration,
        num_inference_steps: params.num_inference_steps,
      },
      valid: params.valid,
      notice: params.notice ?? null,
    });
  }

  sendError(res, 404, "not_found");
}
