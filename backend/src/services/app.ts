import path from "node:path";
import { createAgnesClient, type AgnesClient } from "../ai/agnes-client.js";
import type { Conversation, Favorite, ImageTask, Message, Project, Settings, VideoTask } from "../types.js";
import { CsvRepository, SettingsRepository } from "../storage/csv.js";
import { conversationFields, favoriteFields, imageTaskFields, messageFields, projectFields, videoTaskFields } from "../storage/schema.js";

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
    settings: new SettingsRepository(path.join(root, "data", "csv"), defaultSettings),
    aborts: new Map(),
  };
}
