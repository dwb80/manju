/**
 * SEC-AUTH-02 SSO / OAuth 第三方登录（飞书 Lark）
 *
 * 标准 OAuth 2.0 授权码流程：
 *   1. 前端 GET /api/auth/sso/lark/login → 重定向到飞书授权页
 *   2. 飞书回调 GET /api/auth/sso/lark/callback?code=...&state=...
 *   3. 后端用 code 调 https://open.feishu.cn/open-apis/authen/v1/access_token 拿 user_access_token
 *   4. 后端用 user_access_token 调 /authen/v1/user_info 拿用户资料
 *   5. 命中已有 SSO 账号则登录；未命中则按策略自动注册或要求绑定
 *
 * 安全要点：
 * - state 一次性 token（10 分钟过期，存 memory + DB），防止 CSRF
 * - redirect_uri 严格匹配配置的 SSO_REDIRECT_URI（防开放重定向）
 * - 只信任飞书白名单域名（feishu.cn / larksuite.com）的回调
 * - 写 auth_sso_accounts 关联表，不暴露 open_id 字段给前端
 * - 与密码登录共享 session/cookie 体系（manju_session）
 *
 * 设计依据：
 *   - 飞书开放平台 OAuth 2.0 文档 https://open.feishu.cn/document/server-docs/authentication-management/login-state-management
 *   - 不实现 refresh_token 持久化（用户量小，重新走授权码流程更安全）
 */

import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { getRawDatabase } from "../../storage/sqlite.js";
import { rootLogger } from "../../logger.js";
import { assertSafeRemoteUrl, safeRemoteFetch } from "./hardening.js";

const SSO_PROVIDER_LARK = "lark";
const SSO_STATE_TTL_MS = 10 * 60 * 1000;
const SSO_ALLOWED_REDIRECT_PATHS = ["/sso/callback", "/login", "/"];

export interface SsoConfig {
  enabled: boolean;
  provider: typeof SSO_PROVIDER_LARK;
  appId: string;
  appSecret: string;
  redirectUri: string;
  scope: string;
  authorizeUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  autoCreateUser: boolean;
  defaultRole: "viewer" | "editor";
}

export interface LarkUserInfo {
  openId: string;
  unionId: string;
  userId: string;
  name: string;
  email: string;
  avatarUrl: string;
  mobile: string;
}

export function getSsoConfig(): SsoConfig {
  const appId = process.env.LARK_APP_ID?.trim() ?? "";
  const appSecret = process.env.LARK_APP_SECRET?.trim() ?? "";
  const redirectUri = process.env.SSO_REDIRECT_URI?.trim() ?? "";
  const enabled = Boolean(appId && appSecret && redirectUri);
  return {
    enabled,
    provider: SSO_PROVIDER_LARK,
    appId,
    appSecret,
    redirectUri,
    scope: process.env.SSO_SCOPE?.trim() || "contact:user.id:readonly",
    authorizeUrl: process.env.SSO_AUTHORIZE_URL?.trim() || "https://open.feishu.cn/open-apis/authen/v1/index",
    tokenUrl: process.env.SSO_TOKEN_URL?.trim() || "https://open.feishu.cn/open-apis/authen/v1/access_token",
    userInfoUrl: process.env.SSO_USERINFO_URL?.trim() || "https://open.feishu.cn/open-apis/authen/v1/user_info",
    autoCreateUser: process.env.SSO_AUTO_CREATE_USER !== "false",
    defaultRole: process.env.SSO_DEFAULT_ROLE === "editor" ? "editor" : "viewer",
  };
}

/**
 * 确保 auth_sso_accounts / auth_sso_states 表存在。
 * 必须在 AuthService.ensureSchema 之后调用，二者会共存。
 */
export function ensureSsoTables(databaseFile: string): void {
  const db = getRawDatabase(databaseFile);
  db.exec(`
    CREATE TABLE IF NOT EXISTS auth_sso_accounts (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, provider TEXT NOT NULL,
      provider_user_id TEXT NOT NULL, provider_union_id TEXT NOT NULL DEFAULT '',
      provider_email TEXT NOT NULL DEFAULT '', display_name TEXT NOT NULL DEFAULT '',
      avatar_url TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      UNIQUE(provider, provider_user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_auth_sso_accounts_user ON auth_sso_accounts(user_id);
    CREATE TABLE IF NOT EXISTS auth_sso_states (
      state TEXT PRIMARY KEY, created_at TEXT NOT NULL, expires_at TEXT NOT NULL,
      redirect_after TEXT NOT NULL DEFAULT '', consumed INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_auth_sso_states_expires ON auth_sso_states(expires_at);
  `);
}

function pruneExpiredStates(db: ReturnType<typeof getRawDatabase>): void {
  try {
    db.prepare("DELETE FROM auth_sso_states WHERE expires_at <= ?").run(new Date().toISOString());
  } catch { /* ignore */ }
}

export function generateSsoState(db: ReturnType<typeof getRawDatabase>, redirectAfter: string): string {
  pruneExpiredStates(db);
  const state = randomBytes(24).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SSO_STATE_TTL_MS);
  try {
    db.prepare("INSERT INTO auth_sso_states (state,created_at,expires_at,redirect_after,consumed) VALUES (?,?,?,?,0)")
      .run(state, now.toISOString(), expiresAt.toISOString(), redirectAfter.slice(0, 256));
  } catch (err) {
    rootLogger.warn({ event: "sso.state_persist_failed", err: String(err) }, "SSO state 持久化失败");
  }
  return state;
}

export function consumeSsoState(db: ReturnType<typeof getRawDatabase>, state: string, expectedRedirectAfter?: string): { ok: true; redirectAfter: string } | { ok: false; reason: string } {
  if (!state || state.length < 16 || state.length > 128) return { ok: false, reason: "state 格式无效" };
  const row = db.prepare("SELECT state, expires_at, redirect_after, consumed FROM auth_sso_states WHERE state = ?")
    .get(state) as { state: string; expires_at: string; redirect_after: string; consumed: number } | undefined;
  if (!row) return { ok: false, reason: "state 不存在或已失效" };
  if (row.consumed) return { ok: false, reason: "state 已被使用" };
  if (Date.parse(row.expires_at) <= Date.now()) return { ok: false, reason: "state 已过期" };
  db.prepare("UPDATE auth_sso_states SET consumed=1 WHERE state=?").run(state);
  if (expectedRedirectAfter && row.redirect_after && expectedRedirectAfter !== row.redirect_after) {
    return { ok: false, reason: "redirect_after 不匹配" };
  }
  return { ok: true, redirectAfter: row.redirect_after };
}

export function buildAuthorizeUrl(config: SsoConfig, state: string): string {
  const url = new URL(config.authorizeUrl);
  url.searchParams.set("app_id", config.appId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", config.scope);
  return url.toString();
}

interface LarkTokenResponse {
  code: number;
  msg: string;
  data?: {
    access_token?: string;
    token_type?: string;
    expires_in?: number;
    refresh_token?: string;
    scope?: string;
  };
}

interface LarkUserInfoResponse {
  code: number;
  msg: string;
  data?: {
    union_id?: string;
    user_id?: string;
    open_id?: string;
    name?: string;
    email?: string;
    mobile?: { number?: string };
    avatar_url?: string;
  };
}

export async function exchangeCodeForToken(config: SsoConfig, code: string): Promise<string> {
  await assertSafeRemoteUrl(config.tokenUrl);
  const body = {
    grant_type: "authorization_code",
    code,
    client_id: config.appId,
    client_secret: config.appSecret,
    redirect_uri: config.redirectUri,
  };
  const response = await safeRemoteFetch(config.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let parsed: LarkTokenResponse;
  try { parsed = JSON.parse(text) as LarkTokenResponse; } catch { throw new Error("飞书返回非 JSON"); }
  if (parsed.code !== 0 || !parsed.data?.access_token) throw new Error(`飞书令牌换取失败：${parsed.msg}`);
  return parsed.data.access_token;
}

export async function fetchLarkUserInfo(config: SsoConfig, accessToken: string): Promise<LarkUserInfo> {
  await assertSafeRemoteUrl(config.userInfoUrl);
  const response = await safeRemoteFetch(config.userInfoUrl, {
    method: "GET",
    headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" },
  });
  const text = await response.text();
  let parsed: LarkUserInfoResponse;
  try { parsed = JSON.parse(text) as LarkUserInfoResponse; } catch { throw new Error("飞书返回非 JSON"); }
  if (parsed.code !== 0 || !parsed.data?.open_id) throw new Error(`飞书用户信息失败：${parsed.msg}`);
  return {
    openId: parsed.data.open_id,
    unionId: parsed.data.union_id ?? "",
    userId: parsed.data.user_id ?? "",
    name: parsed.data.name ?? "",
    email: parsed.data.email ?? "",
    avatarUrl: parsed.data.avatar_url ?? "",
    mobile: parsed.data.mobile?.number ?? "",
  };
}

/**
 * 用 HMAC 签名保护 state 中的非随机字段（防止伪造 redirect_after）。
 * 当前实现：state = base64url(random) | .hmac = base64url(hmac_sha256(secret, random))
 * 验证时只比较 hmac 相等（constant-time）。
 */
export function signStateToken(rawState: string, secret: string): string {
  const sig = createHmac("sha256", secret).update(rawState).digest("base64url");
  return `${rawState}.${sig}`;
}

export function verifyStateSignature(stateToken: string, secret: string): boolean {
  const dot = stateToken.lastIndexOf(".");
  if (dot < 1) return false;
  const raw = stateToken.slice(0, dot);
  const sig = stateToken.slice(dot + 1);
  const expected = createHmac("sha256", secret).update(raw).digest("base64url");
  if (sig.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

export function isAllowedRedirectPath(path: string): boolean {
  return SSO_ALLOWED_REDIRECT_PATHS.some((prefix) => path === prefix || path.startsWith(`${prefix}?`) || path.startsWith(`${prefix}/`));
}

export function safeRedirectPath(input: string | null | undefined): string {
  if (!input) return "/";
  const trimmed = input.trim();
  if (trimmed.length === 0 || trimmed.length > 256) return "/";
  if (!trimmed.startsWith("/")) return "/";
  if (trimmed.startsWith("//")) return "/";
  if (!isAllowedRedirectPath(trimmed)) return "/";
  return trimmed;
}

export function generateRequestId(): string {
  return `sso-${randomUUID()}`;
}

void rootLogger;
