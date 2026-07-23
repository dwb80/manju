import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { lookup } from "node:dns/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { isIP } from "node:net";
import { rootLogger } from "../../logger.js";

const ENCRYPTED_PREFIX = "enc:v1:";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const SECRET_KEYS = /(?:api[_-]?key|authorization|access[_-]?token|refresh[_-]?token|client[_-]?secret|credential|password)/i;

function encryptionKey(): Buffer {
  const configured = process.env.DATA_ENCRYPTION_KEY?.trim();
  if (!configured) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("生产环境必须配置 DATA_ENCRYPTION_KEY（32 字节随机密钥）");
    }
    // 本地兼容密钥仅用于开发和测试；生产环境上方会 fail closed。
    return createHash("sha256").update("manju-local-development-key-v1").digest();
  }
  const decoded = /^[0-9a-f]{64}$/i.test(configured)
    ? Buffer.from(configured, "hex")
    : Buffer.from(configured, "base64");
  if (decoded.length !== 32) throw new Error("DATA_ENCRYPTION_KEY 必须是 32 字节的 hex 或 base64");
  return decoded;
}

export function assertEncryptionConfigured(): void { void encryptionKey(); }

function decodeConfiguredKey(configured: string): Buffer {
  const decoded = /^[0-9a-f]{64}$/i.test(configured) ? Buffer.from(configured, "hex") : Buffer.from(configured, "base64");
  if (decoded.length !== 32) throw new Error("DATA_ENCRYPTION_KEY 必须是 32 字节的 hex 或 base64");
  return decoded;
}

function decryptionKeys(): Buffer[] {
  const current = encryptionKey();
  const previous = (process.env.DATA_ENCRYPTION_PREVIOUS_KEYS ?? "").split(",").map((item) => item.trim()).filter(Boolean).map(decodeConfiguredKey);
  return [current, ...previous];
}

function keyId(key: Buffer): string { return createHash("sha256").update(key).digest("hex").slice(0, 12); }

export function encryptSecret(plainText: string): string {
  if (!plainText || plainText.startsWith(ENCRYPTED_PREFIX)) return plainText;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENCRYPTED_PREFIX}${keyId(encryptionKey())}:${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

export function decryptSecret(value: string): string {
  if (!value.startsWith(ENCRYPTED_PREFIX)) return value;
  const parts = value.slice(ENCRYPTED_PREFIX.length).split(":");
  const legacy = parts.length === 3;
  const [storedKeyId, ivText, tagText, encryptedText] = legacy ? ["", ...parts] : parts;
  if (!ivText || !tagText || !encryptedText) throw new Error("加密字段格式无效");
  const candidates = decryptionKeys().filter((key) => legacy || keyId(key) === storedKeyId);
  for (const key of candidates) {
    try {
      const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivText, "base64url"));
      decipher.setAuthTag(Buffer.from(tagText, "base64url"));
      return Buffer.concat([decipher.update(Buffer.from(encryptedText, "base64url")), decipher.final()]).toString("utf8");
    } catch { /* 尝试轮换前的历史密钥 */ }
  }
  throw new Error("无法使用当前或历史 DATA_ENCRYPTION_KEY 解密字段");
}

/** 递归加密 JSON 中的凭据字段；读取旧明文时自动兼容，下次写入完成迁移。 */
export function protectSensitiveJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(protectSensitiveJson);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [
    key,
    SECRET_KEYS.test(key) && typeof item === "string" ? encryptSecret(item) : protectSensitiveJson(item),
  ]));
}

export function revealSensitiveJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(revealSensitiveJson);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [
    key,
    SECRET_KEYS.test(key) && typeof item === "string" ? decryptSecret(item) : revealSensitiveJson(item),
  ]));
}

export function requestIp(req: IncomingMessage): string {
  const trustProxy = process.env.TRUST_PROXY === "true";
  const forwarded = trustProxy ? req.headers["x-forwarded-for"] : undefined;
  const first = typeof forwarded === "string" ? forwarded.split(",")[0]?.trim() : undefined;
  return first || req.socket.remoteAddress || "unknown";
}

type RateState = { count: number; resetAt: number };

export class EndpointRateLimiter {
  private readonly states = new Map<string, RateState>();

  check(req: IncomingMessage, userId = "anonymous"): { allowed: boolean; retryAfter: number; limit: number; remaining: number } {
    const path = new URL(req.url ?? "/", "http://localhost").pathname;
    const method = req.method ?? "GET";
    const login = method === "POST" && path === "/api/auth/login";
    const write = !SAFE_METHODS.has(method) && path.startsWith("/api/");
    if (!login && !write) return { allowed: true, retryAfter: 0, limit: 0, remaining: 0 };
    // 测试套件中的旧 HTTP 脚本会复用同一服务进程；仅 NODE_ENV=test 时允许提高写配额，
    // 生产默认值和登录防爆破阈值不受环境覆盖影响。
    const testWriteLimit = process.env.NODE_ENV === "test"
      ? Number(process.env.ENDPOINT_WRITE_RATE_LIMIT ?? 60)
      : 60;
    const limit = login ? 5 : (
      Number.isInteger(testWriteLimit) && testWriteLimit >= 60 ? testWriteLimit : 60
    );
    const windowMs = 60_000;
    const identity = login ? requestIp(req) : userId;
    const key = `${login ? "login" : "write"}:${identity}`;
    const now = Date.now();
    let state = this.states.get(key);
    if (!state || state.resetAt <= now) state = { count: 0, resetAt: now + windowMs };
    state.count += 1;
    this.states.set(key, state);
    if (this.states.size > 10_000) {
      for (const [candidate, item] of this.states) if (item.resetAt <= now) this.states.delete(candidate);
    }
    return {
      allowed: state.count <= limit,
      retryAfter: Math.max(1, Math.ceil((state.resetAt - now) / 1000)),
      limit,
      remaining: Math.max(0, limit - state.count),
    };
  }
}

export function enforceHttps(req: IncomingMessage, res: ServerResponse): boolean {
  const production = process.env.NODE_ENV === "production";
  const enabled = process.env.FORCE_HTTPS === "true" || (production && process.env.FORCE_HTTPS !== "false");
  const encrypted = Boolean((req.socket as typeof req.socket & { encrypted?: boolean }).encrypted);
  const forwarded = process.env.TRUST_PROXY === "true" ? req.headers["x-forwarded-proto"] : undefined;
  const secure = encrypted || (typeof forwarded === "string" && forwarded.split(",")[0]?.trim() === "https");
  if (secure) res.setHeader("strict-transport-security", "max-age=63072000; includeSubDomains; preload");
  if (!enabled || secure) return true;
  if (SAFE_METHODS.has(req.method ?? "GET") && req.headers.host) {
    res.writeHead(308, { location: `https://${req.headers.host}${req.url ?? "/"}` });
    res.end();
  } else {
    res.writeHead(426, { "content-type": "application/json; charset=utf-8", upgrade: "TLS/1.2" });
    res.end(JSON.stringify({ code: 1003, message: "该接口只接受 HTTPS", data: null }));
  }
  return false;
}

function isPrivateAddress(address: string): boolean {
  const normalized = address.replace(/^::ffff:/, "");
  if (normalized === "::1" || normalized === "::" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) return true;
  const parts = normalized.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return false;
  return parts[0] === 10 || parts[0] === 127 || parts[0] === 0 || (parts[0] === 169 && parts[1] === 254)
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168)
    || (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) || parts[0] >= 224;
}

export async function assertSafeRemoteUrl(rawUrl: string): Promise<URL> {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:") throw new Error("远程资源仅允许 HTTPS");
  if (url.username || url.password) throw new Error("远程资源 URL 不允许内嵌凭据");
  const allowedHosts = (process.env.REMOTE_MEDIA_ALLOWED_HOSTS ?? "")
    .split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  if (allowedHosts.length > 0 && !allowedHosts.includes(url.hostname.toLowerCase())) throw new Error("远程资源主机不在白名单");
  const records = isIP(url.hostname) ? [{ address: url.hostname }] : await lookup(url.hostname, { all: true, verbatim: true });
  if (records.length === 0 || records.some((record) => isPrivateAddress(record.address))) throw new Error("禁止访问内网、回环或链路本地地址");
  return url;
}

/** 每次跳转均重新做 DNS/IP 校验，避免 DNS rebinding 与重定向绕过。 */
export async function safeRemoteFetch(rawUrl: string, init: RequestInit = {}, redirects = 0): Promise<Response> {
  if (redirects > 3) throw new Error("远程资源重定向次数过多");
  const url = await assertSafeRemoteUrl(rawUrl);
  const response = await fetch(url, { ...init, redirect: "manual" });
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    if (!location) throw new Error("远程资源重定向缺少 Location");
    return safeRemoteFetch(new URL(location, url).toString(), init, redirects + 1);
  }
  return response;
}

/** Provider 自定义地址在生产环境执行完整 SSRF 校验；本地测试可使用 loopback mock。 */
export async function safeProviderFetch(rawUrl: string, init: RequestInit = {}): Promise<Response> {
  if (process.env.NODE_ENV !== "production" && process.env.STRICT_PROVIDER_URLS !== "true") return fetch(rawUrl, init);
  return safeRemoteFetch(rawUrl, init);
}

export function logRateLimit(req: IncomingMessage, limit: number, retryAfter: number): void {
  rootLogger.warn({ event: "security.rate_limit", path: req.url, method: req.method, ip: requestIp(req), limit, retryAfter }, "请求触发安全限流");
}

/**
 * 解析 SEC_TRANS_04_CSP_FRAME_ANCESTORS / SEC_TRANS_04_REFERRER_POLICY 等
 * 环境变量，提供"按需放开 + 默认安全"的纵深防御。
 *
 * 环境变量：
 * - SECURITY_FRAME_ANCESTORS: 逗号分隔允许嵌入的源（默认 'none'）
 * - SECURITY_REFERRER_POLICY: 单一取值（默认 'strict-origin-when-cross-origin'）
 * - SECURITY_PERMISSIONS_POLICY: 完整策略字符串（默认禁用 camera/mic/geolocation）
 * - SECURITY_COOP: same-origin / same-site-allow-popups / unsafe-none（默认 same-origin）
 * - SECURITY_COEP: require-corp / credentialless / unsafe-none（默认 unsafe-none，因需兼容 <img> 跨源）
 * - SECURITY_CORP: same-origin / same-site / cross-origin（默认 same-origin）
 */
function parseFrameAncestors(): string {
  const raw = process.env.SECURITY_FRAME_ANCESTORS?.trim();
  if (!raw) return "'none'";
  return raw.split(",").map((item) => item.trim()).filter(Boolean).join(" ");
}

function defaultContentSecurityPolicy(): string {
  const frameAncestors = parseFrameAncestors();
  return [
    "default-src 'self'",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https:",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "connect-src 'self' ws: wss: https:",
    "font-src 'self' data:",
    "frame-ancestors " + frameAncestors,
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join("; ");
}

function defaultPermissionsPolicy(): string {
  return [
    "camera=()",
    "microphone=()",
    "geolocation=()",
    "payment=()",
    "usb=()",
    "magnetometer=()",
    "gyroscope=()",
    "accelerometer=()",
  ].join(", ");
}

export interface SecurityHeaderConfig {
  contentSecurityPolicy: string;
  referrerPolicy: string;
  permissionsPolicy: string;
  crossOriginOpenerPolicy: string;
  crossOriginEmbedderPolicy: string;
  crossOriginResourcePolicy: string;
  frameOptions: string;
}

export function getSecurityHeaderConfig(): SecurityHeaderConfig {
  return {
    contentSecurityPolicy: defaultContentSecurityPolicy(),
    referrerPolicy: process.env.SECURITY_REFERRER_POLICY?.trim() || "strict-origin-when-cross-origin",
    permissionsPolicy: process.env.SECURITY_PERMISSIONS_POLICY?.trim() || defaultPermissionsPolicy(),
    crossOriginOpenerPolicy: process.env.SECURITY_COOP?.trim() || "same-origin",
    crossOriginEmbedderPolicy: process.env.SECURITY_COEP?.trim() || "unsafe-none",
    crossOriginResourcePolicy: process.env.SECURITY_CORP?.trim() || "same-origin",
    frameOptions: process.env.SECURITY_FRAME_OPTIONS?.trim() || "DENY",
  };
}

/**
 * SEC-TRANS-04 安全响应头纵深防御
 *
 * 一次性下发 OWASP Secure Headers Project 推荐的完整响应头集合。
 * - Content-Security-Policy（含 frame-ancestors 替代 X-Frame-Options）
 * - Referrer-Policy（strict-origin-when-cross-origin）
 * - Permissions-Policy（默认禁用 camera/mic/geolocation/payment/usb/传感器）
 * - Cross-Origin-Opener-Policy / Cross-Origin-Embedder-Policy / Cross-Origin-Resource-Policy
 * - X-Content-Type-Options: nosniff（防 MIME 嗅探）
 * - X-Frame-Options: DENY（与 CSP frame-ancestors 互为冗余，兼容老浏览器）
 * - 已存在的 Strict-Transport-Security 由 enforceHttps 在 HTTPS 链路下发
 */
export function applySecurityHeaders(res: ServerResponse, overrides?: Partial<SecurityHeaderConfig>): void {
  const config = { ...getSecurityHeaderConfig(), ...overrides };
  res.setHeader("content-security-policy", config.contentSecurityPolicy);
  res.setHeader("referrer-policy", config.referrerPolicy);
  res.setHeader("permissions-policy", config.permissionsPolicy);
  res.setHeader("cross-origin-opener-policy", config.crossOriginOpenerPolicy);
  res.setHeader("cross-origin-embedder-policy", config.crossOriginEmbedderPolicy);
  res.setHeader("cross-origin-resource-policy", config.crossOriginResourcePolicy);
  res.setHeader("x-content-type-options", "nosniff");
  res.setHeader("x-frame-options", config.frameOptions);
}
