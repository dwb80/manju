import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { getRawDatabase } from "../storage/sqlite.js";

const COOKIE_NAME = "manju_session";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function hashPassword(password: string, salt: string = randomBytes(16).toString("hex")): string {
  const digest = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${digest}`;
}

function verifyPassword(password: string, encoded: string): boolean {
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
    if (mode === "required") this.ensureBootstrapAdmin();
  }

  private ensureSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS auth_organizations (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS auth_users (
        id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL,
        password_hash TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
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
  }

  private ensureBootstrapAdmin(): void {
    const count = Number(this.db.prepare("SELECT COUNT(*) AS count FROM auth_users").get()?.count ?? 0);
    if (count > 0) return;

    const password = process.env.AUTH_ADMIN_PASSWORD ?? "";
    if (password.length < 12) {
      throw new Error("AUTH_MODE=required 首次启动必须配置至少 12 位的 AUTH_ADMIN_PASSWORD");
    }

    const username = (process.env.AUTH_ADMIN_USERNAME ?? "admin").trim().toLowerCase();
    const displayName = (process.env.AUTH_ADMIN_DISPLAY_NAME ?? "系统管理员").trim();
    const now = new Date().toISOString();
    const organizationId = `org-${randomUUID()}`;
    const userId = `usr-${randomUUID()}`;

    this.db.prepare("INSERT INTO auth_organizations (id,name,created_at) VALUES (?,?,?)")
      .run(organizationId, process.env.AUTH_ORGANIZATION_NAME ?? "默认组织", now);
    this.db.prepare("INSERT INTO auth_users (id,username,display_name,password_hash,active,created_at,updated_at) VALUES (?,?,?,?,1,?,?)")
      .run(userId, username, displayName, hashPassword(password), now, now);
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
      const row = this.db.prepare("SELECT id,username,display_name,password_hash FROM auth_users WHERE username=? AND active=1").get(username) as {
        id: string; username: string; display_name: string; password_hash: string;
      } | undefined;
      if (!row || !verifyPassword(password, String(row.password_hash))) {
        const next = !current || current.resetAt <= Date.now()
          ? { count: 1, resetAt: Date.now() + LOGIN_WINDOW_MS }
          : { ...current, count: current.count + 1 };
        this.attempts.set(key, next);
        send(res, 401, null, "用户名或密码错误");
        return true;
      }
      this.attempts.delete(key);

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
      if (newPassword.length < 12) {
        send(res, 400, null, "新密码至少需要 12 位");
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
      this.db.prepare("UPDATE auth_users SET password_hash=?,updated_at=? WHERE id=?")
        .run(hashPassword(newPassword), now, principal.userId);
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
      if (!/^[a-z0-9._-]{3,64}$/.test(username) || password.length < 12 || !isRole(role) || displayName.length < 1 || displayName.length > 64) {
        send(res, 400, null, "用户名、显示名称、至少 12 位密码或角色不符合要求");
        return true;
      }
      const now = new Date().toISOString();
      const userId = `usr-${randomUUID()}`;
      try {
        this.db.prepare("INSERT INTO auth_users (id,username,display_name,password_hash,active,created_at,updated_at) VALUES (?,?,?,?,1,?,?)")
          .run(userId, username, displayName, hashPassword(password), now, now);
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
      if (newPassword.length < 12) {
        send(res, 400, null, "新密码至少需要 12 位");
        return true;
      }
      const now = new Date().toISOString();
      this.db.prepare("UPDATE auth_users SET password_hash=?,updated_at=? WHERE id=?")
        .run(hashPassword(newPassword), now, targetUserId);
      this.db.prepare("DELETE FROM auth_sessions WHERE user_id=?").run(targetUserId);
      send(res, 200, { reset: true }, "密码已重置");
      return true;
    }

    send(res, 404, null, "认证接口不存在");
    return true;
  }
}

export function resolveAuthMode(): AuthMode {
  if (process.env.AUTH_MODE === "required") return "required";
  if (process.env.AUTH_MODE === "disabled") return "disabled";
  const host = (process.env.HOST ?? "127.0.0.1").trim().toLowerCase();
  return host === "127.0.0.1" || host === "localhost" || host === "::1" ? "disabled" : "required";
}
