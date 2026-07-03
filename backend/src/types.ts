export type Role = "system" | "user" | "assistant";
export type TaskStatus = "pending" | "processing" | "success" | "failed";
export type FavoriteType = "chat" | "image" | "video";

export interface Conversation {
  id: string;
  title: string;
  model: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  project_id: string;
}

export interface Project {
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

export interface Message {
  id: string;
  conversation_id: string;
  role: Role;
  content: string;
  tokens: number;
  meta: Record<string, unknown>;
  created_at: string;
}

export interface ImageTask {
  id: string;
  conversation_id: string;
  prompt: string;
  negative: string;
  params: ImageParams;
  image_urls: string[];
  status: TaskStatus;
  error: string;
  created_at: string;
}

export interface VideoTask {
  id: string;
  conversation_id: string;
  prompt: string;
  image_url: string;
  params: VideoParams;
  video_url: string;
  status: TaskStatus;
  error: string;
  created_at: string;
}

export interface Favorite {
  id: string;
  type: FavoriteType;
  ref_id: string;
  created_at: string;
}

export interface Settings {
  theme: "light" | "dark" | "system";
  language: "zh-CN" | "en-US";
  fontSize: "small" | "medium" | "large";
  defaultChatModel: string;
  defaultImageSize: "1024x768" | "768x1024" | "1024x1024" | "1152x768" | "768x1152";
  defaultVideoRatio: "16:9" | "9:16" | "1:1";
}

export interface ImageParams {
  prompt: string;
  negative_prompt?: string;
  image?: string;
  images?: string[];
  size?: "1024x768" | "768x1024" | "1024x1024" | "1152x768" | "768x1152";
  ratio?: "1:1" | "3:2" | "2:3" | "16:9" | "9:16";
  n?: number;
  seed?: number;
  steps?: number;
  cfg?: number;
}

export interface VideoParams {
  prompt: string;
  image?: string;
  ratio?: "16:9" | "9:16" | "1:1";
  duration?: 5 | 10;
  model?: string;
}

export interface ChatParams {
  conversationId: string;
  message: string;
  model?: string;
}

export interface ChatChunk {
  content: string;
  done?: boolean;
}

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}
