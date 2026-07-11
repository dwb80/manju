import path from "node:path";
import { createAgnesClient, type AgnesClient } from "../ai/agnes-client.js";
import type { Conversation, Favorite, ImageTask, Message, Project, Settings, VideoTask, ScriptComment, AssetVersion } from "../types.js";
import { CsvRepository, SettingsRepository } from "../storage/csv.js";
import { conversationFields, favoriteFields, imageTaskFields, messageFields, projectFields, videoTaskFields, scriptCommentFields, assetVersionFields } from "../storage/schema.js";

export interface AppContext {
  ai: AgnesClient;
  root: string;
  mediaRoot: string;
  mediaCacheEnabled: boolean;
  conversations: CsvRepository<Conversation>;
  projects: CsvRepository<Project>;
  messages: CsvRepository<Message>;
  images: CsvRepository<ImageTask>;
  videos: CsvRepository<VideoTask>;
  favorites: CsvRepository<Favorite>;
  /** 剧本编辑器内行内批注与回复仓储（任务8：评论持久化）。 */
  scriptComments: CsvRepository<ScriptComment>;
  /** 三厂共性：资产版本历史仓储（任务12：统一版本管理）。 */
  assetVersions: CsvRepository<AssetVersion>;
  settings: SettingsRepository<Settings>;
  aborts: Map<string, AbortController>;
}

export const defaultSettings: Settings = {
  theme: "system",
  language: "zh-CN",
  fontSize: "medium",
  defaultChatModel: "agnes-2.0-flash",
  defaultImageSize: "1024x768",
  defaultVideoRatio: "16:9",
};

/** 组装后端运行所需的 AI 客户端、CSV 仓库、媒体目录和运行状态。 */
export function createAppContext(root = process.cwd(), options: { mediaCacheEnabled?: boolean } = {}): AppContext {
  const base = path.join(root, "data", "csv");
  return {
    ai: createAgnesClient(),
    root,
    mediaRoot: path.join(root, "data", "media"),
    mediaCacheEnabled: options.mediaCacheEnabled ?? true,
    conversations: new CsvRepository(base, "conversations", conversationFields),
    projects: new CsvRepository(base, "projects", projectFields),
    messages: new CsvRepository(base, "messages", messageFields),
    images: new CsvRepository(base, "image_tasks", imageTaskFields),
    videos: new CsvRepository(base, "video_tasks", videoTaskFields),
    favorites: new CsvRepository(base, "favorites", favoriteFields),
    scriptComments: new CsvRepository(base, "script_comments", scriptCommentFields),
    assetVersions: new CsvRepository(base, "asset_versions", assetVersionFields),
    settings: new SettingsRepository(path.join(root, "data", "csv"), defaultSettings),
    aborts: new Map(),
  };
}
