import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { AppContext } from "./app.js";

const contentTypeExtensions: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
};

/** 判断 URL 是否已经是本系统可直接访问的本地媒体地址。 */
function isLocalMediaUrl(url: string): boolean {
  return url.startsWith("/media/") || url.startsWith("/project-media/");
}

/** 判断 URL 是否可以被后端下载缓存。 */
function isDownloadableUrl(url: string): boolean {
  return /^https?:\/\//i.test(url) || /^data:/i.test(url);
}

/** 从远程 URL 或 data URL 中推断文件扩展名。 */
function extensionFromUrl(url: string): string {
  try {
    const ext = path.extname(new URL(url).pathname).toLowerCase();
    if (ext && ext.length <= 6) return ext;
  } catch {
    const match = /^data:([^;,]+)/i.exec(url);
    if (match) return contentTypeExtensions[match[1].toLowerCase()] ?? "";
  }
  return "";
}

/** 根据 HTTP Content-Type 推断文件扩展名。 */
function extensionFromContentType(contentType: string | null): string {
  if (!contentType) return "";
  return contentTypeExtensions[contentType.split(";")[0].trim().toLowerCase()] ?? "";
}

/** 把用户文件名或任务 ID 转成适合落盘的安全文件名。 */
function safeName(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 96);
}

/** 从原始文件名中提取可用扩展名。 */
function extensionFromName(name: string): string {
  const ext = path.extname(name).toLowerCase();
  return ext && ext.length <= 6 ? ext : "";
}

/** 根据文件扩展名推断浏览器需要的 Content-Type。 */
function contentTypeFromExtension(ext: string): string {
  const normalized = ext.toLowerCase();
  return Object.entries(contentTypeExtensions).find(([, value]) => value === normalized)?.[0] ?? "application/octet-stream";
}

/** 根据项目 ID 找到该项目媒体目录和对应访问 URL 前缀。 */
async function projectMediaTarget(ctx: AppContext, projectId: string): Promise<{ root: string; urlPrefix: string } | null> {
  const project = await ctx.projects.findById(projectId);
  if (!project?.storage_path) return null;
  const root = path.resolve(ctx.root, "data", "projects");
  const target = path.resolve(root, ...project.storage_path.split("/"), "media");
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) return null;
  return { root: target, urlPrefix: `/project-media/${encodeURIComponent(projectId)}` };
}

/** 把本地媒体 URL 解析成磁盘路径，供继续编辑时读取文件内容。 */
async function localMediaPath(ctx: AppContext, url: string): Promise<string | null> {
  // 支持两类本地媒体：全局 /media 和项目级 /project-media。
  // 解析时都要重新计算磁盘路径，并限制在对应根目录内。
  if (url.startsWith("/media/")) {
    const requested = decodeURIComponent(url.replace(/^\/media\/?/, ""));
    const target = path.normalize(path.join(ctx.mediaRoot, requested));
    return target.startsWith(path.resolve(ctx.mediaRoot)) ? target : null;
  }
  if (url.startsWith("/project-media/")) {
    const [, projectId, ...rest] = url.replace(/^\/project-media\/?/, "").split("/");
    if (!projectId || rest.length === 0) return null;
    const mediaTarget = await projectMediaTarget(ctx, decodeURIComponent(projectId));
    if (!mediaTarget) return null;
    const target = path.normalize(path.join(mediaTarget.root, ...rest.map(decodeURIComponent)));
    return target.startsWith(path.resolve(mediaTarget.root)) ? target : null;
  }
  return null;
}

/** 把 data URL 解码成二进制文件内容和扩展名。 */
async function bytesFromDataUrl(url: string): Promise<{ bytes: Buffer; ext: string }> {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/i.exec(url);
  if (!match) throw new Error("invalid data url");
  const mediaType = match[1]?.toLowerCase() ?? "";
  const body = decodeURIComponent(match[3] ?? "");
  const bytes = match[2] ? Buffer.from(body, "base64") : Buffer.from(body, "utf8");
  return { bytes, ext: contentTypeExtensions[mediaType] ?? "" };
}

/** 下载远程媒体或解析 data URL，返回可写入磁盘的二进制内容。 */
async function downloadBytes(url: string): Promise<{ bytes: Buffer; ext: string }> {
  if (url.startsWith("data:")) return bytesFromDataUrl(url);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`download failed: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  return { bytes, ext: extensionFromContentType(response.headers.get("content-type")) || extensionFromUrl(url) };
}

/** 把单个远程媒体缓存到本地或项目目录，并返回新的本地访问地址。 */
export async function cacheMediaUrl(ctx: AppContext, url: string, kind: "images" | "videos", taskId: string, index = 0, projectId = ""): Promise<string> {
  if (!url || isLocalMediaUrl(url) || !isDownloadableUrl(url)) return url;
  try {
    const { bytes, ext } = await downloadBytes(url);
    const created = new Date().toISOString().slice(0, 10);
    const finalExt = ext || (kind === "videos" ? ".mp4" : ".png");
    // 有项目归属时缓存到项目目录；没有项目时退回全局 data/media。
    const mediaTarget = projectId ? await projectMediaTarget(ctx, projectId) : null;
    const root = mediaTarget?.root ?? ctx.mediaRoot;
    const urlPrefix = mediaTarget?.urlPrefix ?? "/media";
    const directory = path.join(root, kind, created);
    const filename = `${safeName(taskId)}-${index}${finalExt}`;
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, filename), bytes);
    return `${urlPrefix}/${kind}/${created}/${filename}`;
  } catch {
    return url;
  }
}

/** 批量缓存图片或视频 URL，保持原顺序返回新地址列表。 */
export async function cacheMediaUrls(ctx: AppContext, urls: string[], kind: "images" | "videos", taskId: string, projectId = ""): Promise<string[]> {
  const next: string[] = [];
  for (let index = 0; index < urls.length; index += 1) {
    next.push(await cacheMediaUrl(ctx, urls[index], kind, taskId, index, projectId));
  }
  return next;
}

export interface UploadInput {
  filename: string;
  contentType: string;
  bytes: Buffer;
}

export interface StoredUpload {
  url: string;
  name: string;
  size: number;
  type: string;
}

/** 保存用户上传的图片附件，并返回前端可预览的本地 URL。 */
export async function saveUploadedImage(ctx: AppContext, upload: UploadInput): Promise<StoredUpload> {
  const type = upload.contentType.split(";")[0].trim().toLowerCase();
  if (!type.startsWith("image/")) throw new Error("only image uploads are supported");
  const ext = contentTypeExtensions[type] ?? (extensionFromName(upload.filename) || ".png");
  const created = new Date().toISOString().slice(0, 10);
  const directory = path.join(ctx.mediaRoot, "uploads", created);
  const filename = `${safeName(path.basename(upload.filename, path.extname(upload.filename)) || "image")}-${randomUUID()}${ext}`;
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, filename), upload.bytes);
  return {
    url: `/media/uploads/${created}/${filename}`,
    name: upload.filename,
    size: upload.bytes.length,
    type: type || contentTypeFromExtension(ext),
  };
}

/** 把本地媒体 URL 转成 data URL，供真实 Agnes 接口作为参考图输入。 */
export async function resolveMediaInput(ctx: AppContext, value: string | undefined): Promise<string | undefined> {
  if (!value) return undefined;
  const target = await localMediaPath(ctx, value);
  if (!target) return value;
  const bytes = await readFile(target);
  const type = contentTypeFromExtension(path.extname(target));
  return `data:${type};base64,${bytes.toString("base64")}`;
}

/** 批量解析参考图输入，过滤掉空值。 */
export async function resolveMediaInputs(ctx: AppContext, values: string[]): Promise<string[]> {
  const resolved: string[] = [];
  for (const value of values) {
    const next = await resolveMediaInput(ctx, value);
    if (next) resolved.push(next);
  }
  return resolved;
}
