import type { Role } from "./common.js";

/** 一个历史会话，可以归属到某个项目，也可以放在“不使用项目”下。 */
export interface Conversation {
  id: string;
  title: string;
  model: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  project_id: string;
}

/** 会话消息，meta 中会保存附件、生成参数等扩展信息。 */
export interface Message {
  id: string;
  conversation_id: string;
  role: Role;
  content: string;
  tokens: number;
  meta: Record<string, unknown>;
  created_at: string;
}

/** 聊天附件，当前只支持可被公开访问的图片 URL。 */
export interface ChatAttachment {
  name: string;
  size: number;
  url: string;
}

/** 单条聊天消息内容片段，支持文本或图片 URL。 */
export type ChatContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: "low" | "high" | "auto" } };

/** 聊天工具定义，供 function calling 使用。 */
export interface ChatTool {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

/** 模型返回的工具调用。 */
export interface ChatToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

/** 聊天请求入参，conversationId 决定消息写入哪个历史会话。 */
export interface ChatParams {
  conversationId: string;
  /** 当前用户输入的文本。 */
  message: string;
  /** 当前用户上传的图片附件。 */
  attachments?: ChatAttachment[];
  /** 当前会话的历史消息，用于构建多轮对话上下文。 */
  history?: Array<{ role: "user" | "assistant" | "system"; content: string | ChatContentPart[]; name?: string }>;
  /** 使用的模型，默认 agnes-2.0-flash。 */
  model?: string;
  /** 采样温度，默认 0.7。 */
  temperature?: number;
  /** 核采样，默认 1。 */
  top_p?: number;
  /** 最大生成 token 数。 */
  max_tokens?: number;
  /** 是否启用 function calling。 */
  tools?: ChatTool[];
  /** 工具选择策略。 */
  tool_choice?: "none" | "auto" | { type: "function"; function: { name: string } };
  /** OpenAI 风格的 thinking 扩展参数。 */
  chat_template_kwargs?: { enable_thinking?: boolean };
  /** Anthropic 风格的 thinking 扩展参数。 */
  thinking?: { type: "enabled"; budget_tokens: number };
}

/** 聊天流式输出片段，done 表示服务端已结束推送。 */
export interface ChatChunk {
  content?: string;
  reasoning?: string;
  tool_calls?: ChatToolCall[];
  done?: boolean;
}
