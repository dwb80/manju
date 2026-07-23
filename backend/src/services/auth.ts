import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import { getRawDatabase } from "../storage/sqlite.js";
import {
  buildAuthorizeUrl,
  consumeSsoState,
  ensureSsoTables,
  exchangeCodeForToken,
  fetchLarkUserInfo,
  generateSsoState,
  getSsoConfig,
  safeRedirectPath,
  type LarkUserInfo,
} from "./security/sso.js";

const COOKIE_NAME = "manju_session";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;
const PASSWORD_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const SCRYPT_OPTIONS = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;
const COMMON_PASSWORDS = new Set(["password", "password123", "123456789012", "qwertyuiop12", "admin123456", "letmein123456"]);

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function validatePasswordStrength(password: string): string | null {
  if (password.length < 12 || password.length > 128) return "密码长度必须为 12-128 位";
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return "密码过于常见";
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^a-zA-Z0-9]/].filter((pattern) => pattern.test(password)).length;
  if (classes < 3 && password.length < 20) return "密码至少包含大小写字母、数字、符号中的三类，或使用 20 位以上口令短语";
  return null;
}

export function hashPassword(password: string, salt: string = randomBytes(16).toString("hex")): string {
  const digest = scryptSync(password, salt, 64, SCRYPT_OPTIONS).toString("hex");
  return `scrypt-v2$32768$8$1$${salt}$${digest}`;
}

export function verifyPassword(password: string, encoded: string): boolean {
  if (encoded.startsWith("scrypt-v2$")) {
    const [algorithm, n, r, p, salt, expectedHex] = encoded.split("$");
    if (algorithm !== "scrypt-v2" || !salt || !expectedHex) return false;
    const actual = scryptSync(password, salt, 64, { N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024 });
    const expected = Buffer.from(expectedHex, "hex");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
  const [algorithm, salt, expectedHex] = encoded.split(":");
  if (algorithm !== "scrypt" || !salt || !expectedHex) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function parseCookies(req: IncomingMessage): Record<string, string> {
  const result: Record<string, string> = {};
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const index = part.indexOf("=");
    if (index <= 0) continue;
    result[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return result;
}

interface JsonBody {
  username?: string;
  password?: string;
  currentPassword?: string;
  newPassword?: string;
  displayName?: string;
  role?: unknown;
  active?: boolean;
}

async function readJson(req: IncomingMessage): Promise<JsonBody> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const value = Buffer.from(chunk as Buffer | string);
    size += value.length;
    if (size > 64 * 1024) {
      throw Object.assign(new Error("认证请求体过大"), { status: 413 });
    }
    chunks.push(value);
  }
  if (chunks.length === 0) return {};
  const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("请求体必须是 JSON 对象");
  }
  return parsed as JsonBody;
}

function send(res: ServerResponse, status: number, data: unknown, message: string = "ok"): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({
    code: status < 400 ? 0 : status === 401 || status === 403 ? 1003 : 1002,
    message,
    data,
  }));
}

function clientAddress(req: IncomingMessage): string {
  return req.socket.remoteAddress ?? "unknown";
}

function isRole(value: unknown): value is AuthRole {
  return value === "admin" || value === "editor" || value === "viewer";
}

export type AuthRole = "admin" | "editor" | "viewer";
export type AuthMode = "disabled" | "required";

export interface AuthPrincipal {
  userId: string;
  username: string;
  displayName: string;
  role: AuthRole;
  organizationId: string;
  csrfToken: string;
}

export class AuthService {
  readonly mode: AuthMode;
  private readonly db: ReturnType<typeof getRawDatabase>;
  private readonly attempts = new Map<string, { count: number; resetAt: number }>();

  constructor(databaseFile: string, mode: AuthMode) {
    this.mode = mode;
    this.db = getRawDatabase(databaseFile);
    this.ensureSchema();
    ensureSsoTables(databaseFile);
    if (mode === "required") this.ensureBootstrapAdmin();
  }

  private ensureSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS auth_organizations (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS auth_users (
        id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL,
        password_hash TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        failed_login_count INTEGER NOT NULL DEFAULT 0, locked_until TEXT NOT NULL DEFAULT '', password_expires_at TEXT NOT NULL DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS auth_memberships (
        id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, user_id TEXT NOT NULL,
        role TEXT NOT NULL, created_at TEXT NOT NULL,
        UNIQUE(organization_id, user_id)
      );
      CREATE TABLE IF NOT EXISTS auth_sessions (
        id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, user_id TEXT NOT NULL,
        organization_id TEXT NOT NULL, csrf_token TEXT NOT NULL, expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL, last_seen_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_auth_sessions_token ON auth_sessions(token_hash);
      CREATE INDEX IF NOT EXISTS idx_auth_memberships_user ON auth_memberships(user_id);
    `);
    for (const sql of [
      "ALTER TABLE auth_users ADD COLUMN failed_login_count INTEGER NOT NULL DEFAULT 0",
      "ALTER TABLE auth_users ADD COLUMN locked_until TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE auth_users ADD COLUMN password_expires_at TEXT NOT NULL DEFAULT ''",
    ]) {
      try { this.db.exec(sql); } catch { /* 已存在：兼容旧数据库迁移 */ }
    }
  }

  private ensureBootstrapAdmin(): void {
    const count = Number(this.db.prepare("SELECT COUNT(*) AS count FROM auth_users").get()?.count ?? 0);
    if (count > 0) return;

    const password = process.env.AUTH_ADMIN_PASSWORD ?? "";
    const passwordError = validatePasswordStrength(password);
    if (passwordError) throw new Error(`AUTH_MODE=required 首次启动的 AUTH_ADMIN_PASSWORD 不合格：${passwordError}`);

    const username = (process.env.AUTH_ADMIN_USERNAME ?? "admin").trim().toLowerCase();
    const displayName = (process.env.AUTH_ADMIN_DISPLAY_NAME ?? "系统管理员").trim();
    const now = new Date().toISOString();
    const organizationId = `org-${randomUUID()}`;
    const userId = `usr-${randomUUID()}`;

    this.db.prepare("INSERT INTO auth_organizations (id,name,created_at) VALUES (?,?,?)")
      .run(organizationId, process.env.AUTH_ORGANIZATION_NAME ?? "默认组织", now);
    this.db.prepare("INSERT INTO auth_users (id,username,display_name,password_hash,active,created_at,updated_at) VALUES (?,?,?,?,1,?,?)")
      .run(userId, username, displayName, hashPassword(password), now, now);
    this.db.prepare("UPDATE auth_users SET password_expires_at=? WHERE id=?")
      .run(new Date(Date.now() + PASSWORD_TTL_MS).toISOString(), userId);
    this.db.prepare("INSERT INTO auth_memberships (id,organization_id,user_id,role,created_at) VALUES (?,?,?,?,?)")
      .run(`mem-${randomUUID()}`, organizationId, userId, "admin", now);
  }

  private disabledPrincipal(): AuthPrincipal {
    return {
      userId: "local-admin",
      username: "local",
      displayName: "本机管理员",
      role: "admin",
      organizationId: "local",
      csrfToken: "disabled",
    };
  }

  authenticate(req: IncomingMessage): AuthPrincipal | null {
    if (this.mode === "disabled") return this.disabledPrincipal();
    const token = parseCookies(req)[COOKIE_NAME];
    if (!token) return null;

    const row = this.db.prepare(`
      SELECT u.id AS user_id, u.username, u.display_name, m.role, s.organization_id, s.csrf_token, s.expires_at
      FROM auth_sessions s
      JOIN auth_users u ON u.id = s.user_id AND u.active = 1
      JOIN auth_memberships m ON m.user_id = u.id AND m.organization_id = s.organization_id
      WHERE s.token_hash = ?
    `).get(hashToken(token)) as {
      user_id: string; username: string; display_name: string; role: string;
      organization_id: string; csrf_token: string; expires_at: string;
    } | undefined;

    if (!row || Date.parse(String(row.expires_at)) <= Date.now() || !isRole(row.role)) {
      if (row) this.db.prepare("DELETE FROM auth_sessions WHERE token_hash=?").run(hashToken(token));
      return null;
    }

    return {
      userId: String(row.user_id),
      username: String(row.username),
      displayName: String(row.display_name),
      role: row.role,
      organizationId: String(row.organization_id),
      csrfToken: String(row.csrf_token),
    };
  }

  verifyCsrf(req: IncomingMessage, principal: AuthPrincipal): boolean {
    if (this.mode === "disabled" || ["GET", "HEAD", "OPTIONS"].includes(req.method ?? "GET")) return true;
    const supplied = req.headers["x-csrf-token"];
    return typeof supplied === "string" && supplied.length > 0 && supplied === principal.csrfToken;
  }

  async handleRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = new URL(req.url ?? "/", "http://localhost");
    const path = url.pathname;
    if (!path.startsWith("/api/auth/")) return false;

    if (req.method === "POST" && path === "/api/auth/login") {
      if (this.mode === "disabled") {
        send(res, 200, { user: this.disabledPrincipal(), csrfToken: "disabled", mode: this.mode });
        return true;
      }
      const key = clientAddress(req);
      const current = this.attempts.get(key);
      if (current && current.resetAt > Date.now() && current.count >= LOGIN_MAX_ATTEMPTS) {
        send(res, 429, null, "登录失败次数过多，请 15 分钟后重试");
        return true;
      }
      const body = await readJson(req);
      const username = String(body.username ?? "").trim().toLowerCase();
      const password = String(body.password ?? "");
      const row = this.db.prepare("SELECT id,username,display_name,password_hash,failed_login_count,locked_until,password_expires_at FROM auth_users WHERE username=? AND active=1").get(username) as {
        id: string; username: string; display_name: string; password_hash: string;
        failed_login_count: number; locked_until: string; password_expires_at: string;
      } | undefined;
      if (row?.locked_until && Date.parse(row.locked_until) > Date.now()) {
        send(res, 429, null, "账号已临时锁定，请稍后重试");
        return true;
      }
      if (!row || !verifyPassword(password, String(row.password_hash))) {
        const next = !current || current.resetAt <= Date.now()
          ? { count: 1, resetAt: Date.now() + LOGIN_WINDOW_MS }
          : { ...current, count: current.count + 1 };
        this.attempts.set(key, next);
        if (row) {
          const failures = Number(row.failed_login_count ?? 0) + 1;
          const lockedUntil = failures >= LOGIN_MAX_ATTEMPTS ? new Date(Date.now() + LOGIN_WINDOW_MS).toISOString() : "";
          this.db.prepare("UPDATE auth_users SET failed_login_count=?,locked_until=? WHERE id=?")
            .run(failures, lockedUntil, row.id);
          await delay(Math.min(2_000, 100 * (2 ** Math.min(failures, 4))));
        } else {
          await delay(200);
        }
        send(res, 401, null, "用户名或密码错误");
        return true;
      }
      this.attempts.delete(key);
      this.db.prepare("UPDATE auth_users SET failed_login_count=0,locked_until='' WHERE id=?").run(row.id);
      if (row.password_expires_at && Date.parse(row.password_expires_at) <= Date.now()) {
        send(res, 403, null, "密码已过期，请联系管理员重置");
        return true;
      }
      if (!String(row.password_hash).startsWith("scrypt-v2$")) {
        this.db.prepare("UPDATE auth_users SET password_hash=?,updated_at=? WHERE id=?")
          .run(hashPassword(password), new Date().toISOString(), row.id);
      }

      const membership = this.db.prepare("SELECT organization_id,role FROM auth_memberships WHERE user_id=? ORDER BY created_at LIMIT 1").get(String(row.id)) as {
        organization_id: string; role: string;
      } | undefined;
      if (!membership || !isRole(membership.role)) {
        send(res, 403, null, "用户未加入任何组织");
        return true;
      }

      const token = randomBytes(32).toString("base64url");
      const csrfToken = randomBytes(24).toString("base64url");
      const now = new Date().toISOString();
      const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
      this.db.prepare("INSERT INTO auth_sessions (id,token_hash,user_id,organization_id,csrf_token,expires_at,created_at,last_seen_at) VALUES (?,?,?,?,?,?,?,?)")
        .run(`ses-${randomUUID()}`, hashToken(token), String(row.id), String(membership.organization_id), csrfToken, expiresAt, now, now);
      const secure = process.env.AUTH_COOKIE_SECURE === "true" ? "; Secure" : "";
      res.setHeader("set-cookie", `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_TTL_MS / 1000}${secure}`);
      send(res, 200, {
        user: {
          id: row.id,
          username: row.username,
          displayName: row.display_name,
          role: membership.role,
          organizationId: membership.organization_id,
        },
        csrfToken,
        mode: this.mode,
      });
      return true;
    }

    const principal = this.authenticate(req);
    if (!principal) {
      // SEC-AUTH-02 SSO 公开端点（status / login / callback）允许未登录访问
      if (req.method === "GET" && path === "/api/auth/sso/status") {
        const cfg = getSsoConfig();
        send(res, 200, {
          enabled: cfg.enabled,
          provider: cfg.provider,
          autoCreateUser: cfg.autoCreateUser,
          defaultRole: cfg.defaultRole,
        });
        return true;
      }
      if (req.method === "GET" && path === "/api/auth/sso/lark/login") {
        const cfg = getSsoConfig();
        if (!cfg.enabled) {
          send(res, 404, null, "SSO 未启用（缺少 LARK_APP_ID / LARK_APP_SECRET / SSO_REDIRECT_URI）");
          return true;
        }
        const redirect = safeRedirectPath(new URL(req.url ?? "/", "http://localhost").searchParams.get("redirect"));
        const state = generateSsoState(this.db, redirect);
        const url = buildAuthorizeUrl(cfg, state);
        res.writeHead(302, { location: url, "cache-control": "no-store" });
        res.end();
        return true;
      }
      if (req.method === "GET" && path === "/api/auth/sso/lark/callback") {
        const cfg = getSsoConfig();
        if (!cfg.enabled) {
          send(res, 404, null, "SSO 未启用");
          return true;
        }
        const url = new URL(req.url ?? "/", "http://localhost");
        const code = url.searchParams.get("code") ?? "";
        const state = url.searchParams.get("state") ?? "";
        const stateResult = consumeSsoState(this.db, state);
        if (!stateResult.ok) {
          send(res, 400, null, `SSO 状态校验失败：${stateResult.reason}`);
          return true;
        }
        if (!code || code.length < 8 || code.length > 1024) {
          send(res, 400, null, "授权码无效");
          return true;
        }
        try {
          const accessToken = await exchangeCodeForToken(cfg, code);
          const userInfo = await fetchLarkUserInfo(cfg, accessToken);
          const resolved = this.resolveSsoUser(cfg, userInfo);
          this.issueSession(res, resolved.user, resolved.csrfToken);
          const target = stateResult.redirectAfter && stateResult.redirectAfter !== "/" ? stateResult.redirectAfter : "/";
          const joiner = target.includes("?") ? "&" : "?";
          res.writeHead(302, { location: `${target}${joiner}sso=ok&created=${resolved.created ? "1" : "0"}`, "cache-control": "no-store" });
          res.end();
          return true;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          send(res, 502, null, `SSO 回调失败：${message}`);
          return true;
        }
      }
      send(res, 401, null, "请先登录");
      return true;
    }
    if (!this.verifyCsrf(req, principal)) {
      send(res, 403, null, "CSRF 校验失败");
      return true;
    }

    if (req.method === "GET" && path === "/api/auth/me") {
      send(res, 200, { user: principal, csrfToken: principal.csrfToken, mode: this.mode });
      return true;
    }
    if (req.method === "POST" && path === "/api/auth/logout") {
      const token = parseCookies(req)[COOKIE_NAME];
      if (token) this.db.prepare("DELETE FROM auth_sessions WHERE token_hash=?").run(hashToken(token));
      res.setHeader("set-cookie", `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
      send(res, 200, { loggedOut: true });
      return true;
    }
    if (req.method === "POST" && path === "/api/auth/change-password") {
      if (this.mode === "disabled") {
        send(res, 400, null, "本机免登录模式不支持修改密码");
        return true;
      }
      const body = await readJson(req);
      const currentPassword = String(body.currentPassword ?? "");
      const newPassword = String(body.newPassword ?? "");
      const passwordError = validatePasswordStrength(newPassword);
      if (passwordError) {
        send(res, 400, null, passwordError);
        return true;
      }
      if (currentPassword === newPassword) {
        send(res, 400, null, "新密码不能与当前密码相同");
        return true;
      }
      const user = this.db.prepare("SELECT password_hash FROM auth_users WHERE id=? AND active=1").get(principal.userId) as { password_hash: string } | undefined;
      if (!user || !verifyPassword(currentPassword, String(user.password_hash))) {
        send(res, 400, null, "当前密码不正确");
        return true;
      }
      const now = new Date().toISOString();
      this.db.prepare("UPDATE auth_users SET password_hash=?,updated_at=?,password_expires_at=?,failed_login_count=0,locked_until='' WHERE id=?")
        .run(hashPassword(newPassword), now, new Date(Date.now() + PASSWORD_TTL_MS).toISOString(), principal.userId);
      const token = parseCookies(req)[COOKIE_NAME];
      if (token) {
        this.db.prepare("DELETE FROM auth_sessions WHERE user_id=? AND token_hash<>?")
          .run(principal.userId, hashToken(token));
      }
      send(res, 200, { changed: true }, "密码修改成功");
      return true;
    }

    if (principal.role !== "admin") {
      send(res, 403, null, "仅管理员可管理用户和组织");
      return true;
    }

    // SEC-AUTH-02 SSO 解绑：仅当前登录用户本人可解绑（不需要 admin）
    if (req.method === "POST" && path === "/api/auth/sso/lark/unlink") {
      this.db.prepare("DELETE FROM auth_sso_accounts WHERE user_id=? AND provider='lark'").run(principal.userId);
      send(res, 200, { unlinked: true });
      return true;
    }

    if (req.method === "GET" && path === "/api/auth/users") {
      const rows = this.db.prepare(`
        SELECT u.id, u.username, u.display_name, u.active, m.role, m.organization_id, u.created_at, u.updated_at
        FROM auth_users u JOIN auth_memberships m ON m.user_id = u.id
        WHERE m.organization_id = ? ORDER BY u.active DESC, u.created_at
      `).all(principal.organizationId) as Array<{
        id: string; username: string; display_name: string; active: number;
        role: string; organization_id: string; created_at: string; updated_at: string;
      }>;
      send(res, 200, rows.map((row) => ({
        id: row.id,
        username: row.username,
        displayName: row.display_name,
        active: Boolean(row.active),
        role: row.role,
        organizationId: row.organization_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })));
      return true;
    }

    if (req.method === "POST" && path === "/api/auth/users") {
      const body = await readJson(req);
      const username = String(body.username ?? "").trim().toLowerCase();
      const password = String(body.password ?? "");
      const displayName = String(body.displayName ?? username).trim();
      const role = body.role;
      const passwordError = validatePasswordStrength(password);
      if (!/^[a-z0-9._-]{3,64}$/.test(username) || passwordError || !isRole(role) || displayName.length < 1 || displayName.length > 64) {
        send(res, 400, null, passwordError ?? "用户名、显示名称或角色不符合要求");
        return true;
      }
      const now = new Date().toISOString();
      const userId = `usr-${randomUUID()}`;
      try {
        this.db.prepare("INSERT INTO auth_users (id,username,display_name,password_hash,active,created_at,updated_at) VALUES (?,?,?,?,1,?,?)")
          .run(userId, username, displayName, hashPassword(password), now, now);
        this.db.prepare("UPDATE auth_users SET password_expires_at=? WHERE id=?")
          .run(new Date(Date.now() + PASSWORD_TTL_MS).toISOString(), userId);
        this.db.prepare("INSERT INTO auth_memberships (id,organization_id,user_id,role,created_at) VALUES (?,?,?,?,?)")
          .run(`mem-${randomUUID()}`, principal.organizationId, userId, role, now);
      } catch {
        send(res, 409, null, "用户名已存在");
        return true;
      }
      send(res, 201, { id: userId, username, displayName, role, organizationId: principal.organizationId });
      return true;
    }

    const userMatch = path.match(/^\/api\/auth\/users\/([^/]+)$/);
    if (req.method === "PATCH" && userMatch) {
      const targetUserId = decodeURIComponent(userMatch[1]);
      const target = this.db.prepare(`
        SELECT u.id, u.display_name, u.active, m.role
        FROM auth_users u JOIN auth_memberships m ON m.user_id = u.id
        WHERE u.id = ? AND m.organization_id = ?
      `).get(targetUserId, principal.organizationId) as {
        id: string; display_name: string; active: number; role: string;
      } | undefined;
      if (!target || !isRole(target.role)) {
        send(res, 404, null, "用户不存在");
        return true;
      }
      const body = await readJson(req);
      const displayName = body.displayName === undefined ? String(target.display_name) : String(body.displayName).trim();
      const role = body.role === undefined ? target.role : body.role;
      const active = body.active === undefined ? Boolean(target.active) : body.active;
      if (displayName.length < 1 || displayName.length > 64 || !isRole(role) || typeof active !== "boolean") {
        send(res, 400, null, "显示名称、角色或启用状态不符合要求");
        return true;
      }
      if (targetUserId === principal.userId && (role !== target.role || !active)) {
        send(res, 400, null, "不能修改自己的角色或停用自己的账号");
        return true;
      }
      if (target.role === "admin" && (role !== "admin" || !active)) {
        const activeAdminCount = Number(this.db.prepare(`
          SELECT COUNT(*) AS count
          FROM auth_users u JOIN auth_memberships m ON m.user_id = u.id
          WHERE m.organization_id = ? AND m.role = 'admin' AND u.active = 1
        `).get(principal.organizationId)?.count ?? 0);
        if (activeAdminCount <= 1) {
          send(res, 400, null, "组织必须保留至少一个启用的管理员");
          return true;
        }
      }
      const now = new Date().toISOString();
      this.db.prepare("UPDATE auth_users SET display_name=?,active=?,updated_at=? WHERE id=?")
        .run(displayName, active ? 1 : 0, now, targetUserId);
      this.db.prepare("UPDATE auth_memberships SET role=? WHERE user_id=? AND organization_id=?")
        .run(role, targetUserId, principal.organizationId);
      if (!active) this.db.prepare("DELETE FROM auth_sessions WHERE user_id=?").run(targetUserId);
      send(res, 200, { id: targetUserId, displayName, role, active });
      return true;
    }

    const resetPasswordMatch = path.match(/^\/api\/auth\/users\/([^/]+)\/reset-password$/);
    if (req.method === "POST" && resetPasswordMatch) {
      const targetUserId = decodeURIComponent(resetPasswordMatch[1]);
      if (targetUserId === principal.userId) {
        send(res, 400, null, "请通过个人菜单修改自己的密码");
        return true;
      }
      const target = this.db.prepare(`
        SELECT u.id FROM auth_users u JOIN auth_memberships m ON m.user_id = u.id
        WHERE u.id = ? AND m.organization_id = ?
      `).get(targetUserId, principal.organizationId) as { id: string } | undefined;
      if (!target) {
        send(res, 404, null, "用户不存在");
        return true;
      }
      const body = await readJson(req);
      const newPassword = String(body.newPassword ?? "");
      const passwordError = validatePasswordStrength(newPassword);
      if (passwordError) {
        send(res, 400, null, passwordError);
        return true;
      }
      const now = new Date().toISOString();
      this.db.prepare("UPDATE auth_users SET password_hash=?,updated_at=?,password_expires_at=?,failed_login_count=0,locked_until='' WHERE id=?")
        .run(hashPassword(newPassword), now, new Date(Date.now() + PASSWORD_TTL_MS).toISOString(), targetUserId);
      this.db.prepare("DELETE FROM auth_sessions WHERE user_id=?").run(targetUserId);
      send(res, 200, { reset: true }, "密码已重置");
      return true;
    }

    send(res, 404, null, "认证接口不存在");
    return true;
  }

  /**
   * SEC-AUTH-02 SSO 解析用户：
   * 1. 在 auth_sso_accounts 中查 provider + provider_user_id
   * 2. 命中 → 关联已有用户，刷新 display/email/avatar
   * 3. 未命中 + autoCreateUser → 创建只读账号（username = lark_<openId前16位>，随机密码）
   * 4. 未命中 + !autoCreateUser → 抛 403，要求先绑定
   */
  private resolveSsoUser(config: ReturnType<typeof getSsoConfig>, info: LarkUserInfo): {
    user: { id: string; username: string; displayName: string; role: AuthRole; organizationId: string };
    csrfToken: string;
    created: boolean;
  } {
    if (!info.openId) throw new Error("飞书 openId 缺失");
    const now = new Date().toISOString();
    const existing = this.db.prepare(`
      SELECT user_id, display_name, provider_email, avatar_url FROM auth_sso_accounts
      WHERE provider = ? AND provider_user_id = ?
    `).get("lark", info.openId) as { user_id: string; display_name: string; provider_email: string; avatar_url: string } | undefined;

    if (existing) {
      this.db.prepare(`
        UPDATE auth_sso_accounts SET display_name=?, provider_email=?, avatar_url=?, provider_union_id=?, updated_at=?
        WHERE provider=? AND provider_user_id=?
      `).run(info.name || existing.display_name, info.email || existing.provider_email, info.avatarUrl || existing.avatar_url, info.unionId, now, "lark", info.openId);
      const membership = this.db.prepare("SELECT organization_id, role FROM auth_memberships WHERE user_id=? ORDER BY created_at LIMIT 1").get(existing.user_id) as { organization_id: string; role: string } | undefined;
      if (!membership || !isRole(membership.role)) throw new Error("SSO 账号未关联有效组织");
      const csrfToken = randomBytes(24).toString("base64url");
      return {
        user: { id: existing.user_id, username: "", displayName: info.name || existing.display_name, role: membership.role, organizationId: membership.organization_id },
        csrfToken,
        created: false,
      };
    }

    if (!config.autoCreateUser) {
      throw new Error("SSO 首次登录未开启自动注册，请联系管理员");
    }

    // 自动注册：用 lark_<openId8位> 作为 username（保证唯一且匿名）
    const username = `lark_${info.openId.slice(0, 8).toLowerCase()}`;
    const existingUser = this.db.prepare("SELECT id FROM auth_users WHERE username=?").get(username) as { id: string } | undefined;
    let userId: string;
    let organizationId: string;
    if (existingUser) {
      userId = existingUser.id;
    } else {
      userId = `usr-${randomUUID()}`;
      // SSO 用户暂归入 bootstrap 的组织
      const org = this.db.prepare("SELECT id FROM auth_organizations ORDER BY created_at LIMIT 1").get() as { id: string } | undefined;
      if (!org) {
        organizationId = `org-${randomUUID()}`;
        this.db.prepare("INSERT INTO auth_organizations (id,name,created_at) VALUES (?,?,?)").run(organizationId, "默认组织", now);
      } else {
        organizationId = org.id;
      }
      // SSO 用户没有密码：用 randomBytes(48) 占位 + 立即过期，强制其绑密码或保持 SSO-only
      this.db.prepare("INSERT INTO auth_users (id,username,display_name,password_hash,active,created_at,updated_at) VALUES (?,?,?,?,1,?,?)")
        .run(userId, username, info.name || "飞书用户", `sso-only:${randomBytes(32).toString("base64url")}`, now, now);
      this.db.prepare("INSERT INTO auth_memberships (id,organization_id,user_id,role,created_at) VALUES (?,?,?,?,?)")
        .run(`mem-${randomUUID()}`, organizationId, userId, config.defaultRole, now);
    }
    this.db.prepare(`
      INSERT INTO auth_sso_accounts (id,user_id,provider,provider_user_id,provider_union_id,provider_email,display_name,avatar_url,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(provider, provider_user_id) DO UPDATE SET
        display_name=excluded.display_name, provider_email=excluded.provider_email,
        avatar_url=excluded.avatar_url, provider_union_id=excluded.provider_union_id, updated_at=excluded.updated_at
    `).run(`sso-${randomUUID()}`, userId, "lark", info.openId, info.unionId, info.email, info.name, info.avatarUrl, now, now);
    const finalOrg = this.db.prepare("SELECT organization_id FROM auth_memberships WHERE user_id=? ORDER BY created_at LIMIT 1").get(userId) as { organization_id: string };
    const csrfToken = randomBytes(24).toString("base64url");
    return {
      user: { id: userId, username, displayName: info.name || "飞书用户", role: config.defaultRole, organizationId: finalOrg.organization_id },
      csrfToken,
      created: true,
    };
  }

  /** SEC-AUTH-02 SSO 写 session：复用密码登录的 cookie 体系。 */
  private issueSession(
    res: ServerResponse,
    user: { id: string; username: string; displayName: string; role: AuthRole; organizationId: string },
    csrfToken: string,
  ): void {
    const token = randomBytes(32).toString("base64url");
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    this.db.prepare("INSERT INTO auth_sessions (id,token_hash,user_id,organization_id,csrf_token,expires_at,created_at,last_seen_at) VALUES (?,?,?,?,?,?,?,?)")
      .run(`ses-${randomUUID()}`, hashToken(token), user.id, user.organizationId, csrfToken, expiresAt, now, now);
    const secure = process.env.AUTH_COOKIE_SECURE === "true" ? "; Secure" : "";
    res.setHeader("set-cookie", `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_TTL_MS / 1000}${secure}`);
  }
}

export function resolveAuthMode(): AuthMode {
  if (process.env.AUTH_MODE === "required") return "required";
  if (process.env.AUTH_MODE === "disabled") return "disabled";
  const host = (process.env.HOST ?? "127.0.0.1").trim().toLowerCase();
  return host === "127.0.0.1" || host === "localhost" || host === "::1" ? "disabled" : "required";
}
