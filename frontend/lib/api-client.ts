/**
 * @file api-client.ts
 * @description API 客户端核心模块，提供统一的 HTTP 请求封装、缓存机制和错误处理
 */

import type { UploadedFile } from "@/lib/app-types";

const apiBaseUrl = (process.env.NEXT_PUBLIC_AGNES_BACKEND_URL ?? "").replace(/\/+$/, "");
const CSRF_STORAGE_KEY = "manju:csrf-token";

/** 读取当前登录会话的 CSRF Token，供 SSE / 文件上传等原生 fetch 请求复用。 */
export function getCsrfToken(): string {
  return typeof window !== "undefined"
    ? window.sessionStorage.getItem(CSRF_STORAGE_KEY) ?? ""
    : "";
}

export function storeCsrfToken(token: string): void {
  if (typeof window !== "undefined") window.sessionStorage.setItem(CSRF_STORAGE_KEY, token);
}

export function clearCsrfToken(): void {
  if (typeof window !== "undefined") window.sessionStorage.removeItem(CSRF_STORAGE_KEY);
}

/** Agnes API 错误翻译：将英文技术错误转换为友好中文提示 */
function translateAgnesError(raw: string): string {
  const map: Record<string, string> = {
    "image queue is full, please retry later": "AI 生图队列已满，请稍后重试",
    "image queue is full": "AI 生图队列已满，请稍后重试",
    "please retry later": "请稍后重试",
    "do_request_failed": "请求处理失败",
    "video queue is full": "AI 视频生成队列已满，请稍后重试",
    "rate limit exceeded": "请求过于频繁，请稍后再试",
    "timeout": "请求超时，请稍后重试",
    "network error": "网络异常，请检查网络连接",
    "fetch failed": "AI 服务网络连接失败，请检查后端网络、代理或防火墙后重试",
    // Agnes 上游偶尔会返回 HTML 错误页 / 空 body / 纯文本，
    // 后端 readJsonSafe 会包装成 "Agnes xxx 返回结果不是有效 JSON（status=...）：..."，
    // 这里给出友好提示并隐藏后端啰嗦细节。
    "返回结果不是有效 JSON": "AI 服务返回结果解析失败，请稍后重试（一般是上游网关临时异常）",
    "返回空响应": "AI 服务暂时无响应，请稍后重试",
  };
  const lower = raw.toLowerCase();
  for (const [key, value] of Object.entries(map)) {
    if (lower.includes(key.toLowerCase())) return value;
  }
  return raw;
}

/** 请求缓存机制，用于GET请求的短期缓存（默认15秒）
 *
 * 优化说明：
 * - 从 5 秒延长到 15 秒，减少页面切换时的重复请求
 * - 工厂页面列表数据变化不频繁，15 秒缓存可显著降低请求量
 * - 写操作（POST/PUT/DELETE）会自动清除缓存
 */
const apiCache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_DURATION = 15000; // 15秒缓存

/** 根据环境变量拼出后端接口地址。 */
export function apiUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${apiBaseUrl}${path}`;
}

/**
 * apiCandidates - 生成接口候选地址，兼容前端代理和直连后端两种开发方式
 * @param {string} path - API 路径
 * @returns {string[]} 候选地址数组
 */
export function apiCandidates(path: string): string[] {
  if (/^https?:\/\//.test(path)) return [path];
  return Array.from(new Set([apiUrl(path), path]));
}

/**
 * clearApiCache - 清除 API 缓存
 * @param {string} path - 可选的缓存路径，不传则清除全部缓存
 */
export function clearApiCache(path?: string) {
  if (path) {
    apiCache.delete(path);
  } else {
    apiCache.clear();
  }
}

/** 调用普通 JSON API，并把后端统一响应解包成 data。 */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  // 对GET请求启用缓存（非POST/PUT/DELETE请求）
  const isGetRequest = !init?.method || init?.method === "GET";
  // 调用方可用 init.cache = "no-store" 强制跳过缓存（例如刚写库后立刻拉最新数据）
  const bypassCache = (init as (RequestInit & { cache?: string }) | undefined)?.cache === "no-store";

  if (isGetRequest && !bypassCache) {
    const cacheKey = path;
    const cached = apiCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data as T;
    }
  }

  const headers = new Headers(init?.headers);
  if (!headers.has("content-type")) headers.set("content-type", "application/json");
  if (!isGetRequest && typeof window !== "undefined") {
    const csrfToken = getCsrfToken();
    if (csrfToken) headers.set("x-csrf-token", csrfToken);
  }
  const requestInit: RequestInit = { ...init, headers, credentials: init?.credentials ?? "include" };
  // fetch 的 cache: "no-store" 才会真的绕过浏览器缓存，否则浏览器层也会缓存 GET
  if (bypassCache) requestInit.cache = "no-store";

  let response: Response | null = null;
  let networkError: unknown = null;
  for (const url of apiCandidates(path)) {
    try {
      response = await fetch(url, requestInit);
      break;
    } catch (error) {
      networkError = error;
    }
  }
  if (!response) {
    throw new Error(`无法连接后端服务，请确认 start-all.bat 已启动后端。${networkError instanceof Error ? ` ${networkError.message}` : ""}`.trim());
  }
  const text = await response.text();
  let payload: { code?: number; message?: string; data?: unknown } | null = null;
  if (text) {
    try {
      payload = JSON.parse(text) as { code?: number; message?: string; data?: unknown };
    } catch {
      const message = text.trim().slice(0, 300) || `HTTP ${response.status}`;
      throw new Error(response.ok ? message : `请求失败 ${response.status}: ${message}`);
    }
  }
  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined" && !path.startsWith("/api/auth/")) {
      clearCsrfToken();
      window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    }
    const rawMsg = payload?.message || `请求失败 ${response.status}`;
    // 将 Agnes API 的英文错误翻译成友好中文
    const friendlyMsg = translateAgnesError(rawMsg);
    throw new Error(friendlyMsg);
  }
  if (payload?.code !== 0) {
    const rawMsg = payload?.message || "请求失败";
    throw new Error(translateAgnesError(rawMsg));
  }

  const data = payload.data as T;

  // 写操作成功后，清掉 GET 缓存里同路径的条目，避免下次 GET 读到旧数据。
  // 例如 POST /api/assistant/conversations/123/messages 成功后，清掉
  // GET /api/assistant/conversations/123/messages 的缓存。
  if (!isGetRequest) {
    apiCache.delete(path);
  } else if (!bypassCache) {
    // 对GET请求缓存结果
    apiCache.set(path, { data, timestamp: Date.now() });
  }

  return data;
}

// ============== 审核中心（spec 4.1） ==============
//
// 5 个端点对齐后端 router.ts 的 /api/reviews 路由。
// 与现有 ProjectReview（分镜评论，reviews-tab 老逻辑）完全不同的数据源。

export type ReviewTargetType = "storyboard" | "character_image" | "scene_image" | "video";
export type ReviewStatus = "pending" | "approved" | "rejected";
export type RejectionReasonCode =
  | "character_inconsistent"
  | "costume_wrong"
  | "proportion_off"
  | "lighting_unreasonable"
  | "sensitive_content"
  | "other";

export interface ReviewItem {
  id: string;
  target_type: ReviewTargetType;
  target_id: string;
  project_id: string;
  status: ReviewStatus;
  rejected_count: number;
  rejection_reason: string;
  approved_at: string;
  submitted_by: string;
  reviewed_by: string;
  created_at: string;
  updated_at: string;
}

export interface ReviewStats {
  pending: number;
  approved: number;
  rejected: number;
  blockedByFrequentRejection: number;
  progress: { approved: number; total: number; pct: number };
}

/** 提交审核（生产模块调用） */
export async function submitReview(input: {
  targetType: ReviewTargetType;
  targetId: string;
  projectId: string;
  submittedBy: string;
}): Promise<ReviewItem> {
  return api<ReviewItem>("/api/reviews", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** 看板统计 */
export async function fetchReviewStats(projectId: string): Promise<ReviewStats> {
  return api<ReviewStats>(`/api/reviews/stats?projectId=${encodeURIComponent(projectId)}`);
}

/** 按状态列表 */
export async function fetchReviews(projectId: string, status?: ReviewStatus): Promise<ReviewItem[]> {
  const qs = new URLSearchParams({ projectId });
  if (status) qs.set("status", status);
  return api<ReviewItem[]>(`/api/reviews?${qs.toString()}`);
}

/** 通过 */
export async function approveReview(reviewId: string, reviewerId: string): Promise<ReviewItem> {
  return api<ReviewItem>(`/api/reviews/${reviewId}/approve`, {
    method: "POST",
    body: JSON.stringify({ reviewerId }),
  });
}

/** 打回 */
export async function rejectReview(
  reviewId: string,
  reviewerId: string,
  reasonCode: RejectionReasonCode,
): Promise<ReviewItem> {
  return api<ReviewItem>(`/api/reviews/${reviewId}/reject`, {
    method: "POST",
    body: JSON.stringify({ reviewerId, reasonCode }),
  });
}

/** 打回原因模板（V1 写死，与后端 REJECTION_REASONS 对齐） */
export const REJECTION_REASONS: Array<{ code: RejectionReasonCode; label: string }> = [
  { code: "character_inconsistent", label: "人设偏离" },
  { code: "costume_wrong", label: "服装错" },
  { code: "proportion_off", label: "比例失真" },
  { code: "lighting_unreasonable", label: "光影不合理" },
  { code: "sensitive_content", label: "敏感内容" },
  { code: "other", label: "其他" },
];

/**
 * uploadImages - 上传图片附件
 * @param {File[]} files - 要上传的文件数组
 * @returns {Promise<UploadedFile[]>} 上传成功后的文件信息列表
 */
export async function uploadImages(files: File[]): Promise<UploadedFile[]> {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file, file.name));
  let response: Response | null = null;
  let networkError: unknown = null;
  for (const url of apiCandidates("/api/uploads")) {
    try {
      response = await fetch(url, { method: "POST", body: formData });
      break;
    } catch (error) {
      networkError = error;
    }
  }
  if (!response) {
    throw new Error(`无法连接后端服务，请确认 start-all.bat 已启动后端。${networkError instanceof Error ? ` ${networkError.message}` : ""}`.trim());
  }
  const payload = await response.json() as { code?: number; message?: string; data?: UploadedFile[] };
  if (!response.ok || payload.code !== 0) throw new Error(payload.message || "上传失败");
  return payload.data ?? [];
}
