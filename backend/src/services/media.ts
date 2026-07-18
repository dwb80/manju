/**
 * @file media.ts
 * @description 媒体文件服务模块。提供媒体文件的存储、缓存和转换功能：
 *   - 图片上传和保存
 *   - 远程媒体 URL 缓存到本地
 *   - 图片压缩（用于 Agnes API 参考图输入）
 *   - data URL 与本地文件路径的解析转换
 * 
 * 设计原则：
 *   - 支持全局媒体目录和项目级媒体目录
 *   - 对超过 Agnes API 10MB 限制的图片自动用 sharp 压缩
 *   - 缓存失败时回退到原始 URL，不阻塞业务流程
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import type { AppContext } from "./app.js";
import { rootLogger } from "../logger.js";

const contentTypeExtensions: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
};

/**
 * Agnes 图片生成 API 对单张参考图的硬限是 10MB(base64 解码后的字节数,10485760 bytes)。
 * 用户上传的 12MB 图,base64 编码后约 16MB,会触发 `image queue input image size exceeds max` 错误。
 * 这里把"压缩后的 data URL 长度"控制在 9MB 以内,留约 10% 余量。
 */
const AGNES_IMAGE_MAX_BASE64_BYTES = 9 * 1024 * 1024; // 9MB(留 10% 余量,防止边界)
const AGNES_IMAGE_MAX_RAW_BYTES = Math.floor((AGNES_IMAGE_MAX_BASE64_BYTES * 3) / 4); // base64 系数 4/3
const SHARP_MAX_DIMENSION = 2048; // 最长边缩放到 2048(满足生成模型参考图需求,又不会过于笨重)
const SHARP_MIN_QUALITY = 35; // webp 最低质量阈值,再低就明显糊了

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

/**
 * cacheMediaUrls - 批量缓存媒体 URL
 * @param {AppContext} ctx - 应用上下文
 * @param {string[]} urls - 远程媒体 URL 数组
 * @param {"images"|"videos"} kind - 媒体类型
 * @param {string} taskId - 任务 ID
 * @param {string} projectId - 项目 ID
 * @returns {Promise<string[]>} 本地媒体 URL 数组
 */
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

/**
 * saveUploadedImage - 保存用户上传的图片
 * @param {AppContext} ctx - 应用上下文
 * @param {UploadInput} upload - 上传文件信息（文件名、类型、字节数据）
 * @returns {Promise<StoredUpload>} 存储结果（URL、名称、大小、类型）
 */
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

/**
 * 用 sharp 把图片压缩到指定 base64 字节上限以内。
 * 策略:最长边先缩到 2048,然后转 webp 并按质量梯度(85→70→55→40→35)多次重试,
 * 直到 base64 编码后字节数 ≤ 上限;仍超限说明是源图维度极端(物理上无法缩),
 * 由调用方决定是否回退 / 报错。
 */
async function compressImageForAgnes(
  bytes: Buffer,
  maxBase64Bytes: number
): Promise<{ dataUrl: string; originalBytes: number; compressedBytes: number; contentType: string }> {
  const qualities = [85, 70, 55, 40, SHARP_MIN_QUALITY];
  let best: Buffer | null = null;
  let bestType = "image/webp";
  // 逐档降低 webp 质量,直到 base64 长度满足上限
  for (const quality of qualities) {
    const candidate = await sharp(bytes, { failOn: "none" })
      .rotate() // 自动按 EXIF 旋转,避免竖拍照片上传后被旋转
      .resize({ width: SHARP_MAX_DIMENSION, height: SHARP_MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
      .webp({ quality, effort: 4 })
      .toBuffer();
    if (!best || candidate.length < best.length) {
      best = candidate;
      bestType = "image/webp";
    }
    // base64 长度 ≈ 原始字节 × 4/3(忽略 padding 误差)
    if (Math.ceil(candidate.length * 4 / 3) <= maxBase64Bytes) {
      return {
        dataUrl: `data:${bestType};base64,${candidate.toString("base64")}`,
        originalBytes: bytes.length,
        compressedBytes: candidate.length,
        contentType: bestType,
      };
    }
  }
  // 走到这里说明即使用最低质量 + 最大缩放仍然超限,返回能得到的最小结果
  // (调用方会判定超限并报错,避免传 16MB 触发 API 400)
  return {
    dataUrl: `data:${bestType};base64,${best!.toString("base64")}`,
    originalBytes: bytes.length,
    compressedBytes: best!.length,
    contentType: bestType,
  };
}

/** 判断一个 content-type 是否是 sharp 能处理的图片(排除 svg/ico)。 */
function isCompressibleImageMime(mime: string): boolean {
  return mime.startsWith("image/") && mime !== "image/svg+xml" && mime !== "image/x-icon" && mime !== "image/vnd.microsoft.icon";
}

/**
 * resolveMediaInput - 将本地媒体 URL 转换为 data URL
 * 对超过 Agnes 10MB 限制的图片自动用 sharp 压缩。
 * @param {AppContext} ctx - 应用上下文
 * @param {string|undefined} value - 本地媒体 URL
 * @returns {Promise<string|undefined>} data URL 或原始值
 */
export async function resolveMediaInput(ctx: AppContext, value: string | undefined): Promise<string | undefined> {
  if (!value) return undefined;
  const target = await localMediaPath(ctx, value);
  if (!target) return value;
  const bytes = await readFile(target);
  const mime = contentTypeFromExtension(path.extname(target));

  // sharp 不能处理的格式(svg/ico 等):原样返回,让 Agnes 自己决定
  if (!isCompressibleImageMime(mime)) {
    return `data:${mime};base64,${bytes.toString("base64")}`;
  }

  // 估算 base64 长度:原始 × 4/3
  const estimatedBase64 = Math.ceil(bytes.length * 4 / 3);
  if (estimatedBase64 <= AGNES_IMAGE_MAX_BASE64_BYTES) {
    // 已满足:跳过压缩,保留原画质
    return `data:${mime};base64,${bytes.toString("base64")}`;
  }

  // 超限:用 sharp 压缩
  try {
    const compressed = await compressImageForAgnes(bytes, AGNES_IMAGE_MAX_BASE64_BYTES);
    const compressedBase64 = Math.ceil(compressed.compressedBytes * 4 / 3);
    if (compressedBase64 > AGNES_IMAGE_MAX_BASE64_BYTES) {
      // 物理上已经无法压到 9MB(base64 后)以内(源图维度/复杂度极端)
      rootLogger.warn(
        {
          event: "media.compress.oversize",
          sourcePath: target,
          sourceBytes: compressed.originalBytes,
          compressedBytes: compressed.compressedBytes,
          compressedBase64,
          limitBase64: AGNES_IMAGE_MAX_BASE64_BYTES,
        },
        "参考图无法压缩到 Agnes 9MB（base64）以内，调用 API 时大概率会返回 400",
      );
    } else {
      rootLogger.info(
        {
          event: "media.compress.success",
          sourcePath: target,
          sourceBytes: compressed.originalBytes,
          compressedBytes: compressed.compressedBytes,
          ratio: (compressed.compressedBytes / compressed.originalBytes).toFixed(2),
        },
        "参考图已压缩到 Agnes 9MB 限制内",
      );
    }
    return compressed.dataUrl;
  } catch (err) {
    // sharp 失败(GIF/损坏图):降级用原图,让 API 自己报错给用户看
    rootLogger.warn(
      { event: "media.compress.failed", sourcePath: target, mime, err },
      "sharp 压缩失败，回退到原图（Agnes API 可能返回 400）",
    );
    return `data:${mime};base64,${bytes.toString("base64")}`;
  }
}

/**
 * resolveMediaInputs - 批量解析参考图输入
 * @param {AppContext} ctx - 应用上下文
 * @param {string[]} values - 本地媒体 URL 数组
 * @returns {Promise<string[]>} 解析后的 data URL 数组（过滤空值）
 */
export async function resolveMediaInputs(ctx: AppContext, values: string[]): Promise<string[]> {
  const resolved: string[] = [];
  for (const value of values) {
    const next = await resolveMediaInput(ctx, value);
    if (next) resolved.push(next);
  }
  return resolved;
}
