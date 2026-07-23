/**
 * @file tts-models-router.ts
 * @description V2 W12 P0 REQ-AUDIO-F01/F02：TTS 模型与音色路由。
 *
 * 端点：
 *  - GET  /api/tts/models                  列出所有 TTS 能力
 *  - GET  /api/tts/models/:model           获取单个模型能力
 *  - GET  /api/tts/is-supported?model=xxx  isTtsSupported 公开 API
 *  - GET  /api/characters/:id/voice        读取角色绑定的 TTS 音色（用于路由）
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AppContext } from "../services/app.js";
import { sendJson } from "./http-utils.js";
import { isTtsSupported, getTtsCapability, listTtsCapabilities } from "../ai/tts-provider.js";

function sendError(res: ServerResponse, status: number, code: string, message: string, data?: unknown): void {
  sendJson(res, status, { ok: false, code, message, data });
}

interface AccessCheck {
  ok: boolean;
  reason?: string;
  principal?: { userId: string; role: string; isAdmin: boolean };
}

/** V2 W12 P0 REQ-AUDIO-F01：TTS 能力 / 支持判断。 */
export async function handleTtsModelsRouter(
  _ctx: AppContext,
  req: IncomingMessage,
  res: ServerResponse,
  access: AccessCheck | undefined,
  parts: string[],
): Promise<boolean> {
  if (parts[0] !== "api" || parts[1] !== "tts") return false;
  if (!access?.ok) {
    sendError(res, 401, "unauthorized", "需要登录");
    return true;
  }
  // GET /api/tts/models
  if (parts[2] === "models" && parts.length === 3 && req.method === "GET") {
    const caps = listTtsCapabilities();
    sendJson(res, 200, { ok: true, data: { count: caps.length, items: caps } });
    return true;
  }
  // GET /api/tts/models/:model
  if (parts[2] === "models" && parts[3] && req.method === "GET") {
    const cap = getTtsCapability(parts[3]);
    if (!cap) {
      sendError(res, 404, "not_supported", `TTS model ${parts[3]} 不支持`);
      return true;
    }
    sendJson(res, 200, { ok: true, data: cap });
    return true;
  }
  // GET /api/tts/is-supported?model=xxx
  if (parts[2] === "is-supported" && req.method === "GET") {
    const url = new URL(req.url ?? "/", "http://localhost");
    const model = url.searchParams.get("model");
    sendJson(res, 200, { ok: true, data: { model, supported: isTtsSupported(model) } });
    return true;
  }
  return false;
}

/** V2 W12 P0 REQ-AUDIO-F02：角色音色查询端点。 */
export async function handleCharacterVoiceRouter(
  ctx: AppContext,
  req: IncomingMessage,
  res: ServerResponse,
  access: AccessCheck | undefined,
  parts: string[],
): Promise<boolean> {
  if (parts[0] !== "api" || parts[1] !== "characters" || parts[3] !== "voice") return false;
  if (!access?.ok) {
    sendError(res, 401, "unauthorized", "需要登录");
    return true;
  }
  if (req.method !== "GET") {
    sendError(res, 405, "method_not_allowed", "仅支持 GET");
    return true;
  }
  const charId = parts[2];
  if (!charId) {
    sendError(res, 400, "missing_id", "character_id 必填");
    return true;
  }
  const ch = (await ctx.characters.findById(charId)) as
    | { id: string; name: string; voice_id?: string; voice_speed?: number; voice_emotion?: string }
    | null;
  if (!ch) {
    sendError(res, 404, "not_found", `character ${charId} 不存在`);
    return true;
  }
  // 如果没绑定 voice_id 则返空，前端可回退到默认 edge-tts
  sendJson(res, 200, {
    ok: true,
    data: {
      character_id: ch.id,
      name: ch.name,
      voice_id: ch.voice_id ?? "",
      voice_speed: ch.voice_speed ?? 1.0,
      voice_emotion: ch.voice_emotion ?? "neutral",
      effective_voice_id: ch.voice_id ?? "edge-tts", // fallback
      tts_supported: isTtsSupported(ch.voice_id ?? "edge-tts"),
    },
  });
  return true;
}
