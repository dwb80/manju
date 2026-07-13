import type { UploadedFile } from "@/lib/app-types";

const apiBaseUrl = (process.env.NEXT_PUBLIC_AGNES_BACKEND_URL ?? "").replace(/\/+$/, "");

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
  };
  const lower = raw.toLowerCase();
  for (const [key, value] of Object.entries(map)) {
    if (lower.includes(key)) return value;
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

/** 生成接口候选地址，兼容前端代理和直连后端两种开发方式。 */
export function apiCandidates(path: string): string[] {
  if (/^https?:\/\//.test(path)) return [path];
  return Array.from(new Set([apiUrl(path), path]));
}

/** 清除API缓存（用于强制刷新数据） */
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
  if (isGetRequest) {
    const cacheKey = path;
    const cached = apiCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data as T;
    }
  }

  const requestInit = {
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  };
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

  // 对GET请求缓存结果
  if (isGetRequest) {
    apiCache.set(path, { data, timestamp: Date.now() });
  }

  return data;
}

/** 上传图片附件，返回后端保存后的本地 URL 列表。 */
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
