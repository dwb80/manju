/**
 * @file internal-auth.ts
 * @description REM-P1-010：内部服务凭证（Internal Service Token）。
 *
 * 用途：
 *  - 渲染服务、AI 服务等"后端到后端"的回调（成片 release / 渲染进度等），
 *    不应继续以"管理员身份"代替服务身份调用写接口。
 *  - 这种场景应使用独立签发的服务凭证（X-Internal-Service-Token header），
 *    凭证只能调用一组受限的 service 内部方法，写入时会落 `source: "internal_service"`
 *    的审计痕迹。
 *
 * 安全要求：
 *  - 凭证必须 ≥ 32 字节随机（256 bit），与用户态 bearer token 隔离
 *  - 不允许路由到非"内部允许"的接口
 *  - 必须经过恒定时间比较（避免时序侧信道）
 *  - 凭证在配置中心为只读 key，由独立环境变量（INTERNAL_SERVICE_TOKEN_xxx）加载
 *  - 凭证缺失/未配置时默认 fail-closed（拒绝所有内部回调）
 *
 * 兼容：
 *  - 若 INTERNAL_SERVICE_TOKEN 环境变量未设置（开发期），则不加载任何凭证，
 *    所有 internal_callback 接口降级为返回 503（参考 router 实际处理）。
 */
import { createHash, timingSafeEqual, randomBytes } from "node:crypto";
import { rootLogger } from "../logger.js";

const log = rootLogger.child({ module: "internal-auth" });

/** 单一服务的凭证（每个调用方一项：render / ai 等）。 */
export interface InternalServiceCredential {
  /** 服务方唯一标识，用于审计；如 "render-worker-1"。 */
  serviceId: string;
  /** 配置期生成的随机串，进程内不再生成；仅通过环境变量/secret 注入。 */
  tokenHash: string;
  /** 允许的内部操作白名单（如 ["final_video.callback","final_video.release"]）。 */
  allowedActions: string[];
  /** 可选：附加到审计日志的元数据。 */
  meta?: Record<string, unknown>;
}

export interface InternalAuthService {
  /** 是否接受该 token；恒定时间比较。 */
  isInternalServiceToken(token: string | undefined | null): boolean;
  /** 解析 token 对应的服务方（用于审计）；无效 token 返回 null。 */
  resolveService(token: string | undefined | null): InternalServiceCredential | null;
  /** 校验 service 是否被允许执行 action。 */
  isAllowed(serviceId: string, action: string): boolean;
  /** 返回已注册服务方数量（用于健康检查）。 */
  size(): number;
}

const MIN_TOKEN_LENGTH = 32;

function sha256Hex(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) {
    // 仍然做一次比较，避免长度直接泄露（构造等长 buffer）
    timingSafeEqual(aBuf, aBuf);
    return false;
  }
  return timingSafeEqual(aBuf, bBuf);
}

/**
 * 从环境变量加载内部服务凭证。
 *  - INTERNAL_SERVICE_TOKENS：JSON 数组，元素形如 { serviceId, token, allowedActions, meta }
 *  - INTERNAL_SERVICE_TOKEN：单凭证简写，serviceId=default
 *  - 若都没有设置，则返回空表（fail-closed）
 */
function loadFromEnv(): InternalServiceCredential[] {
  const json = process.env.INTERNAL_SERVICE_TOKENS;
  if (json && json.trim().length > 0) {
    try {
      const parsed = JSON.parse(json);
      if (!Array.isArray(parsed)) {
        log.warn({ event: "internal_auth.invalid_env", note: "INTERNAL_SERVICE_TOKENS not array" }, "INTERNAL_SERVICE_TOKENS 解析失败，回退为空");
        return [];
      }
      const out: InternalServiceCredential[] = [];
      for (const item of parsed) {
        if (!item || typeof item !== "object") continue;
        const serviceId = String(item.serviceId ?? "").trim();
        const token = String(item.token ?? "");
        if (!serviceId || token.length < MIN_TOKEN_LENGTH) {
          log.warn({ event: "internal_auth.skipped", serviceId }, "跳过不合规的服务凭证（serviceId 缺失或 token < 32 字节）");
          continue;
        }
        const allowedActions = Array.isArray(item.allowedActions)
          ? item.allowedActions.map((a: unknown) => String(a))
          : [];
        out.push({
          serviceId,
          tokenHash: sha256Hex(token),
          allowedActions,
          meta: typeof item.meta === "object" ? (item.meta as Record<string, unknown>) : undefined,
        });
      }
      return out;
    } catch (err) {
      log.error({ event: "internal_auth.parse_failed", error: (err as Error).message }, "INTERNAL_SERVICE_TOKENS 解析失败，回退为空");
      return [];
    }
  }
  const single = process.env.INTERNAL_SERVICE_TOKEN;
  if (single && single.length >= MIN_TOKEN_LENGTH) {
    log.info(
      { event: "internal_auth.single_loaded" },
      "已从 INTERNAL_SERVICE_TOKEN 加载单凭证（仅 dev/test 用）",
    );
    return [
      {
        serviceId: "default",
        tokenHash: sha256Hex(single),
        allowedActions: ["final_video.callback", "final_video.release", "render.callback"],
        meta: { source: "env_single" },
      },
    ];
  }
  return [];
}

export function createInternalAuthService(): InternalAuthService {
  const creds = loadFromEnv();
  const credsByHash = new Map<string, InternalServiceCredential>();
  for (const c of creds) credsByHash.set(c.tokenHash, c);

  return {
    isInternalServiceToken(token) {
      if (!token || typeof token !== "string") return false;
      if (token.length < MIN_TOKEN_LENGTH) return false;
      const tokenHash = sha256Hex(token);
      for (const c of creds) {
        if (safeEqual(tokenHash, c.tokenHash)) return true;
      }
      return false;
    },
    resolveService(token) {
      if (!token || typeof token !== "string") return null;
      if (token.length < MIN_TOKEN_LENGTH) return null;
      const tokenHash = sha256Hex(token);
      for (const c of creds) {
        if (safeEqual(tokenHash, c.tokenHash)) return c;
      }
      return null;
    },
    isAllowed(serviceId, action) {
      const c = [...credsByHash.values()].find((x) => x.serviceId === serviceId);
      if (!c) return false;
      return c.allowedActions.includes(action);
    },
    size() {
      return creds.length;
    },
  };
}

/** 测试用 helper：从明文生成 32 字节随机 token。 */
export function generateInternalServiceToken(): string {
  return randomBytes(MIN_TOKEN_LENGTH).toString("base64url");
}
