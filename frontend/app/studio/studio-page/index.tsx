"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Archive,
  Check,
  Copy,
  Download,
  Eye,
  ExternalLink,
  Folder,
  FolderOpen,
  ImagePlus,
  Loader2,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Pin,
  Plus,
  RefreshCw,
  Send,
  Share2,
  Star,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

type Mode = "chat" | "image" | "video" | "favorites";
type Status = "pending" | "processing" | "success" | "failed";
type DraftStatus = "idle" | "restored" | "saving" | "saved" | "unavailable";

const STUDIO_DRAFT_PREFIX = "manju:studio-draft:v1";

/** 草稿按会话和创作类型隔离，避免切换聊天/图片/视频时提示词串台。 */
function studioDraftKey(conversationId: string, mode: Mode): string {
  if (!conversationId || mode === "favorites") return "";
  return `${STUDIO_DRAFT_PREFIX}:${conversationId}:${mode}`;
}

interface Conversation {
  id: string;
  title: string;
  is_pinned: boolean;
  project_id: string;
}

interface Project {
  id: string;
  name: string;
  is_default: boolean;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  storage_path: string;
  storage_mode: string;
  archived_at: string;
}

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  created_at?: string;
  meta?: {
    attachments?: MessageAttachment[];
  };
}

interface ImageTask {
  id: string;
  conversation_id: string;
  prompt: string;
  image_urls: string[];
  status: Status;
  error: string;
  created_at: string;
}

interface VideoTask {
  id: string;
  conversation_id: string;
  prompt: string;
  video_url: string;
  status: Status;
  error: string;
  created_at: string;
}

interface Favorite {
  id: string;
  type: "chat" | "image" | "video";
  ref_id: string;
  created_at: string;
}

interface FavoriteView {
  favorite: Favorite;
  image?: ImageTask;
  video?: VideoTask;
}

interface Attachment {
  id: string;
  name: string;
  size: number;
  url: string;
  previewUrl: string;
  status: "uploading" | "success" | "failed";
  error?: string;
}

interface MessageAttachment {
  name: string;
  size: number;
  url: string;
}

interface ImageRequest {
  id: string;
  conversationId: string;
  prompt: string;
  attachments: Attachment[];
  status: "generating" | "success" | "failed";
  task?: ImageTask;
  error?: string;
}

const apiBaseUrl = (process.env.NEXT_PUBLIC_AGNES_BACKEND_URL ?? "").replace(/\/+$/, "");

/** 根据环境变量拼出后端接口地址。 */
function apiUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${apiBaseUrl}${path}`;
}

/** 生成接口候选地址，兼容前端代理和直连后端两种开发方式。 */
function apiCandidates(path: string): string[] {
  if (/^https?:\/\//.test(path)) return [path];
  return [path];
}

/** 调用普通 JSON API，并把后端统一响应解包成 data。 */
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const requestInit = {
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    credentials: "include" as const,
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
  if (!response.ok) throw new Error(payload?.message || `请求失败 ${response.status}`);
  if (payload?.code !== 0) throw new Error(payload?.message || "请求失败");
  return payload.data as T;
}

interface UploadedFile {
  url: string;
  name: string;
  size: number;
  type: string;
}

/** 上传图片附件，返回后端保存后的本地 URL 列表。 */
async function uploadImages(files: File[]): Promise<UploadedFile[]> {
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

/** 判断提示词是否更像“精准裁切/截取”，这类任务不应该交给生图模型重绘。 */
function shouldUseLocalCrop(prompt: string): boolean {
  return /精准截取|严格截取|像素级一致|不做任何创作|不做创作|不做修改|禁止自创|精准取景|裁切|裁剪|截取近景/.test(prompt);
}

/** 把图片 URL 读取成浏览器可绘制的 HTMLImageElement。 */
async function loadImageElement(url: string): Promise<HTMLImageElement> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`图片读取失败 ${response.status}`);
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    return image;
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }
}

/** 从参考图本地裁切 9:16 竖版近景，避免图片模型重新创作人物细节。 */
async function cropReferenceImageToPortrait(file: Pick<UploadedFile, "name" | "url">, prompt: string): Promise<File> {
  const image = await loadImageElement(file.url);
  const sourceWidth = image.naturalWidth;
  const sourceHeight = image.naturalHeight;
  const targetRatio = 9 / 16;
  const isCloseShot = /近景|头部至胸部|胸部|上半身/.test(prompt);
  const preferredHeight = isCloseShot ? Math.round(sourceHeight * 0.58) : sourceHeight;
  const cropHeight = Math.min(sourceHeight, preferredHeight, Math.floor(sourceWidth / targetRatio));
  const cropWidth = Math.min(sourceWidth, Math.floor(cropHeight * targetRatio));
  const cropX = Math.max(0, Math.floor((sourceWidth - cropWidth) / 2));
  const cropY = isCloseShot ? Math.max(0, Math.floor(sourceHeight * 0.04)) : Math.max(0, Math.floor((sourceHeight - cropHeight) / 2));
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("浏览器不支持图片裁切");
  context.fillStyle = "#000";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, cropX, cropY, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error("图片裁切失败")), "image/png", 0.96);
  });
  return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}-crop-9x16.png`, { type: "image/png" });
}

/** 把字节数格式化成 KB/MB，远程图片没有大小时显示远程图片。 */
function formatBytes(bytes: number) {
  if (!bytes) return "远程图片";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** 把任务状态转换成中文文案。 */
function statusText(status: Status) {
  return ({ pending: "排队中", processing: "生成中", success: "已完成", failed: "失败" } as const)[status] ?? status;
}

/** 从一组任务或消息中找出最新创建时间。 */
function newestTime(items: Array<{ created_at?: string }>): number {
  return items.reduce((latest, item) => {
    const time = Date.parse(item.created_at ?? "");
    return Number.isNaN(time) ? latest : Math.max(latest, time);
  }, 0);
}

/** 根据会话里最新的内容类型，自动切换聊天、图片或视频标签。 */
function modeFromConversationContent(messages: Message[], images: ImageTask[], videos: VideoTask[]): Mode {
  const contentTimes: Array<{ mode: Mode; time: number }> = [
    { mode: "chat", time: newestTime(messages) },
    { mode: "image", time: newestTime(images) },
    { mode: "video", time: newestTime(videos) },
  ];
  const candidates = contentTimes.filter((item) => item.time > 0);
  candidates.sort((a, b) => b.time - a.time);
  return candidates[0]?.mode ?? (videos.length ? "video" : images.length ? "image" : "chat");
}

/** 从消息 meta 中取出图片附件，过滤掉不完整数据。 */
function messageAttachments(message: Message): MessageAttachment[] {
  const items = Array.isArray(message.meta?.attachments) ? message.meta.attachments : [];
  return items.filter((item): item is MessageAttachment => Boolean(item?.url && item?.name));
}

interface PortraitImageLinkProps {
  href: string;
  src: string;
  alt: string;
  onLoad?: () => void;
}

/** 用 9:16 竖版框展示图片，图片本身等比缩放不拉伸。 */
function PortraitImageLink({ href, src, alt, onLoad }: PortraitImageLinkProps) {
  return (
    <a
      className="mx-auto block aspect-[9/16] max-h-[72vh] overflow-hidden bg-[#171717]"
      style={{ width: "min(100%, calc(72vh * 9 / 16))" }}
      href={href}
      target="_blank"
      rel="noreferrer"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="h-full w-full cursor-zoom-in object-contain" src={src} alt={alt} onLoad={onLoad} />
    </a>
  );
}

/** 主页面，承载会话列表、聊天、图片生成、视频生成和收藏视图。 */
export default function Home() {
  const [mode, setMode] = useState<Mode>("chat");
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectScope, setProjectScope] = useState("all");
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [projectCreateMenuOpen, setProjectCreateMenuOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [prompt, setPrompt] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [images, setImages] = useState<ImageTask[]>([]);
  const [imageRequests, setImageRequests] = useState<ImageRequest[]>([]);
  const [videos, setVideos] = useState<VideoTask[]>([]);
  const [favorites, setFavorites] = useState<FavoriteView[]>([]);
  const [runningVideoConversationIds, setRunningVideoConversationIds] = useState<string[]>([]);
  const [conversationMenuId, setConversationMenuId] = useState("");
  const [projectActionMenuId, setProjectActionMenuId] = useState("");
  const [submittingConversationIds, setSubmittingConversationIds] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [draftStatus, setDraftStatus] = useState<DraftStatus>("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const conversationIdRef = useRef("");
  const noticeTimerRef = useRef<number | null>(null);
  const promptRef = useRef("");
  const previousDraftKeyRef = useRef("");
  const skipNextDraftSaveRef = useRef(false);
  const activeDraftKeyRef = useRef("");
  const emptyConversationCreationRef = useRef<Promise<Conversation> | null>(null);

  const selectedProject = projects.find((project) => project.id === projectScope);
  const projectScopeLabel = projectScope === "all" ? "全部项目" : projectScope === "" ? "不使用项目" : selectedProject?.name ?? "项目";
  const currentConversationSubmitting = submittingConversationIds.includes(conversationId);
  const activeDraftKey = studioDraftKey(conversationId, mode);
  activeDraftKeyRef.current = activeDraftKey;

  /** 显示顶部临时提示，并在短时间后自动清空。 */
  function showNotice(message: string) {
    setNotice(message);
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => setNotice(""), 2200);
  }

  /** 把消息展示区滚动到底部，保证最新内容可见。 */
  function scrollToLatest() {
    const target = scrollRef.current;
    if (!target) return;
    window.requestAnimationFrame(() => {
      target.scrollTo({ top: target.scrollHeight });
      window.requestAnimationFrame(() => target.scrollTo({ top: target.scrollHeight }));
    });
    window.setTimeout(() => target.scrollTo({ top: target.scrollHeight }), 250);
  }

  /** 加载项目列表，供侧边栏项目选择器使用。 */
  async function loadProjects() {
    try {
      const items = await api<Project[]>("/api/projects");
      setProjects(items);
      return items;
    } catch (error) {
      setNotice((error as Error).message || "项目列表加载失败");
      return [];
    }
  }

  /** 按当前项目范围加载会话列表，没有会话时自动创建一个。 */
  async function loadConversations(preferredId = "", scope = projectScope) {
    try {
      let items = await api<Conversation[]>(`/api/conversations?projectId=${encodeURIComponent(scope)}`);
      if (!items.length) {
        if (!emptyConversationCreationRef.current) {
          emptyConversationCreationRef.current = api<Conversation>("/api/conversations", {
            method: "POST",
            body: JSON.stringify({ project_id: scope === "all" ? "" : scope }),
          });
        }
        const pendingCreation = emptyConversationCreationRef.current;
        let created: Conversation;
        try {
          created = await pendingCreation;
        } finally {
          if (emptyConversationCreationRef.current === pendingCreation) emptyConversationCreationRef.current = null;
        }
        items = [created];
      }
      const sharedId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("conversationId") ?? "" : "";
      setConversations(items);
      setConversationId((current) => {
        const candidate = preferredId || current || sharedId || items[0]?.id || "";
        return items.some((item) => item.id === candidate) ? candidate : items[0]?.id || "";
      });
    } catch (error) {
      setNotice((error as Error).message || "会话列表加载失败");
    }
  }

  /** 加载指定会话的聊天消息。 */
  async function loadMessages(id = conversationId) {
    if (!id) return [];
    try {
      const next = await api<Message[]>(`/api/conversations/${id}/messages`);
      setMessages(next);
      return next;
    } catch (error) {
      setNotice((error as Error).message || "消息加载失败");
      return [];
    }
  }

  /** 加载指定会话的图片生成任务。 */
  async function loadImages(id = conversationId) {
    if (!id) {
      setImages([]);
      return [];
    }
    try {
      const next = await api<ImageTask[]>(`/api/images?conversationId=${encodeURIComponent(id)}`);
      setImages(next);
      return next;
    } catch (error) {
      setNotice((error as Error).message || "图片列表加载失败");
      return [];
    }
  }

  /** 加载并刷新指定会话的视频任务状态。 */
  async function loadVideos(id = conversationId) {
    if (!id) {
      if (!conversationIdRef.current) setVideos([]);
      return [];
    }
    try {
      const tasks = await api<VideoTask[]>(`/api/videos?conversationId=${encodeURIComponent(id)}`);
      const next = await Promise.all(tasks.map((task) => ["pending", "processing"].includes(task.status) ? api<VideoTask>(`/api/videos/${task.id}`) : task));
      setRunningVideoConversationIds((items) => {
        const hasRunning = next.some((video) => ["pending", "processing"].includes(video.status));
        if (hasRunning && !items.includes(id)) return [...items, id];
        if (!hasRunning && items.includes(id)) return items.filter((item) => item !== id);
        return items;
      });
      if (conversationIdRef.current === id) setVideos(next);
      return next;
    } catch (error) {
      setNotice((error as Error).message || "视频列表加载失败");
      return [];
    }
  }

  /** 加载收藏列表，并补全收藏指向的图片或视频详情。 */
  async function loadFavorites() {
    try {
      const items = await api<Favorite[]>("/api/favorites");
      const resolved = await Promise.all(items.map(async (favoriteItem): Promise<FavoriteView> => {
        try {
          if (favoriteItem.type === "image") {
            return { favorite: favoriteItem, image: await api<ImageTask>(`/api/images/${favoriteItem.ref_id}`) };
          }
          if (favoriteItem.type === "video") {
            return { favorite: favoriteItem, video: await api<VideoTask>(`/api/videos/${favoriteItem.ref_id}`) };
          }
        } catch {
          return { favorite: favoriteItem };
        }
        return { favorite: favoriteItem };
      }));
      setFavorites(resolved);
      return resolved;
    } catch (error) {
      setNotice((error as Error).message || "收藏列表加载失败");
      return [];
    }
  }

  /** 切换当前会话，并同步加载消息、图片和视频内容。 */
  async function selectConversation(id: string) {
    setConversationId(id);
    conversationIdRef.current = id;
    setAttachments([]);
    setNotice("");
    const [nextMessages, nextImages, nextVideos] = await Promise.all([
      loadMessages(id),
      loadImages(id),
      loadVideos(id),
    ]);
    setMode(modeFromConversationContent(nextMessages, nextImages, nextVideos));
  }

  useEffect(() => {
    void loadProjects();
    void loadConversations();
  }, []);

  useEffect(() => {
    void loadConversations("", projectScope);
  }, [projectScope]);

  useEffect(() => {
    setAttachments([]);
    conversationIdRef.current = conversationId;
    void loadMessages(conversationId);
    void loadImages(conversationId);
    void loadVideos(conversationId);
  }, [conversationId]);

  useEffect(() => {
    if (mode === "favorites") void loadFavorites();
  }, [mode]);

  useEffect(() => {
    scrollToLatest();
  }, [conversationId, mode, messages, imageRequests, images, videos]);

  useEffect(() => {
    if (!runningVideoConversationIds.length) return;
    const timer = window.setInterval(() => {
      for (const id of runningVideoConversationIds) void loadVideos(id);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [runningVideoConversationIds]);

  useEffect(() => {
    promptRef.current = prompt;
  }, [prompt]);

  /** 切换会话或创作类型时先保存旧稿，再无打扰地恢复对应草稿。 */
  useEffect(() => {
    const previousKey = previousDraftKeyRef.current;
    if (previousKey && previousKey !== activeDraftKey) {
      try {
        const previousPrompt = promptRef.current.trim();
        if (previousPrompt) window.localStorage.setItem(previousKey, promptRef.current);
        else window.localStorage.removeItem(previousKey);
      } catch {
        // 隐私模式或存储被禁用时仍允许正常创作。
      }
    }

    previousDraftKeyRef.current = activeDraftKey;
    if (!activeDraftKey) return;

    try {
      const restored = window.localStorage.getItem(activeDraftKey) ?? "";
      skipNextDraftSaveRef.current = true;
      promptRef.current = restored;
      setPrompt(restored);
      setDraftStatus(restored.trim() ? "restored" : "idle");
    } catch {
      setDraftStatus("unavailable");
    }
  }, [activeDraftKey]);

  /** 输入停顿后保存，减少写入频率，同时给用户明确但低调的安心反馈。 */
  useEffect(() => {
    if (!activeDraftKey) return;
    if (skipNextDraftSaveRef.current) {
      skipNextDraftSaveRef.current = false;
      return;
    }
    setDraftStatus(prompt.trim() ? "saving" : "idle");
    const timer = window.setTimeout(() => {
      try {
        if (prompt.trim()) {
          window.localStorage.setItem(activeDraftKey, prompt);
          setDraftStatus("saved");
        } else {
          window.localStorage.removeItem(activeDraftKey);
          setDraftStatus("idle");
        }
      } catch {
        setDraftStatus("unavailable");
      }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [activeDraftKey, prompt]);

  /** 主动清空当前文字与本地草稿，避免用户需要逐字删除。 */
  function clearCurrentDraft() {
    setPrompt("");
    promptRef.current = "";
    if (activeDraftKey) {
      try {
        window.localStorage.removeItem(activeDraftKey);
      } catch {
        // 清空输入本身不应被存储异常阻断。
      }
    }
    setDraftStatus("idle");
  }

  /** 请求失败时把文字与附件交还给仍停留在原编辑器的用户，并始终保留文字草稿。 */
  function restoreFailedSubmission(text: string, draftKey: string, attachmentSnapshot: Attachment[]) {
    let stored = false;
    if (draftKey) {
      try {
        window.localStorage.setItem(draftKey, text);
        stored = true;
      } catch {
        // 页面内恢复仍然可用。
      }
    }
    if (activeDraftKeyRef.current !== draftKey) return;
    setPrompt(text);
    promptRef.current = text;
    setAttachments(attachmentSnapshot);
    setDraftStatus(stored ? "saved" : "unavailable");
  }

  /** 校验并上传图片附件，然后在输入框上方显示预览。 */
  async function addFiles(files: FileList | File[]) {
    const validFiles: File[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) {
        setNotice("只支持图片附件");
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        setNotice("单张图片不能超过 10MB");
        continue;
      }
      validFiles.push(file);
    }
    const remaining = Math.max(0, 8 - attachments.length);
    const nextFiles = validFiles.slice(0, remaining);
    if (nextFiles.length === 0) return;
    const pendingAttachments = nextFiles.map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      url: "",
      previewUrl: URL.createObjectURL(file),
      status: "uploading" as const,
    }));
    setAttachments((items) => [...items, ...pendingAttachments].slice(0, 8));
    setNotice("正在上传图片...");
    try {
      const uploaded = await uploadImages(nextFiles);
      setAttachments((items) => items.map((item) => {
        const index = pendingAttachments.findIndex((pending) => pending.id === item.id);
        if (index < 0) return item;
        const file = uploaded[index];
        if (!file) return { ...item, status: "failed", error: "上传失败" };
        URL.revokeObjectURL(item.previewUrl);
        return {
          ...item,
          name: file.name,
          size: file.size,
          url: file.url,
          previewUrl: file.url,
          status: "success",
          error: undefined,
        };
      }));
      setNotice("图片已上传");
    } catch (error) {
      setAttachments((items) => items.map((item) => pendingAttachments.some((pending) => pending.id === item.id)
        ? { ...item, status: "failed", error: (error as Error).message || "上传失败" }
        : item));
      setNotice((error as Error).message || "上传失败");
    }
  }

  /** 发送聊天消息，并消费 SSE 流式响应更新最后一条助手消息。 */
  async function sendChat(text: string, readyAttachments: Attachment[] = []) {
    const targetConversationId = conversationId;
    if (!targetConversationId) return;
    const messageFiles = readyAttachments.map((attachment) => ({
      name: attachment.name,
      size: attachment.size,
      url: attachment.url,
    }));
    if (conversationIdRef.current === targetConversationId) {
      setMessages((items) => [
        ...items,
        { role: "user", content: text, meta: { attachments: messageFiles } },
        { role: "assistant", content: "" },
      ]);
    }
    let response: Response | null = null;
    let networkError: unknown = null;
    for (const url of apiCandidates("/api/chat")) {
      try {
        response = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ conversationId: targetConversationId, message: text, attachments: messageFiles }),
        });
        break;
      } catch (error) {
        networkError = error;
      }
    }
    if (!response) {
      throw new Error(`无法连接后端服务，请确认 start-all.bat 已启动后端。${networkError instanceof Error ? ` ${networkError.message}` : ""}`.trim());
    }
    const reader = response.body?.getReader();
    if (!reader) return;
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() || "";
      for (const event of events) {
        const line = event.split("\n").find((part) => part.startsWith("data: "));
        if (!line) continue;
        const chunk = JSON.parse(line.slice(6));
        if (conversationIdRef.current !== targetConversationId) continue;
        setMessages((items) => {
          const next = [...items];
          const last = next[next.length - 1];
          next[next.length - 1] = { ...last, content: `${last.content}${chunk.content || ""}` };
          return next;
        });
      }
    }
    if (conversationIdRef.current === targetConversationId) await loadMessages(targetConversationId);
  }

  /** 根据当前模式提交聊天、图片生成或视频生成请求。 */
  async function submit() {
    const text = prompt.trim();
    if (!text) return;
    const targetConversationId = conversationId;
    const targetDraftKey = activeDraftKey;
    if (!targetConversationId) return;
    if (submittingConversationIds.includes(targetConversationId)) return;
    const attachmentSnapshot = attachments;
    const readyAttachments = attachmentSnapshot.filter((attachment) => attachment.status === "success" && attachment.url);
    if (attachmentSnapshot.some((attachment) => attachment.status === "uploading")) {
      setNotice("图片还在上传，请稍等");
      return;
    }
    if (attachmentSnapshot.some((attachment) => attachment.status === "failed")) {
      setNotice("有图片上传失败，请移除后重新上传");
      return;
    }
    setPrompt("");
    promptRef.current = "";
    if (activeDraftKey) {
      try {
        window.localStorage.removeItem(activeDraftKey);
      } catch {
        // 发送成功路径不依赖本地存储。
      }
    }
    setDraftStatus("idle");
    setSubmittingConversationIds((items) => items.includes(targetConversationId) ? items : [...items, targetConversationId]);
    setNotice("");
    try {
      if (mode === "chat") {
        setAttachments([]);
        await sendChat(text, readyAttachments);
      }
      if (mode === "image") {
        const requestId = crypto.randomUUID();
        setAttachments([]);
        setImageRequests((items) => [...items, {
          id: requestId,
          conversationId: targetConversationId,
          prompt: text,
          attachments: attachmentSnapshot,
          status: "generating",
        }]);
        setNotice("正在生成图片...");
        try {
          let task: ImageTask;
          if (shouldUseLocalCrop(text) && readyAttachments.length > 0) {
            setNotice("正在按参考图本地裁切...");
            const cropped = await cropReferenceImageToPortrait(readyAttachments[0], text);
            const [stored] = await uploadImages([cropped]);
            task = await api<ImageTask>("/api/images/local", {
              method: "POST",
              body: JSON.stringify({ prompt: text, conversationId: targetConversationId, image_urls: [stored.url] }),
            });
          } else {
            task = await api<ImageTask>("/api/images/generate", {
              method: "POST",
              body: JSON.stringify({
                prompt: text,
                conversationId: targetConversationId,
                size: "1024x768",
                ratio: "1:1",
                n: 1,
                images: readyAttachments.map((attachment) => attachment.url),
              }),
            });
          }
          setImageRequests((items) => items.map((item) => item.id === requestId ? { ...item, status: "success", task } : item));
          await loadImages();
          setNotice("图片已生成");
        } catch (error) {
          setImageRequests((items) => items.map((item) => item.id === requestId ? { ...item, status: "failed", error: (error as Error).message || "图片生成失败" } : item));
          restoreFailedSubmission(text, targetDraftKey, attachmentSnapshot);
          setNotice((error as Error).message || "图片生成失败");
        }
      }
      if (mode === "video") {
        setNotice("正在提交视频任务...");
        setAttachments([]);
        await api<VideoTask>("/api/videos/generate", {
          method: "POST",
          body: JSON.stringify({ prompt: text, conversationId: targetConversationId, image: readyAttachments[0]?.url, ratio: "16:9", duration: 5 }),
        });
        setRunningVideoConversationIds((items) => !items.includes(targetConversationId) ? [...items, targetConversationId] : items);
        await loadVideos();
        setNotice("视频任务已提交");
      }
    } catch (error) {
      restoreFailedSubmission(text, targetDraftKey, attachmentSnapshot);
      setNotice((error as Error).message || "提交失败，请稍后重试");
    } finally {
      setSubmittingConversationIds((items) => items.filter((id) => id !== targetConversationId));
      await loadConversations("", projectScope);
    }
  }

  /** 复制文本到剪贴板，失败时退回到传统 textarea 复制方式。 */
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      showNotice("链接已复制");
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand("copy");
      textarea.remove();
      showNotice(ok ? "链接已复制" : "复制失败，请手动复制");
    }
  }

  /** 收藏图片或视频任务。 */
  async function favorite(type: "image" | "video", refId: string) {
    try {
      await api("/api/favorites", { method: "POST", body: JSON.stringify({ type, ref_id: refId }) });
      if (mode === "favorites") await loadFavorites();
      showNotice("已收藏");
    } catch (error) {
      showNotice((error as Error).message || "收藏失败");
    }
  }

  /** 从收藏列表中移除指定收藏。 */
  async function removeFavorite(favoriteId: string) {
    await api(`/api/favorites/${favoriteId}`, { method: "DELETE" });
    await loadFavorites();
    showNotice("已取消收藏");
  }

  /** 创建项目，并按选择的模式绑定项目存储目录。 */
  async function createProjectItem(storageMode: "managed" | "existing") {
    const name = window.prompt("项目名称")?.trim();
    if (!name) return;
    const storagePath =
      storageMode === "existing"
        ? window.prompt("输入或粘贴项目文件夹名称/相对路径，例如：manju 或 客户A/短剧项目")?.trim()
        : "";
    if (storageMode === "existing" && !storagePath) return;
    const project = await api<Project>("/api/projects", {
      method: "POST",
      body: JSON.stringify({ name, storage_mode: storageMode, storage_path: storagePath }),
    });
    await loadProjects();
    setProjectScope(project.id);
    setProjectMenuOpen(false);
    setProjectCreateMenuOpen(false);
    showNotice("项目已创建");
  }

  /** 切换项目置顶状态，并刷新项目和会话分组。 */
  async function togglePinProject(project: Project) {
    await api<Project>(`/api/projects/${project.id}`, {
      method: "PUT",
      body: JSON.stringify({ is_pinned: !project.is_pinned }),
    });
    setProjectActionMenuId("");
    await loadProjects();
    await loadConversations(conversationId, projectScope);
    showNotice(project.is_pinned ? "已取消置顶项目" : "已置顶项目");
  }

  /** 请求后端在本机资源管理器中打开项目目录。 */
  async function openProjectFolder(project: Project) {
    await api(`/api/projects/${project.id}/open-folder`, { method: "POST", body: JSON.stringify({}) });
    setProjectActionMenuId("");
    showNotice("已打开项目文件夹");
  }

  /** 在指定项目下创建新会话，并保持当前项目列表视图不被收窄。 */
  async function createConversationInProject(project: Project) {
    const created = await api<Conversation>("/api/conversations", {
      method: "POST",
      body: JSON.stringify({ title: "新的创作会话", project_id: project.id }),
    });
    setProjectActionMenuId("");
    setConversationId(created.id);
    conversationIdRef.current = created.id;
    await loadConversations(created.id, projectScope);
    showNotice("已创建新会话");
  }

  /** 弹出输入框重命名项目。 */
  async function renameProject(project: Project) {
    const name = window.prompt("重命名项目", project.name)?.trim();
    if (!name || name === project.name) {
      setProjectActionMenuId("");
      return;
    }
    await api<Project>(`/api/projects/${project.id}`, {
      method: "PUT",
      body: JSON.stringify({ name }),
    });
    setProjectActionMenuId("");
    await loadProjects();
    await loadConversations(conversationId, projectScope);
    showNotice("已重命名项目");
  }

  /** 软归档项目下的对话，让它们从项目列表和全部项目中隐藏。 */
  async function archiveProject(project: Project) {
    if (!window.confirm(`归档项目“${project.name}”下的对话？`)) return;
    await api<Project>(`/api/projects/${project.id}`, {
      method: "PUT",
      body: JSON.stringify({ archived_at: new Date().toISOString() }),
    });
    setProjectActionMenuId("");
    if (projectScope === project.id) setProjectScope("all");
    await loadProjects();
    await loadConversations("", projectScope === project.id ? "all" : projectScope);
    showNotice("已归档对话");
  }

  /** 移除项目归属，项目下的会话会变为不使用项目。 */
  async function removeProject(project: Project) {
    if (!window.confirm(`移除项目“${project.name}”？项目下的会话会转为不使用项目。`)) return;
    await api(`/api/projects/${project.id}`, { method: "DELETE" });
    setProjectActionMenuId("");
    if (projectScope === project.id) setProjectScope("all");
    await loadProjects();
    await loadConversations("", projectScope === project.id ? "all" : projectScope);
    showNotice("已移除项目");
  }

  /** 在新标签页打开图片详情页。 */
  function openImageDetail(taskId: string, index: number) {
    window.open(`/images/${taskId}?index=${index}`, "_blank", "noopener,noreferrer");
  }

  /** 在新标签页打开原始媒体地址。 */
  function openRawMedia(url: string) {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  /** 下载图片或视频，跨域失败时退回到打开原链接。 */
  async function downloadMedia(url: string, filename: string) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
      setNotice("已开始下载");
    } catch {
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setNotice("已打开下载链接");
    }
  }

  /** 把已生成图片放回输入编辑器附件区，方便继续编辑。 */
  function continueEditImage(url: string) {
    setMode("image");
    setAttachments((items) => [...items, { id: crypto.randomUUID(), name: "已生成图片", size: 0, url, previewUrl: url, status: "success" as const }].slice(0, 8));
    setNotice("已加入输入编辑器，可继续编辑");
  }

  /** 删除图片任务记录并刷新当前图片列表。 */
  async function deleteImage(taskId: string) {
    await api(`/api/images/${taskId}`, { method: "DELETE" });
    await loadImages();
    setNotice("已删除图片");
  }

  /** 切换历史会话的置顶状态。 */
  async function togglePinConversation(conversation: Conversation) {
    await api<Conversation>(`/api/conversations/${conversation.id}`, {
      method: "PUT",
      body: JSON.stringify({ is_pinned: !conversation.is_pinned }),
    });
    setConversationMenuId("");
    await loadConversations(conversationId, projectScope);
    setNotice(conversation.is_pinned ? "已取消置顶" : "已置顶");
  }

  /** 复制当前会话的分享链接。 */
  async function shareConversation(conversation: Conversation) {
    const url = `${window.location.origin}/?conversationId=${encodeURIComponent(conversation.id)}`;
    await navigator.clipboard.writeText(url);
    setConversationMenuId("");
    setNotice("会话链接已复制");
  }

  /** 弹出输入框重命名历史会话。 */
  async function renameConversation(conversation: Conversation) {
    const title = window.prompt("重命名会话", conversation.title)?.trim();
    if (!title || title === conversation.title) {
      setConversationMenuId("");
      return;
    }
    await api<Conversation>(`/api/conversations/${conversation.id}`, {
      method: "PUT",
      body: JSON.stringify({ title }),
    });
    setConversationMenuId("");
    await loadConversations(conversationId, projectScope);
    setNotice("已重命名");
  }

  /** 占位举报入口，本地版本只提示暂不支持。 */
  function reportConversation() {
    setConversationMenuId("");
    setNotice("本地版本暂不支持举报提交");
  }

  /** 删除会话以及它关联的消息、图片、视频和收藏记录。 */
  async function deleteConversationItem(conversation: Conversation) {
    if (!window.confirm(`删除会话“${conversation.title}”？`)) return;
    await api(`/api/conversations/${conversation.id}`, { method: "DELETE" });
    setConversationMenuId("");
    const nextId = conversation.id === conversationId ? conversations.find((item) => item.id !== conversation.id)?.id ?? "" : conversationId;
    if (!nextId) {
      setImages([]);
      setVideos([]);
      setMessages([]);
    }
    setConversationId(nextId);
    await loadConversations(nextId, projectScope);
    setNotice("已删除会话");
  }

  const currentImageRequests = imageRequests.filter((request) => request.conversationId === conversationId);
  const requestTaskIds = new Set(currentImageRequests.map((request) => request.task?.id).filter(Boolean));
  const visibleImages = images.filter((task) => !requestTaskIds.has(task.id));
  const visibleImagesChronological = [...visibleImages].reverse();
  const projectById = new Map(projects.map((project) => [project.id, project]));
  /** 按项目把历史会话分组，供侧边栏展示。 */
  const conversationGroups = (() => {
    /** 根据项目 ID 查找侧边栏分组名称。 */
    const projectName = (projectId: string) => projectId
      ? projectById.get(projectId)?.name ?? "未知项目"
      : "不使用项目";
    const grouped = new Map<string, { id: string; name: string; items: Conversation[] }>();
    for (const conversation of conversations) {
      const groupId = conversation.project_id || "";
      const group = grouped.get(groupId) ?? { id: groupId, name: projectName(groupId), items: [] };
      group.items.push(conversation);
      grouped.set(groupId, group);
    }
    if (projectScope !== "all" && conversations.length === 0) {
      return [{ id: projectScope, name: projectName(projectScope), items: [] }];
    }
    return Array.from(grouped.values()).sort((left, right) => {
      if (left.id === projectScope) return -1;
      if (right.id === projectScope) return 1;
      const leftProject = projectById.get(left.id);
      const rightProject = projectById.get(right.id);
      if (Number(leftProject?.is_pinned ?? false) !== Number(rightProject?.is_pinned ?? false)) {
        return Number(rightProject?.is_pinned ?? false) - Number(leftProject?.is_pinned ?? false);
      }
      if (left.id === "") return 1;
      if (right.id === "") return -1;
      return left.name.localeCompare(right.name, "zh-Hans");
    });
  })();

  return (
    <main className="grid h-screen grid-cols-[260px_1fr] overflow-hidden bg-[#212121] text-[#ececec] max-md:grid-cols-1">
      <aside className="flex min-h-0 flex-col border-r border-white/10 bg-[#171717] p-3 max-md:hidden">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold">Agnes AI Studio</div>
          <Button size="icon" variant="ghost" onClick={async () => {
            const created = await api<Conversation>("/api/conversations", { method: "POST", body: JSON.stringify({ title: "新的创作会话", project_id: projectScope === "all" ? "" : projectScope }) });
            setConversationId(created.id);
            await loadConversations(created.id, projectScope);
          }}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="relative mb-3">
          <button
            className="flex w-full items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#202020] px-3 py-2 text-left text-sm hover:bg-white/5"
            onClick={() => setProjectMenuOpen((open) => !open)}
          >
            <span className="flex min-w-0 items-center gap-2">
              <Folder className="h-4 w-4 shrink-0 text-[#b4b4b4]" />
              <span className="truncate">{projectScopeLabel}</span>
            </span>
            <MoreHorizontal className="h-4 w-4 text-[#b4b4b4]" />
          </button>
          {projectMenuOpen && (
            <div className="absolute left-0 right-0 top-11 z-50 rounded-xl border border-white/10 bg-[#2f2f2f] p-1 text-sm shadow-2xl">
              {[
                { id: "all", name: "全部项目" },
                { id: "", name: "不使用项目" },
              ].map((item) => (
                <button
                  key={item.name}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left hover:bg-white/10"
                  onClick={() => {
                    setProjectScope(item.id);
                    setProjectMenuOpen(false);
                    setProjectCreateMenuOpen(false);
                  }}
                >
                  <span className="truncate">{item.name}</span>
                  {projectScope === item.id && <Check className="h-4 w-4" />}
                </button>
              ))}
              <div className="my-1 h-px bg-white/10" />
              {projects.map((project) => (
                <button
                  key={project.id}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left hover:bg-white/10"
                  onClick={() => {
                    setProjectScope(project.id);
                    setProjectMenuOpen(false);
                    setProjectCreateMenuOpen(false);
                  }}
                >
                  <span className="min-w-0">
                    <span className="block truncate">{project.name}</span>
                    {project.storage_path && <span className="block truncate text-[11px] text-[#b4b4b4]">{project.storage_path}</span>}
                  </span>
                  {projectScope === project.id && <Check className="h-4 w-4" />}
                </button>
              ))}
              <div className="my-1 h-px bg-white/10" />
              <div className="relative">
                <button
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left hover:bg-white/10"
                  onClick={() => setProjectCreateMenuOpen((open) => !open)}
                >
                  <span className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />新建项目
                  </span>
                  <span className="text-[#b4b4b4]">›</span>
                </button>
                {projectCreateMenuOpen && (
                  <div className="absolute bottom-0 left-full z-50 ml-2 w-52 rounded-xl border border-white/10 bg-[#2f2f2f] p-1 shadow-2xl">
                    <button
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-white/10"
                      onClick={() => void createProjectItem("managed")}
                    >
                      <Plus className="h-4 w-4" />新建空白项目
                    </button>
                    <button
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-white/10"
                      onClick={() => void createProjectItem("existing")}
                    >
                      <Folder className="h-4 w-4" />使用现有文件夹
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-auto">
          {conversationGroups.map((group) => (
            <div key={group.id || "unassigned"} className="space-y-1">
              <div className="group/project relative flex items-center gap-2 rounded-lg px-2 py-1 text-xs font-medium text-[#b4b4b4] hover:bg-white/5">
                <Folder className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{projectById.get(group.id)?.is_pinned ? "★ " : ""}{group.name}</span>
                {group.id && projectById.has(group.id) && (
                  <button
                    aria-label="打开项目操作菜单"
                    className={`ml-auto grid h-6 w-6 shrink-0 place-items-center rounded-md hover:bg-white/10 hover:text-white ${projectActionMenuId === group.id ? "opacity-100" : "opacity-0 group-hover/project:opacity-100"}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      setConversationMenuId("");
                      setProjectActionMenuId((current) => current === group.id ? "" : group.id);
                    }}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                )}
                {group.id && projectActionMenuId === group.id && projectById.get(group.id) && (
                  <div className="absolute right-1 top-8 z-50 w-48 rounded-xl border border-white/10 bg-[#2f2f2f] p-1 text-sm text-[#ececec] shadow-2xl">
                    <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-white/10" onClick={() => void createConversationInProject(projectById.get(group.id) as Project)}>
                      <Plus className="h-4 w-4" />创建新会话
                    </button>
                    <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-white/10" onClick={() => void togglePinProject(projectById.get(group.id) as Project)}>
                      <Pin className="h-4 w-4" />{projectById.get(group.id)?.is_pinned ? "取消置顶项目" : "置顶项目"}
                    </button>
                    <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-white/10" onClick={() => void openProjectFolder(projectById.get(group.id) as Project)}>
                      <FolderOpen className="h-4 w-4" />在资源管理器中打开
                    </button>
                    <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-white/10" onClick={() => void renameProject(projectById.get(group.id) as Project)}>
                      <Pencil className="h-4 w-4" />重命名项目
                    </button>
                    <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-white/10" onClick={() => void archiveProject(projectById.get(group.id) as Project)}>
                      <Archive className="h-4 w-4" />归档对话
                    </button>
                    <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-red-300 hover:bg-red-500/10" onClick={() => void removeProject(projectById.get(group.id) as Project)}>
                      <X className="h-4 w-4" />移除
                    </button>
                  </div>
                )}
              </div>
              {group.items.length === 0 ? (
                <div className="px-3 py-2 text-xs text-[#777]">暂无会话</div>
              ) : group.items.map((conversation) => (
                <div key={conversation.id} className="group relative">
                  <button
                    className={`w-full truncate rounded-lg py-2 pl-3 pr-10 text-left text-sm transition-colors ${mode !== "favorites" && conversation.id === conversationId ? "bg-white/10" : "hover:bg-white/5"}`}
                    onClick={() => void selectConversation(conversation.id)}
                  >
                    {conversation.is_pinned ? "★ " : ""}{conversation.title}
                  </button>
                  <button
                    aria-label="打开会话操作菜单"
                    className={`absolute right-1 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-[#b4b4b4] hover:bg-white/10 hover:text-white ${conversationMenuId === conversation.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      setConversationMenuId((current) => current === conversation.id ? "" : conversation.id);
                    }}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                  {conversationMenuId === conversation.id && (
                    <div className="absolute right-1 top-9 z-50 w-36 rounded-xl border border-white/10 bg-[#2f2f2f] p-1 text-sm shadow-2xl">
                      <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-white/10" onClick={() => void togglePinConversation(conversation)}>
                        <Pin className="h-4 w-4" />{conversation.is_pinned ? "取消置顶" : "置顶"}
                      </button>
                      <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-white/10" onClick={() => void shareConversation(conversation)}>
                        <Share2 className="h-4 w-4" />分享
                      </button>
                      <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-white/10" onClick={() => void renameConversation(conversation)}>
                        <Pencil className="h-4 w-4" />重命名
                      </button>
                      <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-white/10" onClick={reportConversation}>
                        <AlertTriangle className="h-4 w-4" />举报
                      </button>
                      <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-red-300 hover:bg-red-500/10" onClick={() => void deleteConversationItem(conversation)}>
                        <Trash2 className="h-4 w-4" />删除
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="mt-3 border-t border-white/10 pt-3">
          <button
            className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${mode === "favorites" ? "bg-white/10" : "hover:bg-white/5"}`}
            onClick={() => {
              setAttachments([]);
              setNotice("");
              setMode("favorites");
              void loadFavorites();
            }}
          >
            <Star className="h-4 w-4" />收藏
          </button>
        </div>
      </aside>

      <section className={`relative grid h-screen min-w-0 ${mode === "favorites" ? "grid-rows-[56px_1fr]" : "grid-rows-[56px_1fr_auto]"} overflow-hidden`}>
        <header className="flex items-center justify-between border-b border-white/10 px-4">
          <div className="text-sm font-medium">
            {mode === "chat" && "Agnes 2.0 Flash"}
            {mode === "image" && "图片生成"}
            {mode === "video" && "视频生成"}
            {mode === "favorites" && "收藏"}
          </div>
          <div className="text-xs text-[#b4b4b4]">{notice}</div>
        </header>
        {notice && (
          <div className="pointer-events-none fixed left-1/2 top-16 z-50 -translate-x-1/2 rounded-full border border-white/10 bg-[#303030] px-4 py-2 text-sm text-white shadow-2xl">
            {notice}
          </div>
        )}

        <div ref={scrollRef} className={`min-h-0 overflow-auto px-6 pt-8 ${mode === "favorites" ? "pb-10" : "pb-[10px]"}`}>
          <div className="mx-auto flex w-full max-w-[768px] flex-col gap-3">
            {mode === "chat" && messages.length === 0 && (
              <div className="grid min-h-[42vh] place-items-center text-center">
                <div>
                  <div className="mb-3 text-3xl font-semibold">今天想创作什么？</div>
                  <div className="text-sm text-[#b4b4b4]">聊天、生成图片、生成视频，都从下面的输入框开始。</div>
                </div>
              </div>
            )}

            {mode === "chat" && messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`${message.role === "user" ? "max-w-[78%] rounded-3xl bg-[#2f2f2f] px-5 py-3" : "w-full max-w-full px-1"} whitespace-pre-wrap text-[15px] leading-7`}>
                  {messageAttachments(message).length > 0 && (
                    <div className="mb-3 grid grid-cols-2 gap-2">
                      {messageAttachments(message).map((attachment) => (
                        <button key={`${attachment.url}-${attachment.name}`} className="overflow-hidden rounded-xl bg-black/20" onClick={() => window.open(attachment.url, "_blank", "noopener,noreferrer")}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img className="aspect-square w-full object-cover" src={attachment.url} alt={attachment.name} />
                        </button>
                      ))}
                    </div>
                  )}
                  {message.content}
                </div>
              </div>
            ))}

            {mode === "favorites" && (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xl font-semibold">收藏</div>
                    <div className="text-sm text-[#b4b4b4]">已收藏的图片和视频会显示在这里。</div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => void loadFavorites()}><RefreshCw className="h-4 w-4" />刷新</Button>
                </div>

                {favorites.length === 0 ? (
                  <Card className="border-white/10 bg-[#2a2a2a] p-6 text-sm text-[#b4b4b4]">还没有收藏内容。可以在图片或视频作品下点击收藏。</Card>
                ) : (
                  <div className="flex flex-col gap-3">
                    {favorites.map((item) => (
                      <Card key={item.favorite.id} className="overflow-hidden border-white/10 bg-[#2a2a2a]">
                        {item.image && (
                          <div className="space-y-3">
                            {item.image.image_urls.map((url, index) => (
                              <PortraitImageLink key={`${item.favorite.id}-${url}`} href={`/images/${item.image!.id}?index=${index}`} src={url} alt={item.image!.prompt} onLoad={scrollToLatest} />
                            ))}
                            <div className="space-y-2 p-3 pt-0">
                              <div className="line-clamp-2 text-sm">{item.image.prompt}</div>
                              <div className="flex flex-wrap gap-2">
                                <Button size="sm" variant="secondary" onClick={() => openImageDetail(item.image!.id, 0)}><Eye className="h-4 w-4" />查看</Button>
                                {item.image.image_urls[0] && <Button size="sm" variant="secondary" onClick={() => void downloadMedia(item.image!.image_urls[0], `${item.image!.id}.png`)}><Download className="h-4 w-4" />下载</Button>}
                                {item.image.image_urls[0] && <Button size="sm" variant="secondary" onClick={() => openRawMedia(item.image!.image_urls[0])}><ExternalLink className="h-4 w-4" />打开</Button>}
                                {item.image.image_urls[0] && <Button size="sm" variant="secondary" onClick={() => void copy(item.image!.image_urls[0])}><Copy className="h-4 w-4" />复制</Button>}
                                {item.image.image_urls[0] && <Button size="sm" variant="secondary" onClick={() => continueEditImage(item.image!.image_urls[0])}>继续编辑</Button>}
                                <Button size="sm" variant="destructive" onClick={() => void removeFavorite(item.favorite.id)}><Trash2 className="h-4 w-4" />取消收藏</Button>
                              </div>
                            </div>
                          </div>
                        )}

                        {item.video && (
                          <div className="space-y-3 p-3">
                            <div className="flex justify-between gap-3 text-sm">
                              <span>{item.video.prompt}</span>
                              <span className="shrink-0 text-[#b4b4b4]">{statusText(item.video.status)}</span>
                            </div>
                            {item.video.video_url && <video className="w-full rounded-lg" src={item.video.video_url} controls preload="metadata" />}
                            <div className="flex flex-wrap gap-2">
                              {item.video.video_url && <a className="inline-flex h-8 items-center gap-1 rounded-md bg-white/10 px-3 text-sm" href={`/videos/${item.video.id}`} target="_blank" rel="noreferrer"><Eye className="h-4 w-4" />查看</a>}
                              {item.video.video_url && <a className="inline-flex h-8 items-center gap-1 rounded-md bg-white/10 px-3 text-sm" href={item.video.video_url} download={`${item.video.id}.mp4`} target="_blank"><Download className="h-4 w-4" />下载</a>}
                              {item.video.video_url && <a className="inline-flex h-8 items-center gap-1 rounded-md bg-white/10 px-3 text-sm" href={item.video.video_url} target="_blank"><ExternalLink className="h-4 w-4" />打开</a>}
                              {item.video.video_url && <Button size="sm" variant="secondary" onClick={() => void copy(item.video!.video_url)}><Copy className="h-4 w-4" />复制</Button>}
                              <Button size="sm" variant="destructive" onClick={() => void removeFavorite(item.favorite.id)}><Trash2 className="h-4 w-4" />取消收藏</Button>
                            </div>
                          </div>
                        )}

                        {!item.image && !item.video && (
                          <div className="flex items-center justify-between gap-3 p-4 text-sm text-[#b4b4b4]">
                            <span>收藏的内容已不存在或暂不支持展示：{item.favorite.type} / {item.favorite.ref_id}</span>
                            <Button size="sm" variant="destructive" onClick={() => void removeFavorite(item.favorite.id)}><Trash2 className="h-4 w-4" />取消收藏</Button>
                          </div>
                        )}
                      </Card>
                    ))}
                  </div>
                )}
              </section>
            )}

            {mode === "image" && (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xl font-semibold">图片作品</div>
                    <div className="text-sm text-[#b4b4b4]">图片结果只显示在此页面，不再混入聊天会话。</div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => void loadImages()}><RefreshCw className="h-4 w-4" />刷新</Button>
                </div>

                {visibleImages.length === 0 && currentImageRequests.length === 0 ? (
                  <Card className="border-white/10 bg-[#2a2a2a] p-6 text-sm text-[#b4b4b4]">还没有图片。请在底部输入框描述图片，上传参考图后点击发送。</Card>
                ) : (
                  <div className="flex flex-col gap-3">
                    {visibleImagesChronological.flatMap((task) => task.image_urls.map((url, index) => (
                      <Card key={`${task.id}-${url}`} className="overflow-hidden border-white/10 bg-[#2a2a2a]">
                        <PortraitImageLink href={`/images/${task.id}?index=${index}`} src={url} alt={task.prompt} onLoad={scrollToLatest} />
                        <div className="space-y-2 p-3">
                          <div className="line-clamp-2 text-sm">{task.prompt}</div>
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="secondary" onClick={() => openImageDetail(task.id, index)}><Eye className="h-4 w-4" />查看</Button>
                            <Button size="sm" variant="secondary" onClick={() => void downloadMedia(url, `${task.id}-${index + 1}.png`)}><Download className="h-4 w-4" />下载</Button>
                            <Button size="sm" variant="secondary" onClick={() => openRawMedia(url)}><ExternalLink className="h-4 w-4" />打开</Button>
                            <Button size="sm" variant="secondary" onClick={() => void copy(url)}><Copy className="h-4 w-4" />复制</Button>
                            <Button size="sm" variant="secondary" onClick={() => void favorite("image", task.id)}><Star className="h-4 w-4" />收藏</Button>
                            <Button size="sm" variant="secondary" onClick={() => continueEditImage(url)}>继续编辑</Button>
                            <Button aria-label="删除图片" size="sm" variant="destructive" onClick={() => void deleteImage(task.id)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </div>
                      </Card>
                    )))}
                  </div>
                )}

                {currentImageRequests.map((request) => (
                  <Card key={request.id} className="space-y-3 border-white/10 bg-[#2a2a2a] p-3">
                    <div className="flex justify-end">
                      <div className="max-w-[86%] rounded-3xl bg-[#2f2f2f] px-4 py-3 text-sm leading-6">
                        <div className="whitespace-pre-wrap">{request.prompt}</div>
                        {request.attachments.length > 0 && (
                          <div className="mt-3 grid grid-cols-4 gap-2 max-sm:grid-cols-3">
                            {request.attachments.map((attachment) => (
                              <button key={attachment.id} className="overflow-hidden rounded-xl bg-black/20" onClick={() => window.open(attachment.url, "_blank", "noopener,noreferrer")}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img className="aspect-square w-full object-cover" src={attachment.previewUrl} alt={attachment.name} />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {request.status === "generating" && (
                      <div className="flex items-center gap-2 px-1 text-sm text-[#b4b4b4]">
                        <Loader2 className="h-4 w-4 animate-spin" />正在生成图片...
                      </div>
                    )}

                    {request.status === "failed" && (
                      <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-200">{request.error}</div>
                    )}

                    {request.task && (
                      <div className="flex flex-col gap-3">
                        {request.task.image_urls.map((url, index) => (
                          <Card key={`${request.task?.id}-${url}`} className="overflow-hidden border-white/10 bg-[#202020]">
                            <PortraitImageLink href={`/images/${request.task?.id}?index=${index}`} src={url} alt={request.prompt} onLoad={scrollToLatest} />
                            <div className="flex flex-wrap gap-2 p-3">
                              <Button size="sm" variant="secondary" onClick={() => openImageDetail(request.task!.id, index)}><Eye className="h-4 w-4" />查看</Button>
                              <Button size="sm" variant="secondary" onClick={() => void downloadMedia(url, `${request.task!.id}-${index + 1}.png`)}><Download className="h-4 w-4" />下载</Button>
                              <Button size="sm" variant="secondary" onClick={() => openRawMedia(url)}><ExternalLink className="h-4 w-4" />打开</Button>
                              <Button size="sm" variant="secondary" onClick={() => void copy(url)}><Copy className="h-4 w-4" />复制</Button>
                              <Button size="sm" variant="secondary" onClick={() => void favorite("image", request.task!.id)}><Star className="h-4 w-4" />收藏</Button>
                              <Button size="sm" variant="secondary" onClick={() => continueEditImage(url)}>继续编辑</Button>
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}
                  </Card>
                ))}
              </section>
            )}

            {mode === "video" && (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xl font-semibold">视频任务</div>
                    <div className="text-sm text-[#b4b4b4]">视频生成、播放和下载都在此页面管理。</div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => void loadVideos()}><RefreshCw className="h-4 w-4" />刷新</Button>
                </div>
                {videos.length === 0 ? (
                  <Card className="border-white/10 bg-[#2a2a2a] p-6 text-sm text-[#b4b4b4]">还没有视频任务。请在底部输入框描述视频，必要时上传一张参考图。</Card>
                ) : (
                  videos.map((video) => (
                    <Card key={video.id} className="space-y-3 border-white/10 bg-[#2a2a2a] p-3">
                      <div className="flex justify-between gap-3 text-sm">
                        <span>{video.prompt}</span>
                        <span className="shrink-0 text-[#b4b4b4]">{statusText(video.status)}</span>
                      </div>
                      {video.video_url && <video className="w-full rounded-lg" src={video.video_url} controls preload="metadata" />}
                      {video.video_url && (
                        <div className="flex flex-wrap gap-2">
                          <a className="inline-flex h-8 items-center gap-1 rounded-md bg-white/10 px-3 text-sm" href={`/videos/${video.id}`} target="_blank" rel="noreferrer"><Eye className="h-4 w-4" />查看</a>
                          <a className="inline-flex h-8 items-center gap-1 rounded-md bg-white/10 px-3 text-sm" href={video.video_url} download={`${video.id}.mp4`} target="_blank"><Download className="h-4 w-4" />下载</a>
                          <a className="inline-flex h-8 items-center gap-1 rounded-md bg-white/10 px-3 text-sm" href={video.video_url} target="_blank"><ExternalLink className="h-4 w-4" />打开</a>
                          <Button size="sm" variant="secondary" onClick={() => void copy(video.video_url)}><Copy className="h-4 w-4" />复制</Button>
                          <Button size="sm" variant="secondary" onClick={() => void favorite("video", video.id)}><Star className="h-4 w-4" />收藏</Button>
                          <Button size="sm" variant="destructive" onClick={async () => { await api(`/api/videos/${video.id}`, { method: "DELETE" }); await loadVideos(); }}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      )}
                    </Card>
                  ))
                )}
              </section>
            )}
          </div>
        </div>

        {mode !== "favorites" && <footer className="bg-[#212121] px-6 pb-3 pt-[10px]">
          <div
            className="pointer-events-auto mx-auto flex max-h-[42vh] w-full max-w-[768px] flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#2f2f2f] p-3 shadow-2xl"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              void addFiles(event.dataTransfer.files);
            }}
          >
            <div className="mb-2 flex max-h-28 flex-wrap gap-2 overflow-y-auto pr-1">
              {attachments.map((attachment) => (
                <div key={attachment.id} className="flex max-w-[230px] items-center gap-2 rounded-2xl bg-[#404040] p-1 pr-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="h-10 w-10 cursor-zoom-in rounded-xl object-cover" src={attachment.previewUrl} alt={attachment.name} onClick={() => attachment.url && window.open(attachment.url, "_blank", "noopener,noreferrer")} />
                  <div className="min-w-0">
                    <div className="truncate text-xs">{attachment.name}</div>
                    <div className={`text-[11px] ${attachment.status === "failed" ? "text-red-300" : "text-[#b4b4b4]"}`}>
                      {attachment.status === "uploading" ? "上传中..." : attachment.status === "failed" ? "上传失败" : formatBytes(attachment.size)}
                    </div>
                  </div>
                  <button aria-label={`移除附件 ${attachment.name}`} className="rounded-full p-1 hover:bg-white/10" onClick={() => {
                    if (attachment.previewUrl.startsWith("blob:")) URL.revokeObjectURL(attachment.previewUrl);
                    setAttachments((items) => items.filter((item) => item.id !== attachment.id));
                  }}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <Textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder={mode === "chat" ? "询问任何问题" : mode === "image" ? "描述你想生成或编辑的图片" : "描述你想生成的视频"}
              className="max-h-40 min-h-16 flex-1 resize-none border-0 bg-transparent px-2 text-base focus:border-0"
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void submit();
                }
              }}
            />
            <div className="flex min-h-5 items-center justify-between gap-3 px-2 text-[11px] text-[#9b9b9b]" aria-live="polite">
              <span className="flex min-w-0 items-center gap-1.5">
                {draftStatus === "saving" && <Loader2 className="h-3 w-3 shrink-0 animate-spin" />}
                {(draftStatus === "saved" || draftStatus === "restored") && <Check className="h-3 w-3 shrink-0 text-emerald-400" />}
                <span className="truncate">
                  {draftStatus === "saving" && "正在保存草稿…"}
                  {draftStatus === "saved" && "草稿已保存到本机"}
                  {draftStatus === "restored" && "已恢复上次未发送的草稿"}
                  {draftStatus === "unavailable" && "当前浏览器无法保存草稿"}
                </span>
              </span>
              {prompt.trim() && (
                <button
                  type="button"
                  className="shrink-0 rounded px-1.5 py-0.5 text-[#b4b4b4] transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500"
                  onClick={clearCurrentDraft}
                  aria-label="清空当前草稿"
                >
                  清空
                </button>
              )}
            </div>
            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  className="hidden"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  onChange={(event) => {
                    if (event.target.files) void addFiles(event.target.files);
                    event.target.value = "";
                  }}
                />
                <Button aria-label="上传附件" size="icon" variant="ghost" onClick={() => fileInputRef.current?.click()}><Paperclip className="h-4 w-4" /></Button>
                {(["chat", "image", "video"] as Mode[]).map((item) => (
                  <Button key={item} size="sm" variant={mode === item ? "default" : "ghost"} onClick={() => {
                    if (item !== mode) setAttachments([]);
                    setMode(item);
                    if (item === "image") void loadImages();
                    if (item === "video") void loadVideos();
                  }}>
                    {item === "chat" && "聊天"}
                    {item === "image" && <><ImagePlus className="h-4 w-4" />图片</>}
                    {item === "video" && <><Video className="h-4 w-4" />视频</>}
                  </Button>
                ))}
              </div>
              <Button aria-label="发送" size="icon" disabled={currentConversationSubmitting || !prompt.trim()} onClick={() => void submit()}>
                {currentConversationSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </footer>}
      </section>

    </main>
  );
}
